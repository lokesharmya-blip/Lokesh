import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Poll } from '../types';
import { X, Plus, Trash2, HelpCircle, Loader2, AlertCircle } from 'lucide-react';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPollCreated: (poll: Poll) => void;
  onRequireAuth: () => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onPollCreated,
  onRequireAuth,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-xs">
        <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-neutral-200 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            Authentication Required
          </h3>
          <p className="text-sm text-neutral-500 mb-6">
            Users must be signed in before creating and managing real-time live polls.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                onRequireAuth();
              }}
              className="flex-1 py-2 px-4 rounded-xl bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddOption = () => {
    if (options.length >= 8) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const next = [...options];
    next.splice(index, 1);
    setOptions(next);
  };

  const handleOptionChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = val;
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 5) {
      setError('Poll question must be at least 5 characters long');
      return;
    }

    const cleanOptions = options.map(o => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError('A poll must have at least 2 non-empty options');
      return;
    }

    setIsSubmitting(true);

    try {
      const poll = await api.createPoll({
        title: cleanTitle,
        description: description.trim() || undefined,
        options: cleanOptions,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setOptions(['', '']);
      onPollCreated(poll);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create poll. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Create New Live Poll
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Launch a live question with real-time Redis counting and public sharing
            </p>
          </div>
          <button
            id="close-create-poll-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Question */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Poll Question <span className="text-red-500">*</span>
            </label>
            <input
              id="create-poll-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Which Go framework do you prefer for high-load services?"
              className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Context / Description <span className="text-neutral-400">(Optional)</span>
            </label>
            <textarea
              id="create-poll-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or instructions for your audience..."
              className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Dynamic Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-700">
                Poll Options <span className="text-red-500">*</span> (min 2, max 8)
              </label>
              <span className="text-[11px] text-neutral-400">
                {options.length} of 8 options
              </span>
            </div>

            <div className="space-y-2">
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-mono text-neutral-400 font-semibold">
                    {index + 1}.
                  </span>
                  <input
                    id={`poll-option-input-${index}`}
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      id={`remove-option-btn-${index}`}
                      onClick={() => handleRemoveOption(index)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                id="add-option-btn"
                onClick={handleAddOption}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Option
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-poll-btn"
              disabled={isSubmitting}
              className="py-2 px-5 rounded-xl bg-neutral-900 text-xs font-medium text-white hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing Poll...</span>
                </>
              ) : (
                'Publish & Get Link'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
