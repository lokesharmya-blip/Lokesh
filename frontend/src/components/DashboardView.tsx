import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Poll } from '../types';
import { api } from '../api/client';
import { PollCard } from './PollCard';
import { Plus, BarChart3, Radio, Users, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

interface DashboardViewProps {
  onSelectPoll: (pollId: string) => void;
  onOpenCreate: () => void;
  onOpenAuth: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectPoll,
  onOpenCreate,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [notification, setNotification] = useState<string | null>(null);

  const loadMyPolls = async () => {
    setIsLoading(true);
    try {
      const data = await api.listMyPolls();
      setPolls(data);
    } catch {
      setPolls([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMyPolls();
    }
  }, [user]);

  const handleToggleStatus = async (pollId: string) => {
    try {
      const updatedStatus = await api.togglePollStatus(pollId);
      setPolls(prev =>
        prev.map(p => (p.id === pollId ? { ...p, isActive: updatedStatus } : p))
      );
      showNotice(updatedStatus ? 'Poll reopened for live voting' : 'Poll closed successfully');
    } catch (err: any) {
      showNotice(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll and all its recorded votes?')) return;
    try {
      await api.deletePoll(pollId);
      setPolls(prev => prev.filter(p => p.id !== pollId));
      showNotice('Poll deleted successfully');
    } catch (err: any) {
      showNotice(err.message || 'Failed to delete poll');
    }
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-neutral-200 text-center shadow-xs">
        <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Creator Dashboard</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Sign in or register to view and manage your created live polls, toggle voting states, and track real-time audience responses.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-2.5 px-4 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  // Summary Metrics
  const totalCreated = polls.length;
  const activeCount = polls.filter(p => p.isActive).length;
  const totalVotesReceived = polls.reduce((sum, p) => sum + (p.totalVotes || 0), 0);

  const filteredPolls = polls.filter(p => {
    if (filter === 'active') return p.isActive;
    if (filter === 'closed') return !p.isActive;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Creator Dashboard
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Logged in as <strong className="text-neutral-800">{user.username}</strong> ({user.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadMyPolls}
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors cursor-pointer"
            title="Refresh poll stats"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Poll</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Polls</span>
            <BarChart3 className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{totalCreated}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Live</span>
            <Radio className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Audience Votes</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{totalVotesReceived}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            All Polls ({totalCreated})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'active'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter('closed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'closed'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Closed ({totalCreated - activeCount})
          </button>
        </div>
      </div>

      {/* Polls List / Empty State */}
      {isLoading ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center">
          <RefreshCw className="w-6 h-6 text-neutral-400 animate-spin mb-2" />
          <p className="text-xs text-neutral-500">Loading your polls...</p>
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-12 text-center my-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 mb-1">
            {filter === 'all' ? 'No Polls Created Yet' : `No ${filter} polls`}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
            Create your first question to gather live audience responses with real-time updates.
          </p>
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Launch First Poll
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPolls.map(poll => (
            <PollCard
              key={poll.id}
              poll={poll}
              isCreator={true}
              onSelect={onSelectPoll}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
