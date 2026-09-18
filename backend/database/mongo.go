package database

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

var (
	MongoClient     *mongo.Client
	MongoDB         *mongo.Database
	ConnectedDBName string
	IsConnected     bool
)

// ConnectMongo initializes and validates the MongoDB client and database
func ConnectMongo(uri, dbName string) (*mongo.Database, error) {
	log.Println("==================================================")
	log.Println("[MongoDB] Initializing database connection...")

	clientOptions := options.Client().ApplyURI(uri)
	clientOptions.SetServerSelectionTimeout(10 * time.Second)
	clientOptions.SetConnectTimeout(10 * time.Second)
	clientOptions.SetSocketTimeout(30 * time.Second)
	clientOptions.SetMaxPoolSize(50)
	clientOptions.SetMinPoolSize(5)
	clientOptions.SetMaxConnIdleTime(60 * time.Second)
	clientOptions.SetAppName("LivePolling-GoGin")

	// Create Mongo client
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Printf("[MongoDB ERROR] Failed to create client for %s: %v", maskURI(uri), err)
		return nil, fmt.Errorf("mongo client creation failed: %w", err)
	}

	// Retry ping up to 3 times with backoff
	var lastPingErr error
	var latency time.Duration

	for attempt := 1; attempt <= 3; attempt++ {
		start := time.Now()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err = client.Ping(ctx, readpref.Primary())
		cancel()

		if err == nil {
			latency = time.Since(start)
			lastPingErr = nil
			break
		}

		lastPingErr = err
		log.Printf("[MongoDB WARNING] Ping attempt %d/3 failed: %v", attempt, err)
		if attempt < 3 {
			time.Sleep(time.Duration(attempt) * time.Second)
		}
	}

	if lastPingErr != nil {
		diagnosticMsg := formatAtlasDiagnostics(uri, lastPingErr)
		log.Printf("[MongoDB ERROR] Failed to connect to MongoDB:\n%s", diagnosticMsg)
		return nil, fmt.Errorf("mongodb ping failed: %w", lastPingErr)
	}

	MongoClient = client
	MongoDB = client.Database(dbName)
	ConnectedDBName = dbName
	IsConnected = true

	log.Printf("[MongoDB SUCCESS] Connected to %s", maskURI(uri))
	log.Printf("[MongoDB SUCCESS] Active Database: '%s'", dbName)
	log.Printf("[MongoDB SUCCESS] Ping latency: %v", latency)

	// Ensure collections and unique indexes are established
	initIndexes(MongoDB)

	log.Println("==================================================")
	return MongoDB, nil
}

// CheckDatabaseConnection checks the current connection state and roundtrip latency
func CheckDatabaseConnection(ctx context.Context) (time.Duration, error) {
	if MongoClient == nil || MongoDB == nil {
		return 0, fmt.Errorf("mongodb client is not initialized")
	}

	start := time.Now()
	if err := MongoClient.Ping(ctx, readpref.Primary()); err != nil {
		IsConnected = false
		return 0, err
	}
	IsConnected = true
	return time.Since(start), nil
}

// initIndexes configures database indexes for fast lookups and consistency
func initIndexes(db *mongo.Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Users collection indexes: Unique username and Unique email
	userCol := db.Collection("users")
	userIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "username", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("unique_username"),
		},
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("unique_email"),
		},
	}
	if _, err := userCol.Indexes().CreateMany(ctx, userIndexes); err != nil {
		log.Printf("[MongoDB Index Note] User indexes created/verified (err: %v)", err)
	} else {
		log.Println("[MongoDB Index] Users unique indexes (username, email) verified.")
	}

	// 2. Polls collection indexes: creatorId, createdAt
	pollCol := db.Collection("polls")
	pollIndexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "creatorId", Value: 1}},
			Options: options.Index().SetName("creator_polls"),
		},
		{
			Keys:    bson.D{{Key: "createdAt", Value: -1}},
			Options: options.Index().SetName("recent_polls"),
		},
		{
			Keys:    bson.D{{Key: "isActive", Value: 1}},
			Options: options.Index().SetName("active_polls"),
		},
	}
	if _, err := pollCol.Indexes().CreateMany(ctx, pollIndexes); err != nil {
		log.Printf("[MongoDB Index Note] Poll indexes created/verified (err: %v)", err)
	} else {
		log.Println("[MongoDB Index] Poll indexes verified.")
	}
}

// maskURI redacts password from connection URI
func maskURI(uri string) string {
	if strings.Contains(uri, "@") {
		parts := strings.Split(uri, "@")
		prefix := parts[0]
		if slashIdx := strings.LastIndex(prefix, "//"); slashIdx != -1 {
			return prefix[:slashIdx+2] + "***:***@" + parts[1]
		}
		return "***:***@" + parts[1]
	}
	return uri
}

// formatAtlasDiagnostics gives actionable hints if MongoDB Atlas connection fails
func formatAtlasDiagnostics(uri string, err error) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("  - Target: %s\n", maskURI(uri)))
	sb.WriteString(fmt.Sprintf("  - Error:  %v\n", err))

	if strings.HasPrefix(uri, "mongodb+srv://") || strings.Contains(uri, "mongodb.net") {
		sb.WriteString("  - Tips for MongoDB Atlas:\n")
		sb.WriteString("    1. Network Access / IP Whitelist: Ensure 0.0.0.0/0 is whitelisted in Atlas Network Access.\n")
		sb.WriteString("    2. Database User: Ensure user exists and has readWriteAnyDatabase or readWrite privileges.\n")
		sb.WriteString("    3. Special characters in password: URL-encode special characters in password (e.g. '@' -> '%40', ':' -> '%3A').\n")
		sb.WriteString("    4. Cluster state: Verify the Atlas cluster is active and not paused.\n")
	} else {
		sb.WriteString("  - Tips for local MongoDB:\n")
		sb.WriteString("    1. Verify mongod process is running on localhost:27017.\n")
		sb.WriteString("    2. Check that no stale mongod.lock file exists.\n")
	}
	return sb.String()
}

