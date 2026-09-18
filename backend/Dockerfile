# Multi-stage build for Go Gin Backend
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git and build dependencies
RUN apk add --no-cache git

# Copy dependency files
COPY go.mod go.sum* ./
RUN go mod download || true

# Copy source code
COPY . .

# Ensure dependencies are tidy and build statically linked binary
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server main.go

# Minimal production runtime image
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server /app/server

EXPOSE 8080

ENV PORT=8080 \
    MONGO_URI=mongodb://mongo:27017 \
    MONGO_DB_NAME=live_polling_db \
    REDIS_ADDR=redis:6379 \
    JWT_SECRET=production-live-polling-secret-key-2026

CMD ["/app/server"]
