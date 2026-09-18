package router

import (
	"context"
	"net/http"
	"time"

	"polling-backend/config"
	"polling-backend/controllers"
	"polling-backend/database"
	"polling-backend/middleware"
	"polling-backend/services"

	"github.com/gin-gonic/gin"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// Apply CORS
	r.Use(middleware.CORSMiddleware())

	authController := controllers.NewAuthController(cfg)
	pollController := controllers.NewPollController(cfg)
	voteController := controllers.NewVoteController()

	// Health check endpoint
	r.GET("/api/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		mongoStatus := "ok"
		if err := database.MongoClient.Ping(ctx, nil); err != nil {
			mongoStatus = "error: " + err.Error()
		}

		redisStatus := "ok"
		if err := database.RedisClient.Ping(ctx).Err(); err != nil {
			redisStatus = "error: " + err.Error()
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"backend":   "Go with Gin",
			"database":  mongoStatus,
			"realtime":  redisStatus,
			"timestamp": time.Now().UTC(),
		})
	})

	// Public Auth endpoints
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/signup", authController.Signup)
		authGroup.POST("/login", authController.Login)
		authGroup.GET("/me", middleware.AuthMiddleware(cfg), authController.Me)
	}

	// Public Poll & Vote endpoints
	r.GET("/api/polls", pollController.ListPublicPolls)
	r.GET("/api/polls/:id", pollController.GetPoll)
	r.POST("/api/polls/:id/vote", middleware.OptionalAuthMiddleware(cfg), voteController.CastVote)

	// Realtime stream endpoints (SSE & WebSocket)
	r.GET("/api/polls/:id/events", services.HandleSSE)
	r.GET("/ws/polls/:id", services.HandleWebSocket)

	// Authenticated Poll management
	protected := r.Group("/api/polls", middleware.AuthMiddleware(cfg))
	{
		protected.POST("", pollController.CreatePoll)
		protected.GET("/my", pollController.ListMyPolls)
		protected.PATCH("/:id/status", pollController.TogglePollStatus)
		protected.DELETE("/:id", pollController.DeletePoll)
	}

	return r
}
