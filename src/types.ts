import { Timestamp } from 'firebase/firestore';

export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  role: UserRole;
  displayName: string;
  email?: string;
}

export type QuestionLevel = 1 | 2 | 3;
export type QuestionStatus = 'active' | 'merged' | 'hidden' | 'answered' | 'golden';

export interface Question {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  level: QuestionLevel;
  category: string;
  voteCount: number;
  status: QuestionStatus;
  parentId?: string;
  createdAt: Timestamp;
}

export interface Session {
  id: string;
  name: string;
  teacherId: string;
  status: 'active' | 'paused' | 'finished';
  createdAt: Timestamp;
  spotlightQuestionId?: string;
}

export interface Vote {
  userId: string;
  createdAt: Timestamp;
}
