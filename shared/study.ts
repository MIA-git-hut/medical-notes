/** Stable public contracts; identity is supplied by the server session, never the client. */
export type Rating = 1 | 2 | 3 | 4
export interface StudyCard {
  id: string
  contentId: string
  categoryId: string
  category: string
  question: string
  answer: string
  sourceUrl: string
  sourceTitle: string
  noteUrl: string
  status: 'reviewed' | 'unverified'
  kind?: 'herb' | 'excerpt'
  herb?: {
    name: string
    chapter: string
    subsection: string
    suji: string
    xingwei: string
    guijing: string
    gongxiao: string[]
    zhuzhi: string[]
  }
}
export interface ScheduleState {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: number
  last_review?: string
  learning_steps: number
}
export interface Progress { cardId: string; version: number; schedule: ScheduleState }
export interface Review { id: string; cardId: string; rating: Rating; reviewedAt: string; due: string }
export interface StudyNote { cardId: string; text: string; version: number; updatedAt: string }
export interface StudySnapshot {
  progress: Progress[]
  reviews: Review[]
  notes: StudyNote[]
  settings: { dailyNewLimit: number; timezone: string }
  newCardsStudiedToday: number
}
export interface User { id: string; login: string; avatarUrl: string }
export interface MeResponse { user: User | null; csrfToken?: string; configured: boolean; isAdmin?: boolean }
export interface ReviewInput { cardId: string; rating: Rating; expectedVersion: number; requestId: string }
