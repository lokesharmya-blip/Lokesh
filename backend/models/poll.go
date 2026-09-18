package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollOption struct {
	ID    string `bson:"id" json:"id"`
	Text  string `bson:"text" json:"text"`
	Votes int64  `bson:"votes" json:"votes"`
}

type Poll struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description,omitempty" json:"description,omitempty"`
	Options     []PollOption       `bson:"options" json:"options"`
	CreatorID   primitive.ObjectID `bson:"creatorId" json:"creatorId"`
	CreatorName string             `bson:"creatorName" json:"creatorName"`
	IsActive    bool               `bson:"isActive" json:"isActive"`
	TotalVotes  int64              `bson:"totalVotes" json:"totalVotes"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type CreatePollRequest struct {
	Title       string   `json:"title" binding:"required,min=5,max=200"`
	Description string   `json:"description" binding:"max=500"`
	Options     []string `json:"options" binding:"required,min=2,dive,required,min=1,max=100"`
}

type VoteRequest struct {
	OptionID string `json:"optionId" binding:"required"`
	VoterID  string `json:"voterId"` // client-side fingerprint/UUID token for duplicate detection
}

type LiveVoteUpdate struct {
	Type       string           `json:"type"` // "vote_update", "status_change", "initial_sync"
	PollID     string           `json:"pollId"`
	OptionID   string           `json:"optionId,omitempty"`
	Counts     map[string]int64 `json:"counts"`
	TotalVotes int64            `json:"totalVotes"`
	IsActive   bool             `json:"isActive"`
	Timestamp  int64            `json:"timestamp"`
}
