package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"polling-backend/config"
	"polling-backend/database"
	"polling-backend/models"
	"polling-backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type PollController struct {
	cfg *config.Config
}

func NewPollController(cfg *config.Config) *PollController {
	return &PollController{cfg: cfg}
}

func (pc *PollController) CreatePoll(c *gin.Context) {
	userIDStr, _ := c.Get("userID")
	username, _ := c.Get("username")

	creatorID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid creator ID"})
		return
	}

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation error: " + err.Error()})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if len(req.Title) < 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Question / title must be at least 5 characters long"})
		return
	}

	// Validate options
	cleanOptions := make([]models.PollOption, 0)
	seen := make(map[string]bool)

	for _, optText := range req.Options {
		trimmed := strings.TrimSpace(optText)
		if trimmed == "" {
			continue
		}
		lower := strings.ToLower(trimmed)
		if seen[lower] {
			continue // skip exact duplicate options
		}
		seen[lower] = true
		cleanOptions = append(cleanOptions, models.PollOption{
			ID:    uuid.New().String()[:8], // compact 8-char option ID
			Text:  trimmed,
			Votes: 0,
		})
	}

	if len(cleanOptions) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A poll requires at least 2 distinct, non-empty options"})
		return
	}

	now := time.Now()
	newPoll := models.Poll{
		ID:          primitive.NewObjectID(),
		Title:       req.Title,
		Description: strings.TrimSpace(req.Description),
		Options:     cleanOptions,
		CreatorID:   creatorID,
		CreatorName: username.(string),
		IsActive:    true,
		TotalVotes:  0,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Insert into MongoDB
	_, err = database.MongoDB.Collection("polls").InsertOne(ctx, newPoll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create poll in database"})
		return
	}

	// 2. Initialize Redis state
	pollIDStr := newPoll.ID.Hex()
	redisCountsKey := "poll:" + pollIDStr + ":counts"
	pipeline := database.RedisClient.Pipeline()
	for _, opt := range cleanOptions {
		pipeline.HSet(ctx, redisCountsKey, opt.ID, 0)
	}
	pipeline.Set(ctx, "poll:"+pollIDStr+":active", "1", 30*24*time.Hour)
	_, _ = pipeline.Exec(ctx)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Poll created successfully",
		"poll":    newPoll,
	})
}

func (pc *PollController) GetPoll(c *gin.Context) {
	pollIDParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(pollIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	err = database.MongoDB.Collection("polls").FindOne(ctx, bson.M{"_id": objID}).Decode(&poll)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error retrieving poll"})
		return
	}

	// Fetch real-time vote counts from Redis
	liveCounts, totalLive, err := services.GetLiveCountsFromRedis(pollIDParam)
	if err == nil && len(liveCounts) > 0 {
		var total int64 = 0
		for i := range poll.Options {
			optID := poll.Options[i].ID
			if cnt, ok := liveCounts[optID]; ok {
				poll.Options[i].Votes = cnt
				total += cnt
			}
		}
		poll.TotalVotes = total
	} else if totalLive > 0 {
		poll.TotalVotes = totalLive
	}

	// Check if current voter has voted
	voterID := c.Query("voterId")
	hasVoted := false
	userVotedOption := ""
	if voterID != "" {
		isMember, err := database.RedisClient.SIsMember(ctx, "poll:"+pollIDParam+":voters", voterID).Result()
		if err == nil && isMember {
			hasVoted = true
			// Find which option they voted for from MongoDB
			var voteDoc models.Vote
			err = database.MongoDB.Collection("votes").FindOne(ctx, bson.M{"pollId": objID, "voterId": voterID}).Decode(&voteDoc)
			if err == nil {
				userVotedOption = voteDoc.OptionID
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"poll":            poll,
		"hasVoted":        hasVoted,
		"userVotedOption": userVotedOption,
	})
}

func (pc *PollController) ListMyPolls(c *gin.Context) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	creatorID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := database.MongoDB.Collection("polls").Find(ctx, bson.M{"creatorId": creatorID}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query polls"})
		return
	}
	defer cursor.Close(ctx)

	var polls []models.Poll
	if err = cursor.All(ctx, &polls); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode polls"})
		return
	}

	if polls == nil {
		polls = make([]models.Poll, 0)
	}

	// Merge real-time counts from Redis for each poll
	for i := range polls {
		pID := polls[i].ID.Hex()
		counts, total, err := services.GetLiveCountsFromRedis(pID)
		if err == nil && len(counts) > 0 {
			for j := range polls[i].Options {
				optID := polls[i].Options[j].ID
				if cnt, ok := counts[optID]; ok {
					polls[i].Options[j].Votes = cnt
				}
			}
			polls[i].TotalVotes = total
		}
	}

	c.JSON(http.StatusOK, gin.H{"polls": polls})
}

func (pc *PollController) ListPublicPolls(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(20)
	cursor, err := database.MongoDB.Collection("polls").Find(ctx, bson.M{"isActive": true}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query active polls"})
		return
	}
	defer cursor.Close(ctx)

	var polls []models.Poll
	if err = cursor.All(ctx, &polls); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode polls"})
		return
	}

	if polls == nil {
		polls = make([]models.Poll, 0)
	}

	// Merge Redis counts
	for i := range polls {
		pID := polls[i].ID.Hex()
		counts, total, err := services.GetLiveCountsFromRedis(pID)
		if err == nil && len(counts) > 0 {
			for j := range polls[i].Options {
				optID := polls[i].Options[j].ID
				if cnt, ok := counts[optID]; ok {
					polls[i].Options[j].Votes = cnt
				}
			}
			polls[i].TotalVotes = total
		}
	}

	c.JSON(http.StatusOK, gin.H{"polls": polls})
}

func (pc *PollController) TogglePollStatus(c *gin.Context) {
	userIDStr, _ := c.Get("userID")
	pollIDParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(pollIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	creatorID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	err = database.MongoDB.Collection("polls").FindOne(ctx, bson.M{"_id": objID}).Decode(&poll)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	if poll.CreatorID != creatorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the poll creator can modify this poll"})
		return
	}

	newStatus := !poll.IsActive
	_, err = database.MongoDB.Collection("polls").UpdateOne(ctx, bson.M{"_id": objID}, bson.M{
		"$set": bson.M{
			"isActive":  newStatus,
			"updatedAt": time.Now(),
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update poll status"})
		return
	}

	// Update Redis status
	activeVal := "0"
	if newStatus {
		activeVal = "1"
	}
	database.RedisClient.Set(ctx, "poll:"+pollIDParam+":active", activeVal, 30*24*time.Hour)

	// Broadcast status change via Redis Pub/Sub
	counts, total, _ := services.GetLiveCountsFromRedis(pollIDParam)
	_ = services.PublishUpdate(models.LiveVoteUpdate{
		Type:       "status_change",
		PollID:     pollIDParam,
		Counts:     counts,
		TotalVotes: total,
		IsActive:   newStatus,
		Timestamp:  time.Now().UnixMilli(),
	})

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("Poll is now %s", map[bool]string{true: "active", false: "closed"}[newStatus]),
		"isActive": newStatus,
	})
}

func (pc *PollController) DeletePoll(c *gin.Context) {
	userIDStr, _ := c.Get("userID")
	pollIDParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(pollIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	creatorID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	err = database.MongoDB.Collection("polls").FindOne(ctx, bson.M{"_id": objID}).Decode(&poll)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	if poll.CreatorID != creatorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the poll creator can delete this poll"})
		return
	}

	// Delete from MongoDB
	_, _ = database.MongoDB.Collection("polls").DeleteOne(ctx, bson.M{"_id": objID})
	_, _ = database.MongoDB.Collection("votes").DeleteMany(ctx, bson.M{"pollId": objID})

	// Clean Redis keys
	database.RedisClient.Del(ctx,
		"poll:"+pollIDParam+":counts",
		"poll:"+pollIDParam+":voters",
		"poll:"+pollIDParam+":active",
	)

	// Notify real-time listeners
	_ = services.PublishUpdate(models.LiveVoteUpdate{
		Type:       "status_change",
		PollID:     pollIDParam,
		IsActive:   false,
		Timestamp:  time.Now().UnixMilli(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "Poll deleted successfully"})
}
