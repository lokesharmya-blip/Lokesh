package main

import (
	"log"

	"polling-backend/config"
	"polling-backend/database"
	"polling-backend/router"
	"polling-backend/services"
)

func main() {
	cfg := config.LoadConfig()

	log.Println("Starting Live Polling Go Backend...")

	// 1. Connect to MongoDB
	_, err := database.ConnectMongo(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// 2. Connect to Redis
	_, err = database.ConnectRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// 3. Start Redis Pub/Sub subscriber for real-time fanout
	services.StartRedisSubscriber()

	// 4. Initialize Gin Engine and Routes
	r := router.SetupRouter(cfg)

	// 5. Start listening on configured port
	listenAddr := "0.0.0.0:" + cfg.Port
	log.Printf("Go/Gin Live Polling server listening on %s", listenAddr)
	if err := r.Run(listenAddr); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
