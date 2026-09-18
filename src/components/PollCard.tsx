import React, { useState } from 'react';
import { Poll } from '../types';
import { Radio, Users, Clock, Share2, Copy, Check, ChevronRight, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

interface PollCardProps {
  poll: Poll;
  isCreator?: boolean;
  onSelect: (pollId: string) => void;
  onToggleStatus?: (pollId: string) => void;
  onDelete?: (pollId: string) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  isCreator = false,
  onSelect,
  onToggleStatus,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.origin + window.location.pathname + `?poll=${poll.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find leading option
  const sortedOptions = [...poll.options].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const topOption = sortedOptions[0];
  const topPercentage = poll.totalVotes > 0 && topOption ? Math.round((topOption.votes / poll.totalVotes) * 100) : 0;

  return (
    <div
      onClick={() => onSelect(poll.id)}
      className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 hover:border-neutral-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
    >
      <div>
        {/* Top meta */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                poll.isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
              }`}
            >
              <Radio className="w-3 h-3" />
              {poll.isActive ? 'Live' : 'Closed'}
            </span>
            <span className="text-xs text-neutral-400">
              {new Date(poll.createdAt).toLocaleDateString()}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy Public Link"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Question Title */}
        <h3 className="text-base font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1.5">
          {poll.title}
        </h3>

        {poll.description && (
          <p className="text-xs text-neutral-500 line-clamp-2 mb-4">
            {poll.description}
          </p>
        )}

        {/* Preview of options & leading vote */}
        <div className="space-y-1.5 my-4">
          {topOption && (
            <div className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 flex items-center justify-between">
              <span className="truncate pr-2 font-medium">
                Leading: <span className="text-neutral-900 font-semibold">{topOption.text}</span>
              </span>
              <span className="font-mono text-neutral-700 shrink-0 font-bold">
                {topPercentage}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer stats and creator actions */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 mt-2">
        <div className="flex items-center gap-1.5 font-medium">
          <Users className="w-3.5 h-3.5 text-neutral-400" />
          <span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
          <span className="text-neutral-300">•</span>
          <span>{poll.options.length} options</span>
        </div>

        {isCreator ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onToggleStatus && (
              <button
                onClick={() => onToggleStatus(poll.id)}
                title={poll.isActive ? 'Close voting' : 'Reopen voting'}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                {poll.isActive ? (
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-neutral-400" />
                )}
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => onDelete(poll.id)}
                title="Delete poll"
                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-neutral-900 group-hover:translate-x-0.5 transition-transform">
            Vote <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
};
