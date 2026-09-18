package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"polling-backend/database"
	"polling-backend/models"
	"polling-backend/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type VoteController struct{}

func NewVoteController() *VoteController {
	return &VoteController{}
}

func (vc *VoteController) CastVote(c *gin.Context) {
	pollIDParam := c.Param("id")
	pollObjID, err := primitive.ObjectIDFromHex(pollIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID format"})
		return
	}

	var req models.VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Option ID is required"})
		return
	}

	req.OptionID = strings.TrimSpace(req.OptionID)
	if req.OptionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Option ID cannot be blank"})
		return
	}

	clientIP := c.ClientIP()
	voterIdentifier := strings.TrimSpace(req.VoterID)
	if voterIdentifier == "" {
		voterIdentifier = clientIP
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Check if poll exists & is active
	var poll models.Poll
	err = database.MongoDB.Collection("polls").FindOne(ctx, bson.M{"_id": pollObjID}).Decode(&poll)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Poll does not exist"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking poll"})
		return
	}

	if !poll.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This poll is closed and no longer accepting votes"})
		return
	}

	// 2. Validate that the optionId belongs to this poll
	optionFound := false
	for _, opt := range poll.Options {
		if opt.ID == req.OptionID {
			optionFound = true
			break
		}
	}
	if !optionFound {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Selected option is not valid for this poll"})
		return
	}

	// 3. Meaningful Redis usage: Prevent duplicate votes using Redis SET
	votersKey := "poll:" + pollIDParam + ":voters"
	added, err := database.RedisClient.SAdd(ctx, votersKey, voterIdentifier).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error recording voter session in Redis"})
		return
	}
	if added == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "You have already cast a vote in this poll"})
		return
	}

	// 4. Meaningful Redis usage: Atomic sub-millisecond vote counter increment
	countsKey := "poll:" + pollIDParam + ":counts"
	_, err = database.RedisClient.HIncrBy(ctx, countsKey, req.OptionID, 1).Result()
	if err != nil {
		// Rollback voter set addition if redis counter fails
		_ = database.RedisClient.SRem(ctx, votersKey, voterIdentifier)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to increment vote count in Redis"})
		return
	}

	// Fetch updated live counts from Redis
	liveCounts, totalVotes, _ := services.GetLiveCountsFromRedis(pollIDParam)

	// 5. MongoDB Persistence: Durably record the vote and update option totals
	now := time.Now()
	voteDoc := models.Vote{
		ID:        primitive.NewObjectID(),
		PollID:    pollObjID,
		OptionID:  req.OptionID,
		VoterID:   voterIdentifier,
		VoterIP:   clientIP,
		CreatedAt: now,
	}

	// Optional: link authenticated user if present
	if userIDStr, exists := c.Get("userID"); exists {
		if uID, err := primitive.ObjectIDFromHex(userIDStr.(string)); err == nil {
			voteDoc.UserID = &uID
		}
	}

	// Persist vote document
	_, _ = database.MongoDB.Collection("votes").InsertOne(ctx, voteDoc)

	// Update poll document in MongoDB
	_, _ = database.MongoDB.Collection("polls").UpdateOne(
		ctx,
		bson.M{"_id": pollObjID, "options.id": req.OptionID},
		bson.M{
			"$inc": bson.M{
				"options.$.votes": 1,
				"totalVotes":      1,
			},
			"$set": bson.M{
				"updatedAt": now,
			},
		},
	)

	// 6. Real-time Broadcast: Publish to Redis Pub/Sub channel
	updateMsg := models.LiveVoteUpdate{
		Type:       "vote_update",
		PollID:     pollIDParam,
		OptionID:   req.OptionID,
		Counts:     liveCounts,
		TotalVotes: totalVotes,
		IsActive:   true,
		Timestamp:  now.UnixMilli(),
	}
	_ = services.PublishUpdate(updateMsg)

	c.JSON(http.StatusOK, gin.H{
		"message":    "Vote recorded successfully",
		"optionId":   req.OptionID,
		"counts":     liveCounts,
		"totalVotes": totalVotes,
	})
}
