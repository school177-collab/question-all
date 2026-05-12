import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy,
  doc,
  updateDoc,
  increment,
  deleteDoc,
  setDoc,
  getDoc,
  collectionGroup
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { Question, QuestionLevel, QuestionStatus, Session } from '../types';
import { 
  Send, 
  LayoutGrid, 
  History, 
  Star, 
  ArrowLeft, 
  MessageCircle, 
  TrendingUp, 
  ChevronUp, 
  Sparkles,
  Search,
  Eye,
  MoreVertical,
  Combine,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { classifyQuestion, detectSimilarQuestions } from '../services/gemini';

interface QuestionBoardProps {
  sessionId: string;
  onBack: () => void;
}

export default function QuestionBoard({ sessionId, onBack }: QuestionBoardProps) {
  const { profile } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [votedQuestionIds, setVotedQuestionIds] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'galaxy' | 'tracks'>('tracks');
  const [isAnonymous, setIsAnonymous] = useState(true);

  // Stats
  const topQuestions = useMemo(() => [...questions].sort((a, b) => b.voteCount - a.voteCount).slice(0, 3), [questions]);
  
  useEffect(() => {
    // Session listener
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (snap.exists()) setSession({ id: snap.id, ...snap.data() } as Session);
    });

    // Questions listener
    const q = query(
      collection(db, 'sessions', sessionId, 'questions'),
      orderBy('createdAt', 'desc')
    );
    const unsubQuestions = onSnapshot(q, (snap) => {
      setQuestions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    });

    // Votes listener for the current user
    const unsubVotes = onSnapshot(collectionGroup(db, 'votes'), (snap) => {
      const myVotes = new Set<string>();
      snap.docs.forEach(doc => {
        if (doc.id === profile?.uid) {
           // We need to check if the parent question is in this session
           // But actually it's easier to just match by ID if we use sessionId in path
           // A better way is to listen to specific session votes if possible, but list queries on subcollections are tricky
        }
      });
      // Simplified: We'll fetch votes more carefully if needed, but let's just track them per question
    });

    return () => {
      unsubSession();
      unsubQuestions();
    };
  }, [sessionId, profile]);

  // Track votes explicitly per user/question
  useEffect(() => {
    if (!profile) return;
    const unsubscribes: (() => void)[] = [];
    
    questions.forEach(q => {
      const voteRef = doc(db, 'sessions', sessionId, 'questions', q.id, 'votes', profile.uid);
      const unsub = onSnapshot(voteRef, (snap) => {
        if (snap.exists()) {
          setVotedQuestionIds(prev => new Set(prev).add(q.id));
        } else {
          setVotedQuestionIds(prev => {
            const next = new Set(prev);
            next.delete(q.id);
            return next;
          });
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  }, [questions.length, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (!profile || !inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 1. AI Classification
      const classification = await classifyQuestion(inputText);
      
      // 2. Similarity Check (optional but good for 200 users)
      const similarId = await detectSimilarQuestions(inputText, questions.map(q => ({id: q.id, text: q.text})));
      
      if (similarId) {
        // Handle similar question - maybe toast "A similar question exists!"
        console.log("Similar question detected:", similarId);
      }

      // 3. Add to Firestore
      await addDoc(collection(db, 'sessions', sessionId, 'questions'), {
        text: inputText,
        authorId: profile.uid,
        authorName: isAnonymous ? '익명' : profile.displayName,
        isAnonymous,
        level: classification.level,
        category: classification.category,
        voteCount: 0,
        status: 'active',
        createdAt: serverTimestamp()
      });

      setInputText('');
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVote = async (questionId: string) => {
    if (!profile) return;
    const voteRef = doc(db, 'sessions', sessionId, 'questions', questionId, 'votes', profile.uid);
    const qRef = doc(db, 'sessions', sessionId, 'questions', questionId);

    if (votedQuestionIds.has(questionId)) {
      await deleteDoc(voteRef);
      await updateDoc(qRef, { voteCount: increment(-1) });
    } else {
      await setDoc(voteRef, { userId: profile.uid, createdAt: serverTimestamp() });
      await updateDoc(qRef, { voteCount: increment(1) });
    }
  };

  const updateQuestionStatus = async (questionId: string, status: QuestionStatus) => {
    if (profile?.role !== 'teacher') return;
    await updateDoc(doc(db, 'sessions', sessionId, 'questions', questionId), { status });
  };

  const setSpotlight = async (questionId: string | null) => {
    if (profile?.role !== 'teacher') return;
    await updateDoc(doc(db, 'sessions', sessionId), { spotlightQuestionId: questionId });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg relative overflow-hidden">
      {/* Sub Header for Board Info */}
      <div className="z-10 h-12 border-b border-white/[0.03] flex items-center justify-between bg-bg/40 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-mono text-text-muted hover:text-white transition-all uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3" />
            목록으로_돌아가기
          </button>
          <div className="w-px h-4 bg-border" />
          <h2 className="text-xs font-mono font-bold text-accent-blue uppercase tracking-tighter">
            세션_ID: {sessionId.slice(0, 8).toUpperCase()}
          </h2>
        </div>

        <div className="flex items-center gap-4 font-mono text-[10px] text-text-muted uppercase tracking-widest">
          <div><span className="opacity-50">동시접속:</span> 200+</div>
          <div><span className="opacity-50">수집된_질문:</span> {questions.length}</div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 divide-x divide-border">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto p-6 space-y-12">
            {[3, 2, 1].map((lvl) => {
              const lvlQuestions = questions.filter(q => q.level === lvl && q.status !== 'hidden');
              const titles = {
                3: '수준 03 / 통찰 및 비판적 질문',
                2: '수준 02 / 이유와 원리 탐구',
                1: '수준 01 / 단순 지식 확인'
              };

              return (
                <div key={lvl} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted">
                      {titles[lvl as keyof typeof titles]}
                    </h3>
                    <div className="text-[10px] font-mono text-text-muted opacity-40">수량: {lvlQuestions.length}</div>
                  </div>
                  
                  <div className={`grid gap-4 ${lvl === 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {lvlQuestions.length > 0 ? lvlQuestions.map((q) => (
                      <QuestionCard 
                        key={q.id} 
                        question={q} 
                        isVoted={votedQuestionIds.has(q.id)}
                        onVote={() => toggleVote(q.id)}
                        onSpotlight={() => setSpotlight(q.id)}
                        onStatusChange={(status) => updateQuestionStatus(q.id, status)}
                        isTeacher={profile?.role === 'teacher'}
                        isSpotlighted={session?.spotlightQuestionId === q.id}
                      />
                    )) : (
                      <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-xl">
                        <p className="text-text-muted text-[10px] font-mono uppercase tracking-[0.3em]">이 수준의 데이터 스트림이 비어있습니다</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area (Bottom of Main Content) */}
          <div className="p-6 border-t border-border bg-surface/30 backdrop-blur-md">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
                <span className="flex items-center gap-2"><MessageCircle className="w-3 h-3 text-accent-blue" /> 새로운_쿼리_초기화</span>
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAnonymous(!isAnonymous)}
                    className={`hover:text-white transition-all flex items-center gap-2 ${isAnonymous ? 'text-accent-gold' : ''}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isAnonymous ? 'bg-accent-gold shadow-[0_0_8px_gold]' : 'bg-zinc-600'}`} />
                    익명_프로토콜: {isAnonymous ? '활성화' : '비활성화'}
                  </button>
                </div>
              </div>
              <div className="relative">
                <textarea 
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="입력_커맨드: 질문 내용을 입력하세요..."
                  className="w-full bg-surface/50 border border-border p-4 rounded-lg text-sm font-sans focus:outline-none focus:border-accent-blue/50 transition-all resize-none placeholder:text-zinc-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button 
                  disabled={isSubmitting || !inputText.trim()}
                  className="absolute bottom-3 right-3 px-6 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:bg-zinc-800 text-black font-black text-xs rounded uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                >
                  {isSubmitting ? '분석_중...' : '실행'}
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-[320px] hidden xl:flex flex-col overflow-hidden bg-bg">
          <div className="p-6 border-b border-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-widest">은하수_뷰.관측기</h2>
              <Sparkles className="w-3 h-3 text-accent-blue opacity-50" />
            </div>
            <div className="h-[200px] w-full bg-black rounded-lg border border-border relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-accent-blue/5 to-transparent pointer-events-none" />
               <GalaxyView 
                  questions={questions} 
                  onVote={(id) => toggleVote(id)}
                  votedIds={votedQuestionIds}
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setViewMode('galaxy')} className={`py-2 text-[9px] font-mono border rounded uppercase transition-all ${viewMode === 'galaxy' ? 'bg-accent-blue text-black border-accent-blue' : 'border-border text-text-muted hover:border-text-muted'}`}>은하수_오버레이</button>
              <button onClick={() => setViewMode('tracks')} className={`py-2 text-[9px] font-mono border rounded uppercase transition-all ${viewMode === 'tracks' ? 'bg-accent-blue text-black border-accent-blue' : 'border-border text-text-muted hover:border-text-muted'}`}>트랙_그리드</button>
            </div>
          </div>

          <div className="p-6 border-b border-border">
            <h2 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-widest mb-4">실시간_키워드_매트릭스</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(questions.map(q => q.category))).slice(0, 8).map((cat, i) => (
                <span 
                  key={cat} 
                  className={`px-3 py-1 bg-surface border border-border rounded-full text-[10px] font-mono whitespace-nowrap ${i % 3 === 0 ? 'text-accent-blue font-bold border-accent-blue/30' : 'text-text-muted'}`}
                >
                  {cat.toUpperCase()}
                </span>
              ))}
              {questions.length === 0 && (
                <div className="text-[9px] font-mono text-text-muted italic opacity-40 uppercase">키워드_대기_중...</div>
              )}
            </div>
          </div>

          <div className="p-6 border-b border-border">
            <h2 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-widest mb-4">시스템_휴리스틱: 인기_질문</h2>
            <div className="space-y-4">
              {topQuestions.map((q, i) => (
                <div key={q.id} className="flex gap-3 items-start">
                  <div className="text-xl font-black text-accent-blue opacity-20 font-mono italic">0{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium leading-tight truncate">{q.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="px-1.5 py-0.5 bg-accent-gold/10 text-accent-gold text-[8px] font-mono rounded">★ {q.voteCount}</div>
                      <div className="text-[9px] text-text-muted font-mono truncate">{q.authorName}</div>
                    </div>
                  </div>
                </div>
              ))}
              {topQuestions.length === 0 && (
                <div className="text-center py-4 border border-dashed border-border text-[9px] font-mono text-text-muted uppercase">신호_대기_중...</div>
              )}
            </div>
          </div>

          <div className="p-6 mt-auto">
             <div className="text-center font-mono text-[9px] text-text-muted opacity-30 mb-4 tracking-[0.2em]">NOVAQ v4.0.2 정식_빌드</div>
             {profile?.role === 'teacher' ? (
                <button 
                  onClick={() => updateQuestionStatus('', 'hidden')} // Emergency mock
                  className="w-full py-3 bg-red-600/10 text-red-500 border border-red-600/30 rounded text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all mb-3"
                >
                  긴급_시스템_중단
                </button>
             ) : (
                <div className="w-full py-3 bg-accent-blue/10 text-accent-blue border border-accent-blue/30 rounded text-[10px] font-mono font-bold uppercase tracking-widest text-center">
                  사용자_터미널_활성
                </div>
             )}
          </div>
        </aside>
      </div>

      {/* Spotlight Overlay (Same content, updated style) */}
      <AnimatePresence>
        {session?.spotlightQuestionId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-bg/95 backdrop-blur-2xl flex items-center justify-center p-8"
          >
            <div className="max-w-3xl w-full text-center space-y-12">
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 bg-accent-blue/10 border border-accent-blue/30 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(62,139,255,0.2)] animate-pulse">
                  <Eye className="w-8 h-8 text-accent-blue" />
                </div>
                <div className="text-[10px] font-mono text-accent-blue font-bold uppercase tracking-[0.4em] animate-pulse">시스템_포커스: 질문_ID_{session.spotlightQuestionId.slice(0, 8)}</div>
              </div>

              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight uppercase font-sans">
                "{questions.find(q => q.id === session.spotlightQuestionId)?.text}"
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-12 font-mono">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">질문자_인증</span>
                  <span className="text-xl text-white font-bold">{questions.find(q => q.id === session.spotlightQuestionId)?.authorName}</span>
                </div>
                <div className="w-px h-12 bg-border hidden md:block" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">투표_합계</span>
                  <span className="text-xl text-accent-gold font-bold">{questions.find(q => q.id === session.spotlightQuestionId)?.voteCount} 유닛</span>
                </div>
                <div className="w-px h-12 bg-border hidden md:block" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">AI_복잡도</span>
                  <span className="text-xl text-accent-blue font-bold">수준_{questions.find(q => q.id === session.spotlightQuestionId)?.level}</span>
                </div>
              </div>

              {profile?.role === 'teacher' && (
                <button 
                  onClick={() => setSpotlight(null)}
                  className="px-12 py-4 bg-accent-blue text-black text-xs font-black rounded uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-accent-blue/20"
                >
                  포커스_해제
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface QuestionCardProps { 
  question: Question;
  isVoted: boolean; 
  onVote: () => void;
  onSpotlight: () => void;
  onStatusChange: (status: QuestionStatus) => void;
  isTeacher: boolean;
  isSpotlighted: boolean;
}

function QuestionCard({ question, isVoted, onVote, onSpotlight, onStatusChange, isTeacher, isSpotlighted }: QuestionCardProps) {
  return (
    <motion.div 
      layout
      className={`group relative p-4 bg-surface border ${isSpotlighted ? 'border-accent-blue shadow-[0_0_15px_rgba(62,139,255,0.1)]' : 'border-border'} ${question.status === 'golden' ? 'border-accent-gold shadow-[inset_0_0_15px_rgba(255,215,0,0.05)]' : ''} rounded-lg flex flex-col gap-4 hover:border-white/20 transition-all`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent-blue rounded-full shadow-[0_0_5px_rgba(62,139,255,0.5)]" />
          <span className="text-[10px] font-mono font-bold text-text-muted tracking-widest uppercase truncate max-w-[120px]">
            {question.category}
          </span>
          {question.status === 'golden' && (
            <Trophy className="w-3 h-3 text-accent-gold" />
          )}
        </div>
        {isTeacher && (
           <div className="flex items-center gap-1">
             <button onClick={onSpotlight} title="포커스" className="p-1.5 hover:bg-white/10 rounded-md text-text-muted hover:text-accent-blue transition-all">
                <Eye className="w-3.5 h-3.5" />
             </button>
             <button onClick={() => onStatusChange('golden')} title="오늘의 질문" className="p-1.5 hover:bg-white/10 rounded-md text-text-muted hover:text-accent-gold transition-all">
                <Trophy className="w-3.5 h-3.5" />
             </button>
           </div>
        )}
      </div>

      <p className="text-sm font-medium leading-relaxed font-sans">
        {question.text}
      </p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[8px] font-mono font-bold text-text-muted uppercase tracking-[0.1em]">질문자_ID</span>
            <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[80px]">{question.authorName}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex flex-col">
            <span className="text-[8px] font-mono font-bold text-text-muted uppercase tracking-[0.1em]">로그_타임</span>
            <span className="text-[10px] text-zinc-400 font-mono">방금_전</span>
          </div>
        </div>

        <button 
          onClick={onVote}
          className={`flex items-center gap-2 px-2.5 py-1 rounded font-mono border transition-all ${
            isVoted 
              ? 'bg-accent-blue/10 border-accent-blue text-accent-blue' 
              : 'border-border text-text-muted hover:border-white/20'
          }`}
        >
          <span className="text-[10px] font-bold">투표: </span>
          <span className="text-xs font-black">{question.voteCount}</span>
        </button>
      </div>
    </motion.div>
  );
}

function GalaxyView({ questions, onVote, votedIds }: { questions: Question[], onVote: (id: string) => void, votedIds: Set<string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Distribute questions in a spiral or cluster
  const dynamicPositions = useMemo(() => {
    return questions.map((q, i) => {
      const angle = (i / 10) * Math.PI * 2 + (q.level * 2);
      const radius = 50 + (q.level * 80) + (Math.sin(i) * 30);
      return {
        id: q.id,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }, [questions.length]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center p-8">
      {/* Background Rings */}
      <div className="absolute w-[200px] h-[200px] border border-white/5 rounded-full" />
      <div className="absolute w-[400px] h-[400px] border border-white/5 rounded-full" />
      <div className="absolute w-[600px] h-[600px] border border-white/5 rounded-full" />

      {questions.map((q, i) => {
        const pos = dynamicPositions[i];
        const size = Math.max(12, 12 + q.voteCount * 2);
        const glow = Math.min(20, q.voteCount * 4);
        const color = q.level === 3 ? '#f59e0b' : q.level === 2 ? '#6366f1' : '#10b981';

        return (
          <motion.div
            key={q.id}
            initial={{ scale: 0 }}
            animate={{ 
              scale: 1,
              x: pos.x,
              y: pos.y,
            }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
            onClick={() => onVote(q.id)}
            className="absolute cursor-pointer group"
          >
            <div 
              className={`rounded-full transition-all duration-500`}
              style={{ 
                width: size, 
                height: size, 
                backgroundColor: color,
                boxShadow: `0 0 ${glow}px ${color}80`,
              }}
            />
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-zinc-900 border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-2xl">
              <p className="text-xs font-bold w-48 overflow-hidden text-ellipsis whitespace-normal line-clamp-2">{q.text}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">{q.voteCount} 투표</span>
                <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                <span className="text-[9px] text-zinc-500 uppercase font-bold">수준 {q.level}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
