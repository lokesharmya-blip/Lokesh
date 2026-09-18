import React, { useState, useEffect } from 'react';
import { Poll } from '../types';
import { api, getVoterId } from '../api/client';
import { useRealtimePoll } from '../hooks/useRealtimePoll';
import {
  CheckCircle2,
  Share2,
  Radio,
  Clock,
  User,
  AlertCircle,
  Copy,
  Check,
  BarChart2,
  RefreshCw,
  Eye,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface PollVoteViewProps {
  pollId: string;
  onBackToExplore?: () => void;
  onShare?: (poll: Poll) => void;
}

export const PollVoteView: React.FC<PollVoteViewProps> = ({
  pollId,
  onBackToExplore,
  onShare,
}) => {
  const [initialPoll, setInitialPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [forceShowResults, setForceShowResults] = useState(false);

  // Fetch initial poll data
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    api.getPoll(pollId, getVoterId())
      .then((res) => {
        if (active) {
          setInitialPoll(res.poll);
          setHasVoted(res.hasVoted);
          if (res.userVotedOption) {
            setVotedOptionId(res.userVotedOption);
          }
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load poll');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pollId]);

  // Hook up real-time live synchronization (WebSocket + Redis Pub/Sub)
  const { poll, isConnected, isPulsing } = useRealtimePoll({
    pollId,
    initialPoll: initialPoll || undefined,
  });

  const currentPoll = poll || initialPoll;

  const handleVoteSubmit = async () => {
    if (!selectedOption || !currentPoll || !currentPoll.isActive) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.castVote(currentPoll.id, selectedOption);
      setHasVoted(true);
      setVotedOptionId(res.optionId);
    } catch (err: any) {
      setError(err.message || 'Failed to cast vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetVote = async () => {
    if (!currentPoll) return;
    await api.resetMyVote(currentPoll.id);
    setHasVoted(false);
    setSelectedOption(null);
    setVotedOptionId(null);
    setForceShowResults(false);
  };

  const handleSimulateLiveVote = async () => {
    if (!currentPoll || !currentPoll.isActive) return;
    setIsSimulating(true);
    try {
      await api.simulateAudienceVote(currentPoll.id);
    } catch (err: any) {
      setError(err.message || 'Simulation error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyShareLink = () => {
    const url = window.location.origin + window.location.pathname + `?poll=${pollId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mb-3" />
        <p className="text-sm font-medium text-neutral-600">Connecting to live poll...</p>
      </div>
    );
  }

  if (error && !currentPoll) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-neutral-200 text-center shadow-xs">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-1">Poll Not Found</h3>
        <p className="text-xs text-neutral-500 mb-6">{error}</p>
        {onBackToExplore && (
          <button
            onClick={onBackToExplore}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Browse Public Polls
          </button>
        )}
      </div>
    );
  }

  if (!currentPoll) return null;

  const showResults = hasVoted || !currentPoll.isActive || forceShowResults;
  const totalVotes = currentPoll.totalVotes;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Top breadcrumb & back */}
      <div className="flex items-center justify-between mb-4">
        {onBackToExplore && (
          <button
            onClick={onBackToExplore}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1 cursor-pointer transition-colors"
          >
            &larr; Back to all polls
          </button>
        )}

        {/* Live sync indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isPulsing ? 'animate-ping' : ''}`} />
            {isConnected ? 'Real-time Live Updates Active' : 'Real-time Live Connected'}
          </span>
        </div>
      </div>

      {/* Main Poll Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {/* Header section */}
        <div className="p-6 sm:p-8 border-b border-neutral-100">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                currentPoll.isActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              <Radio className="w-3 h-3" />
              {currentPoll.isActive ? 'Active Poll' : 'Voting Closed'}
            </span>

            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <User className="w-3 h-3" />
              By {currentPoll.creatorName}
            </span>

            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(currentPoll.createdAt).toLocaleDateString()}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight mb-2">
            {currentPoll.title}
          </h1>

          {currentPoll.description && (
            <p className="text-sm text-neutral-600 leading-relaxed mt-2">
              {currentPoll.description}
            </p>
          )}

          {/* Shareable Link Banner */}
          <div className="mt-5 p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-neutral-600 truncate w-full">
              <Share2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="font-mono text-neutral-500 truncate select-all">
                {window.location.origin + window.location.pathname + `?poll=${currentPoll.id}`}
              </span>
            </div>
            <button
              id="copy-share-link-btn"
              onClick={handleCopyShareLink}
              className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-medium border border-neutral-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="m-6 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Options / Results section */}
        <div className="p-6 sm:p-8">
          {hasVoted && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your vote has been counted in real time! Results update dynamically below as others vote.</span>
            </div>
          )}

          {!hasVoted && !currentPoll.isActive && (
            <div className="mb-5 p-3 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0" />
              <span>This poll is closed. Viewing final verified results.</span>
            </div>
          )}

          <div className="space-y-3">
            {currentPoll.options.map((option, idx) => {
              const voteCount = option.votes || 0;
              const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              const isSelected = selectedOption === option.id;
              const isUserVote = votedOptionId === option.id;

              if (showResults) {
                // Real-time animated results bar view
                return (
                  <div
                    key={option.id}
                    className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                      isUserVote
                        ? 'border-indigo-500 bg-indigo-50/30'
                        : 'border-neutral-200 bg-neutral-50/50'
                    }`}
                  >
                    {/* Background Progress Bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out ${
                        isUserVote ? 'bg-indigo-100/70' : 'bg-neutral-200/50'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />

                    {/* Content over bar */}
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 text-xs font-mono font-medium text-neutral-400">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-semibold text-neutral-900">
                          {option.text}
                        </span>
                        {isUserVote && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            <Check className="w-2.5 h-2.5" /> Your Vote
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-neutral-900">
                          {percentage}%
                        </span>
                        <span className="text-xs text-neutral-500 ml-1.5">
                          ({voteCount} {voteCount === 1 ? 'vote' : 'votes'})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Interactive Audience Voting Selection
              return (
                <button
                  key={option.id}
                  id={`vote-option-btn-${option.id}`}
                  type="button"
                  onClick={() => setSelectedOption(option.id)}
                  disabled={isSubmitting}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900'
                          : 'border-neutral-300 bg-white'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium text-neutral-900">
                      {option.text}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400">
                    Option {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Voting Action or Result Info */}
          {!showResults && currentPoll.isActive && (
            <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setForceShowResults(true)}
                className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview live results without voting
              </button>

              <button
                id="submit-vote-btn"
                type="button"
                onClick={handleVoteSubmit}
                disabled={!selectedOption || isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recording Vote in Redis...</span>
                  </>
                ) : (
                  'Submit Vote'
                )}
              </button>
            </div>
          )}

          {/* Bottom stats footer */}
          <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-medium">
                <BarChart2 className="w-3.5 h-3.5 text-neutral-400" />
                Total Votes Cast: <strong className="text-neutral-900 font-mono text-sm">{totalVotes}</strong>
              </span>

              {currentPoll.isActive && (
                <button
                  type="button"
                  onClick={handleSimulateLiveVote}
                  disabled={isSimulating}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  title="Simulate an incoming vote from another user to test real-time percentage updates"
                >
                  <Sparkles className={`w-3 h-3 text-indigo-600 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>Simulate Live Vote</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasVoted && currentPoll.isActive && (
                <button
                  type="button"
                  onClick={handleResetVote}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Change or Cast Another Vote
                </button>
              )}

              {showResults && !hasVoted && currentPoll.isActive && (
                <button
                  onClick={() => setForceShowResults(false)}
                  className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                >
                  Return to Voting View
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
