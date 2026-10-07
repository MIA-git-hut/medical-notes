import type { MeResponse, Progress, ReviewInput, StudyCard, StudyNote, StudySnapshot } from '../../../../shared/study'

export interface AuthProvider { id: string; label: string; kind: 'oauth2'; enabled: boolean; startUrl: string }
export interface AdminStats {
  totalUsers: number
  totalSignIns: number
  activeUsers7d: number
  activeUsers30d: number
  dailyLogins: Array<{ date: string; signIns: number; users: number }>
}
export interface AdminUser { id: string; login: string; createdAt: string; lastLoginAt: string | null; signIns: number }
export interface AdminUsersPage { users: AdminUser[]; page: number; pageSize: 50; total: number }

export class StudyApiError extends Error { constructor(public status: number, message: string) { super(message) } }
async function call<T>(url: string, init: RequestInit = {}, csrf?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (csrf) headers.set('X-CSRF-Token', csrf)
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  if (!res.ok) {
    let message = `请求失败（${res.status}）`
    try { const body = await res.json(); message = body.error || body.message || message } catch { /* 非 JSON 错误 */ }
    throw new StudyApiError(res.status, message)
  }
  return res.status === 204 ? undefined as T : res.json()
}
export const studyClient = {
  cards: () => call<StudyCard[]>(`${import.meta.env.BASE_URL}study-cards.json`),
  me: () => call<MeResponse & { isAdmin: boolean }>('/api/me'),
  providers: () => call<{ providers: AuthProvider[] }>('/api/auth/providers'),
  snapshot: () => call<StudySnapshot>('/api/study'),
  review: (body: ReviewInput, csrf: string) => call<{ progress: Progress; review: StudySnapshot['reviews'][number] }>('/api/study/reviews', { method: 'POST', body: JSON.stringify(body) }, csrf),
  note: (cardId: string, text: string, expectedVersion: number, csrf: string) => call<StudyNote>('/api/study/notes', { method: 'PUT', body: JSON.stringify({ cardId, text, expectedVersion }) }, csrf),
  reset: (categoryId: string, csrf: string) => call<void>('/api/study/reset', { method: 'POST', body: JSON.stringify({ categoryId }) }, csrf),
  settings: (dailyNewLimit: number, timezone: string, csrf: string) => call<void>('/api/study/settings', { method: 'PATCH', body: JSON.stringify({ dailyNewLimit, timezone }) }, csrf),
  logout: (csrf: string) => call<void>('/api/auth/logout', { method: 'POST' }, csrf),
  adminStats: () => call<AdminStats>('/api/admin/stats'),
  adminUsers: (page: number) => call<AdminUsersPage>(`/api/admin/users?page=${encodeURIComponent(page)}`),
}
