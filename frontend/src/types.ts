export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  creatorId: string;
  creatorName: string;
  isActive: boolean;
  totalVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveVoteUpdate {
  type: 'vote_update' | 'status_change' | 'initial_sync';
  pollId: string;
  optionId?: string;
  counts: Record<string, number>;
  totalVotes: number;
  isActive?: boolean;
  timestamp: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface VoteResult {
  message: string;
  optionId: string;
  counts: Record<string, number>;
  totalVotes: number;
}
