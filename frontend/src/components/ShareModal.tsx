import React, { useState } from 'react';
import { Poll } from '../types';
import { X, Copy, Check, QrCode, ExternalLink } from 'lucide-react';

interface ShareModalProps {
  poll: Poll | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ poll, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !poll) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?poll=${poll.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Share Public Poll</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Audience members can vote without registering</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5">
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Shareable Audience URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-xl select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center">
          <p className="text-xs font-medium text-neutral-700 mb-1">
            Realtime Synchronization Active
          </p>
          <p className="text-[11px] text-neutral-500">
            Votes cast through this link trigger instant Redis Pub/Sub events that stream to all open screens simultaneously.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
