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

	log.Println("==================================================")
	log.Println(" Starting Live Polling Go Backend (Gin Engine)   ")
	log.Printf(" Configured Port:      %s", cfg.Port)
	log.Printf(" MongoDB Target:       %s", cfg.MaskedMongoURI())
	log.Printf(" MongoDB Database:     %s", cfg.MongoDBName)
	log.Printf(" Redis Address:        %s", cfg.RedisAddr)
	log.Println("==================================================")

	// 1. Connect to MongoDB (local or MongoDB Atlas)
	_, err := database.ConnectMongo(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		log.Fatalf("[FATAL] Startup aborted: MongoDB connection failed: %v", err)
	}

	// 2. Connect to Redis for real-time counters & pub/sub
	_, err = database.ConnectRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		log.Fatalf("[FATAL] Startup aborted: Redis connection failed: %v", err)
	}

	// 3. Start Redis Pub/Sub subscriber for real-time fanout
	services.StartRedisSubscriber()

	// 4. Initialize Gin Engine and Routes
	r := router.SetupRouter(cfg)

	// 5. Start listening on configured port
	listenAddr := "0.0.0.0:" + cfg.Port
	log.Printf(">> Live Polling API listening on http://%s", listenAddr)
	if err := r.Run(listenAddr); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}

