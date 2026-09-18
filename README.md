# Live Polling Web Application

A high-performance, real-time live polling web application built for instant audience engagement. Designed with a clear separation of concerns between a **Go (Gin)** backend, **MongoDB** persistent document store, **Redis** in-memory atomic counter and pub/sub engine, and a modern **React** frontend.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                    │
│      - Audience Voting View  - Creator Dashboard - Auth     │
└──────────────┬───────────────────────────────▲──────────────┘
               │ HTTP / JSON                   │ WebSocket / SSE
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                  Go / Gin Backend Server                    │
│   - Input Validation (Gin Binding)                          │
│   - JWT Auth Middleware & Route Guards                      │
│   - Concurrency & Thread-safe Realtime Hub                  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       Pub/Sub │ Atomic Counts         Persist │ Documents
       & Cache │ & Deduplication               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│         Redis 7.2            │ │         MongoDB 7.0         │
│ - Pub/Sub: `poll:<id>:events`│ │ - Collection: `users`       │
│ - Hash: `poll:<id>:counts`   │ │ - Collection: `polls`       │
│ - Set: `poll:<id>:voters`    │ │ - Collection: `votes`       │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 📁 Repository Structure

The project strictly isolates frontend and backend concerns:

```
├── backend/
│   ├── config/             # Environment variable loader
│   ├── controllers/        # Auth, Poll, and Vote controllers
│   ├── database/           # MongoDB and Redis connection clients
│   ├── middleware/         # JWT Authentication and CORS handlers
│   ├── models/             # BSON/JSON schemas (User, Poll, Vote)
│   ├── router/             # Gin route registration & health checks
│   ├── services/           # Redis Pub/Sub, WebSockets & SSE RealtimeHub
│   ├── Dockerfile          # Multi-stage production container build
│   ├── go.mod              # Go module definitions
│   └── main.go             # Application entry point
│
├── frontend/
│   ├── src/
│   │   ├── api/            # API client and local sync bridge
│   │   ├── components/     # Voting view, Dashboard, Cards, Modals, Navbar
│   │   ├── context/        # Auth Context provider
│   │   ├── hooks/          # Real-time WebSocket / SSE poll hook
│   │   ├── types.ts        # TypeScript interfaces and contracts
│   │   ├── App.tsx         # Main UI router and state orchestrator
│   │   └── main.tsx        # React entry point
│   ├── package.json        # Frontend dependencies
│   └── vite.config.ts      # Vite bundler configuration
│
├── docker-compose.yml      # Orchestrates Go, MongoDB, Redis, and React
├── Dockerfile.frontend     # Frontend Nginx production container
└── README.md               # Technical specification and documentation
```

---

## 🚀 Quick Start & Setup

### Option 1: Run via Docker Compose (Recommended)

To launch the full production stack (Go Backend, MongoDB, Redis, and React Frontend) in a single command:

```bash
docker-compose up --build
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Go Backend API**: [http://localhost:8080](http://localhost:8080)
- **MongoDB**: `localhost:27017`
- **Redis**: `localhost:6379`

### Option 2: Run Manually

#### 1. Prerequisites
- **Go**: 1.22+
- **Node.js**: 20+ & npm
- **MongoDB**: 6.0+ running on `localhost:27017`
- **Redis**: 7.0+ running on `localhost:6379`

#### 2. Start the Go Backend
```bash
cd backend
go mod tidy
go run main.go
```
The Gin server will listen on `0.0.0.0:8080`.

#### 3. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
The Vite dev server will start on [http://localhost:3000](http://localhost:3000).

---

## 🔐 Environment Variables

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Port for the Go/Gin HTTP server |
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection URI |
| `MONGO_DB_NAME` | `live_polling_db` | MongoDB database name |
| `REDIS_ADDR` | `localhost:6379` | Redis server address |
| `REDIS_PASS` | `""` | Redis authentication password |
| `JWT_SECRET` | `super-secret-jwt-key-2026` | Secret key for signing and verifying JWT tokens |
| `VITE_API_URL` | `http://localhost:8080` | Target URL for the React API client |

---

## 📡 API Endpoints Specification

### 1. Health & Status
- **`GET /api/health`**
  - Returns backend engine, MongoDB connection, and Redis status.

### 2. Authentication
- **`POST /api/auth/signup`**
  - Body: `{ "username": "...", "email": "...", "password": "..." }`
  - Validates password length and uniqueness; returns signed JWT and user profile.
- **`POST /api/auth/login`**
  - Body: `{ "identifier": "...", "password": "..." }`
  - Accepts username or email; returns signed JWT token.
- **`GET /api/auth/me`** (Protected)
  - Headers: `Authorization: Bearer <token>`
  - Returns the currently authenticated user profile.

### 3. Poll Management
- **`GET /api/polls`** (Public)
  - Lists all active public polls.
- **`GET /api/polls/:id`** (Public)
  - Query: `?voterId=<id>`
  - Retrieves poll metadata, current option vote tallies, and checks whether the voter has already voted.
- **`POST /api/polls`** (Protected)
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "title": "...", "description": "...", "options": ["A", "B", "C"] }`
  - Creates a new poll in MongoDB and seeds initial counts in Redis.
- **`GET /api/polls/my`** (Protected)
  - Returns polls created by the authenticated user.
- **`PATCH /api/polls/:id/status`** (Protected)
  - Toggles poll status between active and closed.
- **`DELETE /api/polls/:id`** (Protected)
  - Deletes poll from MongoDB and flushes associated Redis keys.

### 4. Voting & Realtime Streaming
- **`POST /api/polls/:id/vote`** (Public with optional Auth)
  - Body: `{ "optionId": "...", "voterId": "..." }`
  - Validates option and poll status, performs atomic `HINCRBY` in Redis, records deduplication in Redis Set, persists vote in MongoDB, and publishes update to Redis channel.
- **`GET /ws/polls/:id`** (WebSocket)
  - Full-duplex WebSocket connection streaming live vote count updates.
- **`GET /api/polls/:id/events`** (Server-Sent Events)
  - HTTP streaming fallback for clients behind strict corporate proxies.

---

## 🧠 Technical Decisions & Trade-offs

### 1. Atomic In-Memory Vote Counting with Redis
- **Decision**: Vote counters are incremented directly in Redis using `HINCRBY poll:<id>:counts <option_id> 1`.
- **Reasoning**: In live voting scenarios (e.g. keynotes, webinars), thousands of audience members vote within the same second. Writing directly to a disk-based database for every single vote causes write contention and lock bottlenecks. Redis handles over 100,000 ops/sec in-memory with sub-millisecond latency.

### 2. High-Speed Duplicate Vote Mitigation
- **Decision**: A Redis Set (`SADD poll:<id>:voters <voter_key>`) is checked atomically before executing the vote increment.
- **Reasoning**: By combining IP addresses and persistent client voter IDs, duplicate votes are rejected in $O(1)$ memory lookup before touching MongoDB, preventing denial-of-service and database contention.

### 3. Redis Pub/Sub Fanout with Concurrency-Safe Hub
- **Decision**: Go backend subscribes to `poll:<id>:events` and broadcasts payloads through a mutex-protected connection map (`sync.RWMutex`).
- **Reasoning**: If the backend scales to multiple instances behind a load balancer, Redis Pub/Sub guarantees that a vote received by Instance A is instantly published to clients connected to Instance B without shared local memory.

### 4. Dual-Stream Protocol: WebSocket + SSE Fallback
- **Decision**: Provide both `/ws/polls/:id` and `/api/polls/:id/events`.
- **Reasoning**: WebSockets provide minimal overhead for bi-directional live updates. However, certain mobile networks or corporate proxy firewalls terminate persistent WebSocket handshakes. The SSE fallback guarantees zero loss of real-time functionality for all audience devices.

### 5. Input Validation & Defense-in-Depth
- **Decision**: Strict Go struct tags (`binding:"required,min=5,max=200"`) and regex validation for all API inputs before executing any database query.
- **Reasoning**: Eliminates malformed payloads and protects backend infrastructure against injection attempts and resource exhaustion.
