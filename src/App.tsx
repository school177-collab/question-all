/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { UserRole } from './types';
import { LogIn, Rocket, GraduationCap, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SessionManager from './components/SessionManager';
import QuestionBoard from './components/QuestionBoard';

function LandingPage() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-bg text-white flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center space-y-8"
      >
        <div className="flex justify-center flex-col items-center">
          <div className="w-20 h-20 bg-accent-blue/10 border border-accent-blue/30 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(62,139,255,0.1)] mb-8">
            <Rocket className="w-10 h-10 text-accent-blue" />
          </div>
          <h1 className="text-5xl font-black tracking-tight uppercase leading-none font-sans">
            질문 <span className="text-accent-blue">커맨드 센터</span>
          </h1>
          <p className="text-text-muted mt-4 text-sm font-mono tracking-[0.2em] uppercase">
            대규모 세션을 위한 하이엔드 질문 플랫폼
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
          <button 
            onClick={() => signIn('teacher')}
            className="group relative p-8 bg-surface border border-border rounded-xl hover:border-accent-blue/50 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 blur-3xl group-hover:bg-accent-blue/10 transition-all" />
            <GraduationCap className="w-6 h-6 text-accent-blue mb-4" />
            <h3 className="text-lg font-bold mb-1 uppercase tracking-tight">교사 콘솔</h3>
            <p className="text-text-muted text-xs font-mono leading-relaxed uppercase opacity-60">시스템 모니터링, 스포트라이트 및 AI 분류 제어 권한을 가집니다.</p>
          </button>

          <button 
            onClick={() => signIn('student')}
            className="group relative p-8 bg-surface border border-border rounded-xl hover:border-accent-blue/50 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 blur-3xl group-hover:bg-accent-blue/10 transition-all" />
            <LogIn className="w-6 h-6 text-accent-blue mb-4" />
            <h3 className="text-lg font-bold mb-1 uppercase tracking-tight">참여 포털</h3>
            <p className="text-text-muted text-xs font-mono leading-relaxed uppercase opacity-60">세션 입장, 실시간 질문 제출 및 투표 시스템에 참여합니다.</p>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const { profile, logout } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-bg text-white flex flex-col font-sans overflow-hidden">
      <header className="h-[60px] border-b border-border px-6 flex items-center justify-between bg-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6 cursor-pointer" onClick={() => setActiveSessionId(null)}>
          <div className="font-black text-xl tracking-tight uppercase">
            질문 <span className="text-accent-blue">커맨드 센터</span>
          </div>
          <div className="hidden md:flex items-center gap-2 border border-accent-blue px-3 py-1 rounded text-[10px] font-mono text-accent-blue uppercase tracking-wider">
            <div className="w-1.5 h-1.5 bg-accent-blue rounded-full shadow-[0_0_8px_rgba(62,139,255,1)]" />
            AI 엔진: 활성화 (0.1ms)
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted font-mono">
              권한: {profile.role === 'teacher' ? '교사' : '학생'}
            </span>
            <span className="text-xs font-bold font-mono text-accent-blue uppercase tracking-tighter">{profile.displayName}</span>
          </div>
          <button 
            onClick={logout}
            className="p-2 border border-border hover:bg-surface rounded-md text-text-muted hover:text-white transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden bg-bg">
        <AnimatePresence mode="wait">
          {!activeSessionId ? (
            <motion.div 
              key="manager"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-auto"
            >
              <SessionManager onJoin={setActiveSessionId} />
            </motion.div>
          ) : (
            <motion.div 
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <QuestionBoard 
                sessionId={activeSessionId} 
                onBack={() => setActiveSessionId(null)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-accent-blue/20 border-t-accent-blue rounded-full"
        />
      </div>
    );
  }

  return user && profile ? <MainApp /> : <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
