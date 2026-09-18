import { useEffect, useState, useRef, useCallback } from 'react';
import { LiveVoteUpdate, Poll } from '../types';
import { localRealtimeChannel } from '../api/client';

interface UseRealtimePollOptions {
  pollId: string;
  initialPoll?: Poll;
  onUpdate?: (update: LiveVoteUpdate) => void;
}

export function useRealtimePoll({ pollId, initialPoll, onUpdate }: UseRealtimePollOptions) {
  const [poll, setPoll] = useState<Poll | undefined>(initialPoll);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [isPulsing, setIsPulsing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync initialPoll changes
  useEffect(() => {
    if (initialPoll) {
      setPoll(initialPoll);
    }
  }, [initialPoll]);

  // Apply update to poll state
  const handleLiveUpdate = useCallback((update: LiveVoteUpdate) => {
    if (update.pollId !== pollId) return;

    setPoll(prev => {
      if (!prev) return prev;

      const updatedOptions = prev.options.map(opt => {
        if (update.counts && update.counts[opt.id] !== undefined) {
          return { ...opt, votes: update.counts[opt.id] };
        }
        return opt;
      });

      return {
        ...prev,
        options: updatedOptions,
        totalVotes: update.totalVotes !== undefined ? update.totalVotes : prev.totalVotes,
        isActive: update.isActive !== undefined ? update.isActive : prev.isActive,
      };
    });

    setLastUpdated(Date.now());
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 800);

    if (onUpdate) {
      onUpdate(update);
    }
  }, [pollId, onUpdate]);

  useEffect(() => {
    if (!pollId) return;

    let isSubscribed = true;

    // 1. Subscribe to local multi-tab BroadcastChannel
    const handleBroadcastMessage = (event: MessageEvent) => {
      const data: LiveVoteUpdate = event.data;
      if (data && (data.type === 'vote_update' || data.type === 'status_change')) {
        handleLiveUpdate(data);
      }
    };

    if (localRealtimeChannel) {
      localRealtimeChannel.addEventListener('message', handleBroadcastMessage);
    }

    // 2. Try connecting to Go/Gin WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/polls/${pollId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isSubscribed) {
          setIsConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const update: LiveVoteUpdate = JSON.parse(event.data);
          handleLiveUpdate(update);
        } catch {
          // ignore non-json
        }
      };

      ws.onerror = () => {
        // Fallback to Server-Sent Events if WebSocket cannot connect through proxy
        tryFallbackSSE();
      };

      ws.onclose = () => {
        if (isSubscribed) {
          setIsConnected(false);
        }
      };
    } catch {
      tryFallbackSSE();
    }

    function tryFallbackSSE() {
      if (!isSubscribed) return;
      try {
        const sse = new EventSource(`/api/polls/${pollId}/events`);
        eventSourceRef.current = sse;

        sse.onopen = () => {
          if (isSubscribed) setIsConnected(true);
        };

        sse.onmessage = (event) => {
          try {
            const update: LiveVoteUpdate = JSON.parse(event.data);
            handleLiveUpdate(update);
          } catch {
            // ignore
          }
        };

        sse.onerror = () => {
          // SSE closed; keep local tab sync active
          if (isSubscribed) setIsConnected(true); // BroadcastChannel remains active
        };
      } catch {
        setIsConnected(true);
      }
    }

    return () => {
      isSubscribed = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (localRealtimeChannel) {
        localRealtimeChannel.removeEventListener('message', handleBroadcastMessage);
      }
    };
  }, [pollId, handleLiveUpdate]);

  return {
    poll,
    setPoll,
    isConnected,
    lastUpdated,
    isPulsing,
  };
}
