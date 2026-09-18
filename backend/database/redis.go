package database

import (
	"context"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
)

var (
	RedisClient *redis.Client
)

func ConnectRedis(addr, password string) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pong, err := client.Ping(ctx).Result()
	if err != nil {
		return nil, err
	}

	log.Printf("Successfully connected to Redis at %s (Ping response: %s)", addr, pong)
	RedisClient = client
	return RedisClient, nil
}
