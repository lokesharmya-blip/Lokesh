package config

import (
	"bufio"
	"log"
	"os"
	"strings"

	"go.mongodb.org/mongo-driver/x/mongo/driver/connstring"
)

type Config struct {
	Port        string
	MongoURI    string
	MongoDBName string
	RedisAddr   string
	RedisPass   string
	JWTSecret   string
}

// loadDotEnv loads simple KEY=VALUE pairs from a file if it exists
func loadDotEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			// remove quotes if present
			if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
				val = val[1 : len(val)-1]
			}
			// Only set if not already present in environment
			if os.Getenv(key) == "" {
				os.Setenv(key, val)
			}
		}
	}
}

func LoadConfig() *Config {
	// Attempt to load .env from common relative paths
	loadDotEnv(".env")
	loadDotEnv("../.env")
	loadDotEnv("backend/.env")

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
		// Attempt to extract database name from MongoURI (e.g. Atlas connection string)
		if cs, err := connstring.ParseAndValidate(mongoURI); err == nil && cs.Database != "" {
			mongoDBName = cs.Database
			log.Printf("[Config] Extracted database name '%s' from MONGO_URI", mongoDBName)
		} else {
			mongoDBName = "live_polling_db"
		}
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

// MaskedMongoURI returns the connection string with credentials redacted for safe logging
func (c *Config) MaskedMongoURI() string {
	cs, err := connstring.ParseAndValidate(c.MongoURI)
	if err != nil {
		// If custom or parsing error, mask user:pass if present
		if strings.Contains(c.MongoURI, "@") {
			parts := strings.Split(c.MongoURI, "@")
			prefix := parts[0]
			if slashIdx := strings.LastIndex(prefix, "//"); slashIdx != -1 {
				return prefix[:slashIdx+2] + "***:***@" + parts[1]
			}
			return "***:***@" + parts[1]
		}
		return c.MongoURI
	}

	if cs.Username != "" {
		masked := c.MongoURI
		if cs.Password != "" {
			masked = strings.Replace(masked, ":"+cs.Password+"@", ":******@", 1)
		}
		return masked
	}

	return c.MongoURI
}

