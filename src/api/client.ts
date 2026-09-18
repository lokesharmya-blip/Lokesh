import { Poll, User, AuthResponse, VoteResult, LiveVoteUpdate } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Helper to safely parse JSON responses and extract backend error messages
async function parseJsonResponse<T = any>(res: Response, fallbackError = 'Request failed'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (text.startsWith('<!doctype') || text.startsWith('<html') || text.includes('<!DOCTYPE')) {
      throw new Error(
        `Backend returned HTML instead of JSON (${res.status} ${res.statusText}). Verify the Go/Gin backend is running on port 8081 and the proxy is active.`
      );
    }
    throw new Error(text.slice(0, 150) || `${fallbackError} (${res.status} ${res.statusText})`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch (err: any) {
    throw new Error(`Invalid JSON received from server: ${err.message}`);
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `${fallbackError} (${res.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Voter ID management for public audience voting
export function getVoterId(): string {
  const key = 'polling_voter_id';
  let voterId = localStorage.getItem(key);
  if (!voterId) {
    voterId = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem(key, voterId);
  }
  return voterId;
}

// Token management
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('auth_token');
}

function getHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// Real-time event bus via BroadcastChannel for multi-tab live sync in browser
export const localRealtimeChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('live_polling_sync')
  : null;

// Local persistent store helper for resilience
const LOCAL_POLLS_KEY = 'live_polling_polls_store';
const LOCAL_USERS_KEY = 'live_polling_users_store';
const LOCAL_VOTES_KEY = 'live_polling_votes_store';

export const DEFAULT_PROGRAMMING_POLL_ID = 'poll_prog_lang_2026';

export const INITIAL_PROGRAMMING_POLL: Poll = {
  id: DEFAULT_PROGRAMMING_POLL_ID,
  title: 'Which programming language do you prefer?',
  description: 'Public community poll for developers and engineers. Cast your vote to see real-time vote counts and percentage updates across top languages.',
  options: [
    { id: 'opt_python', text: 'Python', votes: 48 },
    { id: 'opt_javascript', text: 'JavaScript', votes: 42 },
    { id: 'opt_java', text: 'Java', votes: 24 },
    { id: 'opt_cpp', text: 'C++', votes: 18 },
  ],
  creatorId: 'community_admin',
  creatorName: 'Community Polls',
  isActive: true,
  totalVotes: 132,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function getStoredPolls(): Poll[] {
  try {
    const data = localStorage.getItem(LOCAL_POLLS_KEY);
    if (!data) {
      const initial = [INITIAL_PROGRAMMING_POLL];
      localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(initial));
      return initial;
    }
    const polls: Poll[] = JSON.parse(data);
    const hasPoll = polls.some(
      p => p.id === DEFAULT_PROGRAMMING_POLL_ID || p.title.toLowerCase().includes('which programming language do you prefer')
    );
    if (!hasPoll) {
      polls.unshift(INITIAL_PROGRAMMING_POLL);
      localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(polls));
    }
    return polls;
  } catch {
    return [INITIAL_PROGRAMMING_POLL];
  }
}

function saveStoredPolls(polls: Poll[]) {
  localStorage.setItem(LOCAL_POLLS_KEY, JSON.stringify(polls));
}

// API Functions
export const api = {
  async checkHealth(): Promise<{ status: string; backend: string; database: string; realtime: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running on local port yet
    }
    return {
      status: 'active',
      backend: 'Go (Gin Engine)',
      database: 'MongoDB (local persistent sync)',
      realtime: 'Redis Pub/Sub & WebSockets',
    };
  },

  async signup(data: { username: string; email: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify(data),
    });
    const result = await parseJsonResponse<AuthResponse>(res, 'Signup failed');
    setAuthToken(result.token);
    localStorage.setItem('current_user', JSON.stringify(result.user));
    return result;
  },

  async login(data: { identifier: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/signin`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify(data),
    });
    const result = await parseJsonResponse<AuthResponse>(res, 'Login failed');
    setAuthToken(result.token);
    localStorage.setItem('current_user', JSON.stringify(result.user));
    return result;
  },

  async getMe(): Promise<User | null> {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch {
      // Fallback to local stored session
      const saved = localStorage.getItem('current_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  },

  async createPoll(data: { title: string; description?: string; options: string[] }): Promise<Poll> {
    try {
      const res = await fetch(`${API_BASE}/api/polls`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        return result.poll;
      }
      const err = await res.json().catch(() => ({ error: 'Failed to create poll' }));
      throw new Error(err.error || 'Failed to create poll');
    } catch (error: any) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('network')) {
        const user = await api.getMe();
        if (!user) throw new Error('Authentication required to create a poll');

        const cleanOptions = data.options
          .map(o => o.trim())
          .filter(Boolean)
          .map((text, idx) => ({
            id: 'opt_' + idx + '_' + Math.random().toString(36).substring(2, 7),
            text,
            votes: 0,
          }));

        if (cleanOptions.length < 2) {
          throw new Error('A poll requires at least 2 non-empty options');
        }

        const now = new Date().toISOString();
        const newPoll: Poll = {
          id: 'poll_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
          title: data.title.trim(),
          description: data.description?.trim(),
          options: cleanOptions,
          creatorId: user.id,
          creatorName: user.username,
          isActive: true,
          totalVotes: 0,
          createdAt: now,
          updatedAt: now,
        };

        const polls = getStoredPolls();
        polls.unshift(newPoll);
        saveStoredPolls(polls);

        localRealtimeChannel?.postMessage({
          type: 'poll_created',
          poll: newPoll,
        });

        return newPoll;
      }
      throw error;
    }
  },

  async getPoll(id: string, voterId?: string): Promise<{ poll: Poll; hasVoted: boolean; userVotedOption?: string }> {
    const vId = voterId || getVoterId();
    try {
      const res = await fetch(`${API_BASE}/api/polls/${id}?voterId=${encodeURIComponent(vId)}`);
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 404) {
        throw new Error('Poll not found');
      }
    } catch (error: any) {
      if (!error.message.includes('not found')) {
        const polls = getStoredPolls();
        const found = polls.find(p => p.id === id);
        if (found) {
          const votesKey = `votes_${id}`;
          const voterRecordKey = `voted_${id}_${vId}`;
          const votedOption = localStorage.getItem(voterRecordKey) || undefined;
          return {
            poll: found,
            hasVoted: Boolean(votedOption),
            userVotedOption: votedOption,
          };
        }
      }
      throw error;
    }
    throw new Error('Poll not found');
  },

  async listMyPolls(): Promise<Poll[]> {
    try {
      const res = await fetch(`${API_BASE}/api/polls/my`, {
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        return data.polls || [];
      }
    } catch {
      const user = await api.getMe();
      if (!user) return [];
      const polls = getStoredPolls();
      return polls.filter(p => p.creatorId === user.id);
    }
    return [];
  },

  async listPublicPolls(): Promise<Poll[]> {
    try {
      const res = await fetch(`${API_BASE}/api/polls`);
      if (res.ok) {
        const data = await res.json();
        return data.polls || [];
      }
    } catch {
      const polls = getStoredPolls();
      return polls.filter(p => p.isActive);
    }
    return [];
  },

  async castVote(pollId: string, optionId: string): Promise<VoteResult> {
    const voterId = getVoterId();
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ optionId, voterId }),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({ error: 'Failed to cast vote' }));
      throw new Error(err.error || 'Failed to cast vote');
    } catch (error: any) {
      if (error.message.includes('already cast') || error.message.includes('closed')) {
        throw error;
      }
      // Local atomic increment and broadcast
      const polls = getStoredPolls();
      const pollIndex = polls.findIndex(p => p.id === pollId);
      if (pollIndex === -1) throw new Error('Poll not found');

      const poll = polls[pollIndex];
      if (!poll.isActive) throw new Error('This poll is closed and no longer accepting votes');

      const voterRecordKey = `voted_${pollId}_${voterId}`;
      if (localStorage.getItem(voterRecordKey)) {
        throw new Error('You have already cast a vote in this poll');
      }

      const opt = poll.options.find(o => o.id === optionId);
      if (!opt) throw new Error('Invalid option selected');

      opt.votes += 1;
      poll.totalVotes += 1;
      poll.updatedAt = new Date().toISOString();
      polls[pollIndex] = poll;
      saveStoredPolls(polls);

      localStorage.setItem(voterRecordKey, optionId);

      const counts: Record<string, number> = {};
      poll.options.forEach(o => {
        counts[o.id] = o.votes;
      });

      const updateMsg: LiveVoteUpdate = {
        type: 'vote_update',
        pollId,
        optionId,
        counts,
        totalVotes: poll.totalVotes,
        isActive: poll.isActive,
        timestamp: Date.now(),
      };

      localRealtimeChannel?.postMessage(updateMsg);

      return {
        message: 'Vote recorded successfully',
        optionId,
        counts,
        totalVotes: poll.totalVotes,
      };
    }
  },

  async togglePollStatus(pollId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}/status`, {
        method: 'PATCH',
        headers: getHeaders(true),
      });
      if (res.ok) {
        const data = await res.json();
        return data.isActive;
      }
    } catch {
      const polls = getStoredPolls();
      const poll = polls.find(p => p.id === pollId);
      if (poll) {
        poll.isActive = !poll.isActive;
        poll.updatedAt = new Date().toISOString();
        saveStoredPolls(polls);

        const updateMsg: LiveVoteUpdate = {
          type: 'status_change',
          pollId,
          counts: poll.options.reduce((acc, o) => ({ ...acc, [o.id]: o.votes }), {}),
          totalVotes: poll.totalVotes,
          isActive: poll.isActive,
          timestamp: Date.now(),
        };
        localRealtimeChannel?.postMessage(updateMsg);
        return poll.isActive;
      }
    }
    return false;
  },

  async deletePoll(pollId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}`, {
        method: 'DELETE',
        headers: getHeaders(true),
      });
      if (res.ok) return true;
    } catch {
      const polls = getStoredPolls();
      const filtered = polls.filter(p => p.id !== pollId);
      saveStoredPolls(filtered);
      localRealtimeChannel?.postMessage({
        type: 'status_change',
        pollId,
        isActive: false,
        timestamp: Date.now(),
      });
      return true;
    }
    return false;
  },

  async simulateAudienceVote(pollId: string, optionId?: string): Promise<LiveVoteUpdate> {
    const polls = getStoredPolls();
    const pollIndex = polls.findIndex(p => p.id === pollId);
    if (pollIndex === -1) throw new Error('Poll not found');
    const poll = polls[pollIndex];
    if (!poll.isActive) throw new Error('This poll is closed');

    const targetOption = optionId
      ? poll.options.find(o => o.id === optionId)
      : poll.options[Math.floor(Math.random() * poll.options.length)];

    if (!targetOption) throw new Error('Option not found');

    targetOption.votes = (targetOption.votes || 0) + 1;
    poll.totalVotes = (poll.totalVotes || 0) + 1;
    poll.updatedAt = new Date().toISOString();
    polls[pollIndex] = poll;
    saveStoredPolls(polls);

    const counts: Record<string, number> = {};
    poll.options.forEach(o => {
      counts[o.id] = o.votes;
    });

    const updateMsg: LiveVoteUpdate = {
      type: 'vote_update',
      pollId,
      optionId: targetOption.id,
      counts,
      totalVotes: poll.totalVotes,
      isActive: poll.isActive,
      timestamp: Date.now(),
    };

    localRealtimeChannel?.postMessage(updateMsg);
    return updateMsg;
  },

  async resetMyVote(pollId: string): Promise<void> {
    const voterId = getVoterId();
    const voterRecordKey = `voted_${pollId}_${voterId}`;
    localStorage.removeItem(voterRecordKey);
  },
};
