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

		mongoLatency, mongoErr := database.CheckDatabaseConnection(ctx)
		mongoStatus := "ok"
		if mongoErr != nil {
			mongoStatus = "error: " + mongoErr.Error()
		}

		redisStatus := "ok"
		if database.RedisClient == nil {
			redisStatus = "error: redis client not initialized"
		} else if err := database.RedisClient.Ping(ctx).Err(); err != nil {
			redisStatus = "error: " + err.Error()
		}

		overallStatus := "healthy"
		httpCode := http.StatusOK
		if mongoStatus != "ok" || redisStatus != "ok" {
			overallStatus = "degraded"
			httpCode = http.StatusServiceUnavailable
		}

		c.JSON(httpCode, gin.H{
			"status":       overallStatus,
			"backend":      "Go with Gin",
			"database":     mongoStatus,
			"databaseName": database.ConnectedDBName,
			"mongoLatency": mongoLatency.String(),
			"realtime":     redisStatus,
			"timestamp":    time.Now().UTC(),
		})
	})

	// Public Auth endpoints
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/signup", authController.Signup)
		authGroup.POST("/login", authController.Login)
		authGroup.POST("/signin", authController.Login) // alias for login
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

	// Catch-all 404 handler to ensure JSON responses instead of HTML
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "API route not found",
			"path":  c.Request.URL.Path,
		})
	})

	// 405 Method Not Allowed JSON handler
	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error":  "HTTP method not allowed",
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
		})
	})

	return r
}
