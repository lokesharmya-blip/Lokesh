import React, { useState, useEffect } from 'react';
import { Poll } from '../types';
import { api } from '../api/client';
import { PollCard } from './PollCard';
import { Search, RefreshCw, Radio, Plus, Sparkles } from 'lucide-react';

interface ExploreViewProps {
  onSelectPoll: (pollId: string) => void;
  onOpenCreate: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onSelectPoll,
  onOpenCreate,
}) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchPolls = async () => {
    setIsLoading(true);
    try {
      const data = await api.listPublicPolls();
      setPolls(data);
    } catch {
      setPolls([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const filteredPolls = polls.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero section */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold mb-3 border border-neutral-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Real-time Polling Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
          Vote & Watch Live Results Unfold
        </h1>
        <p className="mt-2 text-sm text-neutral-500 max-w-lg mx-auto leading-relaxed">
          Cast your vote on active community questions. Live vote tallies and percentage distributions update in real time without refreshing.
        </p>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-8">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            id="search-polls-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search polls by question..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={fetchPolls}
            className="p-2 text-neutral-500 hover:text-neutral-900 bg-white hover:bg-neutral-50 rounded-xl border border-neutral-200 shadow-2xs transition-colors cursor-pointer"
            title="Refresh poll list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            id="explore-create-poll-cta-btn"
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch a Poll</span>
          </button>
        </div>
      </div>

      {/* Poll Cards List */}
      {isLoading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center">
          <RefreshCw className="w-7 h-7 text-neutral-400 animate-spin mb-3" />
          <p className="text-xs text-neutral-500">Discovering active polls...</p>
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-12 text-center max-w-xl mx-auto my-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 mb-1">
            {search ? 'No polls match your search' : 'No Public Polls Available Yet'}
          </h3>
          <p className="text-xs text-neutral-500 mb-6">
            {search
              ? 'Try searching with different keywords.'
              : 'Be the first to create a live poll and share it with your audience.'}
          </p>
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Live Poll
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPolls.map(poll => (
            <PollCard
              key={poll.id}
              poll={poll}
              isCreator={false}
              onSelect={onSelectPoll}
            />
          ))}
        </div>
      )}
    </div>
  );
};
