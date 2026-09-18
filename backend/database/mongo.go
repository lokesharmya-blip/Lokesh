package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	MongoClient *mongo.Client
	MongoDB     *mongo.Database
)

func ConnectMongo(uri, dbName string) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, err
	}

	// Ping MongoDB to confirm connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	log.Printf("Successfully connected to MongoDB at %s (database: %s)", uri, dbName)
	MongoClient = client
	MongoDB = client.Database(dbName)
	return MongoDB, nil
}
