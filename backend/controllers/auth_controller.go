package controllers

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"polling-backend/config"
	"polling-backend/database"
	"polling-backend/middleware"
	"polling-backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type AuthController struct {
	cfg *config.Config
}

func NewAuthController(cfg *config.Config) *AuthController {
	return &AuthController{cfg: cfg}
}

func (ac *AuthController) Signup(c *gin.Context) {
	var req models.SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if len(req.Username) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 3 characters long"})
		return
	}
	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 6 characters long"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if database.MongoDB == nil {
		log.Println("[AUTH ERROR] Signup attempted while database.MongoDB is nil")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Database service is unavailable. Please check MongoDB configuration.",
		})
		return
	}

	userCol := database.MongoDB.Collection("users")

	// Check if username or email already taken
	filter := bson.M{
		"$or": []bson.M{
			{"username": req.Username},
			{"email": req.Email},
		},
	}
	var existing models.User
	err := userCol.FindOne(ctx, filter).Decode(&existing)
	if err == nil {
		if existing.Email == req.Email {
			c.JSON(http.StatusConflict, gin.H{"error": "Email is already registered"})
			return
		}
		c.JSON(http.StatusConflict, gin.H{"error": "Username is already taken"})
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("[AUTH ERROR] Database error checking user existence for '%s' / '%s': %v", req.Username, req.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Database error checking user existence",
			"details": err.Error(),
		})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
		return
	}

	newUser := models.User{
		ID:        primitive.NewObjectID(),
		Username:  req.Username,
		Email:     req.Email,
		Password:  string(hashedPassword),
		CreatedAt: time.Now(),
	}

	_, err = userCol.InsertOne(ctx, newUser)
	if err != nil {
		log.Printf("[AUTH ERROR] Failed to insert user '%s': %v", req.Username, err)
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "A user with this username or email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create user account",
			"details": err.Error(),
		})
		return
	}

	token, err := middleware.GenerateToken(newUser.ID.Hex(), newUser.Username, newUser.Email, ac.cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  newUser,
	})
}

func (ac *AuthController) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
		return
	}

	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identifier (username/email) and password are required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if database.MongoDB == nil {
		log.Println("[AUTH ERROR] Login attempted while database.MongoDB is nil")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Database service is unavailable. Please check MongoDB configuration.",
		})
		return
	}

	userCol := database.MongoDB.Collection("users")

	filter := bson.M{
		"$or": []bson.M{
			{"username": identifier},
			{"email": strings.ToLower(identifier)},
		},
	}

	var user models.User
	err := userCol.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username/email or password"})
			return
		}
		log.Printf("[AUTH ERROR] Database lookup failed during login for '%s': %v", identifier, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Database lookup failed",
			"details": err.Error(),
		})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username/email or password"})
		return
	}

	token, err := middleware.GenerateToken(user.ID.Hex(), user.Username, user.Email, ac.cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func (ac *AuthController) Me(c *gin.Context) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthenticated"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if database.MongoDB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database service is unavailable"})
		return
	}

	var user models.User
	err = database.MongoDB.Collection("users").FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
