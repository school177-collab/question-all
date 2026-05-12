import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { Session } from '../types';
import { Plus, Play, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface SessionManagerProps {
  onJoin: (id: string) => void;
}

export default function SessionManager({ onJoin }: SessionManagerProps) {
  const { profile, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Teachers see their sessions, students see all active sessions
    const q = profile.role === 'teacher' 
      ? query(collection(db, 'sessions'), where('teacherId', '==', profile.uid), orderBy('createdAt', 'desc'))
      : query(collection(db, 'sessions'), where('status', '==', 'active'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newSessionName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        name: newSessionName,
        teacherId: profile.uid,
        status: 'active',
        createdAt: serverTimestamp()
      });
      setNewSessionName('');
      onJoin(docRef.id);
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div className="space-y-3">
        <h2 className="text-4xl font-black tracking-tight uppercase font-sans">
          세션 <span className="text-accent-blue">디렉토리</span>
        </h2>
        <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted uppercase tracking-[0.2em] bg-surface/50 border border-border px-3 py-1.5 rounded w-fit">
          <Clock className="w-3 h-3" />
          서버 시간: {new Date().toLocaleTimeString()}
          <div className="w-1 h-1 bg-accent-blue rounded-full mx-2 animate-pulse" />
          사용자 유형: {profile?.role === 'teacher' ? '교사' : '학생'}
        </div>
      </div>

      {profile?.role === 'teacher' && (
        <form onSubmit={handleCreateSession} className="relative group">
          <input 
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="[시스템] 생성할 세션 이름을 입력하세요..."
            className="w-full bg-surface border border-border p-6 pr-40 rounded-xl text-xl font-bold font-sans focus:outline-none focus:border-accent-blue transition-all placeholder:text-zinc-700 shadow-sm"
          />
          <button 
            type="submit"
            className="absolute right-3 top-3 bottom-3 px-8 bg-accent-blue hover:bg-accent-blue/80 text-black font-black rounded-lg flex items-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            <Plus className="w-5 h-5" />
            세션 생성
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 bg-border border border-border rounded-xl overflow-hidden">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-bg animate-pulse" />
          ))
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <motion.button
              key={session.id}
              whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
              onClick={() => onJoin(session.id)}
              className="p-6 bg-bg flex flex-col text-left transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 border border-border rounded flex items-center justify-center group-hover:border-accent-blue/50 transition-all">
                  <Play className="w-4 h-4 text-accent-blue" />
                </div>
                <div className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest border ${
                  session.status === 'active' ? 'border-accent-blue text-accent-blue' : 'border-red-500/50 text-red-500'
                }`}>
                  {session.status === 'active' ? '활성화' : '종료'}
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1 uppercase tracking-tight group-hover:text-accent-blue transition-all truncate w-full">
                {session.name}
              </h3>
              <div className="flex items-center gap-3 mt-auto pt-4 text-text-muted text-[10px] font-mono uppercase tracking-tighter opacity-60 group-hover:opacity-100 transition-all">
                <div className="flex flex-col">
                  <span className="opacity-40">생성일자</span>
                  <span>{session.createdAt?.toDate().toLocaleDateString()}</span>
                </div>
                <div className="w-px h-6 bg-border" />
                <div className="flex flex-col">
                  <span className="opacity-40">상태</span>
                  <span className="text-accent-blue">온라인</span>
                </div>
              </div>
            </motion.button>
          ))
        ) : (
          <div className="col-span-full py-24 text-center bg-bg">
            <p className="text-text-muted font-mono text-[10px] uppercase tracking-[0.4em] opacity-30 italic">표시할 활성 세션이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
