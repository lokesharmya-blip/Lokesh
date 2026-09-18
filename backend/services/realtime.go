package services

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"polling-backend/database"
	"polling-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin for development & preview
	},
}

type SSEClient struct {
	channel chan []byte
}

type RealtimeHub struct {
	mu         sync.RWMutex
	wsClients  map[string]map[*websocket.Conn]bool
	sseClients map[string]map[chan []byte]bool
}

var Hub = &RealtimeHub{
	wsClients:  make(map[string]map[*websocket.Conn]bool),
	sseClients: make(map[string]map[chan []byte]bool),
}

// StartRedisSubscriber starts a background listener on Redis Pub/Sub channels
func StartRedisSubscriber() {
	go func() {
		ctx := context.Background()
		pubsub := database.RedisClient.PSubscribe(ctx, "poll:*:events")
		defer pubsub.Close()

		ch := pubsub.Channel()
		log.Println("Redis PubSub subscriber started, listening to poll:*:events")

		for msg := range ch {
			var update models.LiveVoteUpdate
			if err := json.Unmarshal([]byte(msg.Payload), &update); err != nil {
				log.Printf("Error unmarshaling redis pubsub payload: %v", err)
				continue
			}

			// Broadcast to local WS and SSE clients
			Hub.BroadcastLocally(update.PollID, []byte(msg.Payload))
		}
	}()
}

// PublishUpdate publishes a live update to Redis Pub/Sub
func PublishUpdate(update models.LiveVoteUpdate) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	payload, err := json.Marshal(update)
	if err != nil {
		return err
	}

	channel := "poll:" + update.PollID + ":events"
	return database.RedisClient.Publish(ctx, channel, string(payload)).Err()
}

func (h *RealtimeHub) BroadcastLocally(pollID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// 1. Broadcast to WebSockets
	if clients, ok := h.wsClients[pollID]; ok {
		for conn := range clients {
			err := conn.WriteMessage(websocket.TextMessage, data)
			if err != nil {
				log.Printf("Error writing to WS client on poll %s: %v", pollID, err)
				_ = conn.Close()
			}
		}
	}

	// 2. Broadcast to SSE clients
	if sseList, ok := h.sseClients[pollID]; ok {
		for clientChan := range sseList {
			select {
			case clientChan <- data:
			default:
				// non-blocking if client buffer is full
			}
		}
	}
}

// HandleWebSocket upgrades and handles live poll WebSocket connections
func HandleWebSocket(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "poll ID is required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Register client
	Hub.mu.Lock()
	if Hub.wsClients[pollID] == nil {
		Hub.wsClients[pollID] = make(map[*websocket.Conn]bool)
	}
	Hub.wsClients[pollID][conn] = true
	Hub.mu.Unlock()

	// Cleanup on disconnect
	defer func() {
		Hub.mu.Lock()
		if Hub.wsClients[pollID] != nil {
			delete(Hub.wsClients[pollID], conn)
			if len(Hub.wsClients[pollID]) == 0 {
				delete(Hub.wsClients, pollID)
			}
		}
		Hub.mu.Unlock()
	}()

	// Send current live counts immediately on connect
	counts, total, err := GetLiveCountsFromRedis(pollID)
	if err == nil {
		initial := models.LiveVoteUpdate{
			Type:       "initial_sync",
			PollID:     pollID,
			Counts:     counts,
			TotalVotes: total,
			Timestamp:  time.Now().UnixMilli(),
		}
		if b, err := json.Marshal(initial); err == nil {
			_ = conn.WriteMessage(websocket.TextMessage, b)
		}
	}

	// Ping/pong heartbeat keepalive
	conn.SetReadLimit(512)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// HandleSSE streams live poll updates using Server-Sent Events
func HandleSSE(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "poll ID is required"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	messageChan := make(chan []byte, 10)

	Hub.mu.Lock()
	if Hub.sseClients[pollID] == nil {
		Hub.sseClients[pollID] = make(map[chan []byte]bool)
	}
	Hub.sseClients[pollID][messageChan] = true
	Hub.mu.Unlock()

	defer func() {
		Hub.mu.Lock()
		if Hub.sseClients[pollID] != nil {
			delete(Hub.sseClients[pollID], messageChan)
			if len(Hub.sseClients[pollID]) == 0 {
				delete(Hub.sseClients, pollID)
			}
		}
		Hub.mu.Unlock()
		close(messageChan)
	}()

	// Send initial state
	counts, total, err := GetLiveCountsFromRedis(pollID)
	if err == nil {
		initial := models.LiveVoteUpdate{
			Type:       "initial_sync",
			PollID:     pollID,
			Counts:     counts,
			TotalVotes: total,
			Timestamp:  time.Now().UnixMilli(),
		}
		if b, err := json.Marshal(initial); err == nil {
			c.SSEvent("message", string(b))
			c.Writer.Flush()
		}
	}

	notify := c.Writer.CloseNotify()
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-notify:
			return
		case <-ticker.C:
			// heartbeat comment to keep SSE connection alive
			c.Writer.Write([]byte(": ping\n\n"))
			c.Writer.Flush()
		case msg, ok := <-messageChan:
			if !ok {
				return
			}
			c.SSEvent("message", string(msg))
			c.Writer.Flush()
		}
	}
}

// GetLiveCountsFromRedis retrieves the current real-time counts stored in Redis hash
func GetLiveCountsFromRedis(pollID string) (map[string]int64, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	hashKey := "poll:" + pollID + ":counts"
	vals, err := database.RedisClient.HGetAll(ctx, hashKey).Result()
	if err != nil {
		return nil, 0, err
	}

	counts := make(map[string]int64)
	var total int64 = 0

	for k, vStr := range vals {
		var cnt int64
		for _, ch := range vStr {
			if ch >= '0' && ch <= '9' {
				cnt = cnt*10 + int64(ch-'0')
			}
		}
		counts[k] = cnt
		total += cnt
	}

	return counts, total, nil
}
