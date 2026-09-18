package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Vote struct {
	ID        primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	PollID    primitive.ObjectID  `bson:"pollId" json:"pollId"`
	OptionID  string              `bson:"optionId" json:"optionId"`
	VoterID   string              `bson:"voterId" json:"voterId"`
	VoterIP   string              `bson:"voterIp,omitempty" json:"-"`
	UserID    *primitive.ObjectID `bson:"userId,omitempty" json:"userId,omitempty"` // optional if authenticated voter
	CreatedAt time.Time           `bson:"createdAt" json:"createdAt"`
}
