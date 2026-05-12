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
  const [focusedQuestion, setFocusedQuestion] = useState<Question | null>(null);

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
    <div className="flex-1 flex flex-col min-h-0 bg-bg relative overflow-hidden noise-bg">
      {/* Visual Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
            </pattern>
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stopColor="#3E8BFF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3E8BFF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="grad2" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stopColor="#FFD700" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Decorative shapes */}
          <circle cx="85%" cy="20%" r="300" fill="url(#grad1)" />
          <circle cx="15%" cy="80%" r="400" fill="url(#grad2)" />
          
          {/* Subtle dots */}
          {[...Array(50)].map((_, i) => (
            <circle 
              key={i}
              cx={`${Math.random() * 100}%`} 
              cy={`${Math.random() * 100}%`} 
              r={Math.random() * 0.8} 
              fill="white" 
              fillOpacity={Math.random() * 0.3}
            />
          ))}
        </svg>
      </div>

      {/* Sub Header for Board Info */}
      <div className="z-10 h-14 border-b border-white/[0.03] flex items-center justify-between bg-bg/60 px-6 backdrop-blur-xl">
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

        <div className="flex items-center gap-6 font-mono text-[10px] text-text-muted uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            LIVE
          </div>
          <div><span className="opacity-50">동시접속:</span> 200+</div>
          <div><span className="opacity-50">수집된_질문:</span> {questions.length}</div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 divide-x divide-border">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto p-6 space-y-16">
            {[5, 4, 3, 2, 1].map((lvl) => {
              const lvlQuestions = questions.filter(q => q.level === lvl && q.status !== 'hidden');
              const titles = {
                5: '수준 05 / 융합 및 창의적 제언',
                4: '수준 04 / 비판적 분석 및 추론',
                3: '수준 03 / 적용 및 사례 탐구',
                2: '수준 02 / 이해 및 원리 점검',
                1: '수준 01 / 기초 사실 및 정의'
              };
              const colors = {
                5: 'text-purple-400',
                4: 'text-red-400',
                3: 'text-accent-gold',
                2: 'text-accent-blue',
                1: 'text-emerald-400'
              };

              return (
                <div key={lvl} className="space-y-8">
                  <div className="flex items-center gap-4 border-b border-border/50 pb-3">
                    <div className={`text-[11px] font-mono font-black px-4 py-1.5 rounded bg-surface border border-border flex items-center gap-3 ${colors[lvl as keyof typeof colors]}`}>
                      <span className="opacity-50">LEVEL_0{lvl}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                      <span className="text-white tracking-widest">{titles[lvl as keyof typeof titles].split(' / ')[1]}</span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
                    <div className="text-[10px] font-mono text-text-muted opacity-40">COUNT: {lvlQuestions.length}</div>
                  </div>
                  
                  <div className={`grid gap-6 ${lvl <= 2 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {lvlQuestions.length > 0 ? lvlQuestions.map((q) => (
                      <QuestionCard 
                        key={q.id} 
                        question={q} 
                        isVoted={votedQuestionIds.has(q.id)}
                        onVote={() => toggleVote(q.id)}
                        onSpotlight={() => setSpotlight(q.id)}
                        onStatusChange={(status) => updateQuestionStatus(q.id, status)}
                        onDetails={() => { setFocusedQuestion(q); }}
                        isTeacher={profile?.role === 'teacher'}
                        isSpotlighted={session?.spotlightQuestionId === q.id}
                      />
                    )) : (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-border/30 rounded-2xl bg-surface/5 flex flex-col items-center gap-4">
                        <Sparkles className="w-8 h-8 text-text-muted opacity-10" />
                        <p className="text-text-muted text-[10px] font-mono uppercase tracking-[0.4em] max-w-xs leading-loose">수준 {lvl} 영역에 새로운 통찰이 스트리밍되기를 기다리고 있습니다</p>
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
                  key={cat as string} 
                  className={`px-3 py-1 bg-surface border border-border rounded-full text-[10px] font-mono whitespace-nowrap ${i % 3 === 0 ? 'text-accent-blue font-bold border-accent-blue/30' : 'text-text-muted'}`}
                >
                  {(cat as string).toUpperCase()}
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

      {/* Question Details Modal */}
      <AnimatePresence>
        {focusedQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-bg/80 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setFocusedQuestion(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-surface border border-border max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent-blue shadow-[0_0_10px_rgba(62,139,255,1)]" />
                    <span className="text-xs font-mono font-bold text-text-muted uppercase tracking-[0.2em]">질문_상세_정보</span>
                  </div>
                  <button 
                    onClick={() => setFocusedQuestion(null)}
                    className="p-2 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-colors"
                  >
                    닫기 [ESC]
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-blue/10 border border-accent-blue/30 rounded text-[10px] font-mono text-accent-blue font-bold uppercase">
                    LEVEL_0{focusedQuestion.level} / {focusedQuestion.category}
                  </div>
                  <h3 className="text-2xl font-bold leading-tight font-sans">
                    "{focusedQuestion.text}"
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-text-muted uppercase">질문자</span>
                    <p className="font-bold">{focusedQuestion.authorName}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] font-mono text-text-muted uppercase">투표_수</span>
                    <p className="font-black text-accent-gold text-xl">{focusedQuestion.voteCount}</p>
                  </div>
                </div>

                <div className="bg-bg/50 p-4 rounded-xl border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                    <History className="w-3 h-3" />
                    로그_시간: {focusedQuestion.createdAt?.toDate().toLocaleString()}
                  </div>
                  <button 
                    onClick={() => {
                       toggleVote(focusedQuestion.id);
                       setFocusedQuestion(null);
                    }}
                    className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                      votedQuestionIds.has(focusedQuestion.id) 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                        : 'bg-accent-blue text-black hover:bg-accent-blue/80'
                    }`}
                  >
                    {votedQuestionIds.has(focusedQuestion.id) ? '투표_취소' : '공감_투표'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
  onVote: () => void | Promise<void>;
  onSpotlight: () => void | Promise<void>;
  onStatusChange: (status: QuestionStatus) => void | Promise<void>;
  onDetails?: () => void | Promise<void>;
  isTeacher: boolean;
  isSpotlighted: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  isVoted, 
  onVote, 
  onSpotlight, 
  onStatusChange, 
  onDetails, 
  isTeacher, 
  isSpotlighted 
}) => {
  const levelColors = {
    5: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    4: 'bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.5)]',
    3: 'bg-accent-gold shadow-[0_0_10px_rgba(255,215,0,0.5)]',
    2: 'bg-accent-blue shadow-[0_0_10px_rgba(62,139,255,0.5)]',
    1: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
  };

  return (
    <motion.div 
      layout
      onClick={onDetails}
      className={`group relative p-4 bg-surface border ${isSpotlighted ? 'border-accent-blue shadow-[0_0_15px_rgba(62,139,255,0.1)]' : 'border-border'} ${question.status === 'golden' ? 'border-accent-gold shadow-[inset_0_0_15px_rgba(255,215,0,0.05)]' : ''} rounded-lg flex flex-col gap-4 hover:border-white/20 transition-all cursor-pointer`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${levelColors[question.level as keyof typeof levelColors]}`} />
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
        const color = q.level === 5 ? '#a855f7' : q.level === 4 ? '#f87171' : q.level === 3 ? '#eab308' : q.level === 2 ? '#3b82f6' : '#10b981';

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
