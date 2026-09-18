import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ExploreView } from './components/ExploreView';
import { DashboardView } from './components/DashboardView';
import { PollVoteView } from './components/PollVoteView';
import { CreatePollModal } from './components/CreatePollModal';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';
import { Poll } from './types';
import { DEFAULT_PROGRAMMING_POLL_ID } from './api/client';

function MainApp() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'explore' | 'dashboard' | 'poll'>('poll');
  const [activePollId, setActivePollId] = useState<string | null>(DEFAULT_PROGRAMMING_POLL_ID);

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sharePoll, setSharePoll] = useState<Poll | null>(null);

  // Check URL query parameters for direct poll sharing links (e.g. ?poll=poll_123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pollParam = params.get('poll');
    if (pollParam) {
      setActivePollId(pollParam);
      setCurrentView('poll');
    } else {
      setActivePollId(DEFAULT_PROGRAMMING_POLL_ID);
      setCurrentView('poll');
    }
  }, []);

  const handleSelectPoll = (pollId: string) => {
    setActivePollId(pollId);
    setCurrentView('poll');
    // Update browser URL without reload for clean sharing
    const url = new URL(window.location.href);
    url.searchParams.set('poll', pollId);
    window.history.pushState({}, '', url.toString());
  };

  const handleBackToExplore = () => {
    setActivePollId(null);
    setCurrentView('explore');
    const url = new URL(window.location.href);
    url.searchParams.delete('poll');
    window.history.pushState({}, '', url.toString());
  };

  const handlePollCreated = (newPoll: Poll) => {
    handleSelectPoll(newPoll.id);
  };

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-neutral-50/60 text-neutral-900 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'explore') handleBackToExplore();
          else setCurrentView(view);
        }}
        onOpenCreate={() => {
          if (!user) {
            handleOpenAuth('login');
          } else {
            setIsCreateOpen(true);
          }
        }}
        onOpenAuth={handleOpenAuth}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentView === 'explore' && (
          <ExploreView
            onSelectPoll={handleSelectPoll}
            onOpenCreate={() => {
              if (!user) handleOpenAuth('login');
              else setIsCreateOpen(true);
            }}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            onSelectPoll={handleSelectPoll}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        )}

        {currentView === 'poll' && activePollId && (
          <PollVoteView
            pollId={activePollId}
            onBackToExplore={handleBackToExplore}
            onShare={(poll) => setSharePoll(poll)}
          />
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
      />

      <CreatePollModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPollCreated={handlePollCreated}
        onRequireAuth={() => handleOpenAuth('login')}
      />

      <ShareModal
        poll={sharePoll}
        isOpen={Boolean(sharePoll)}
        onClose={() => setSharePoll(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
