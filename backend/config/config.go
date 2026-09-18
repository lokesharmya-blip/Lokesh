package config

import (
	"os"
)

type Config struct {
	Port        string
	MongoURI    string
	MongoDBName string
	RedisAddr   string
	RedisPass   string
	JWTSecret   string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://127.0.0.1:27017"
	}

	mongoDBName := os.Getenv("MONGO_DB_NAME")
	if mongoDBName == "" {
		mongoDBName = "live_polling_db"
	}

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "127.0.0.1:6379"
	}

	redisPass := os.Getenv("REDIS_PASS")

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "polling-app-super-secret-key-2026-internship"
	}

	return &Config{
		Port:        port,
		MongoURI:    mongoURI,
		MongoDBName: mongoDBName,
		RedisAddr:   redisAddr,
		RedisPass:   redisPass,
		JWTSecret:   jwtSecret,
	}
}
