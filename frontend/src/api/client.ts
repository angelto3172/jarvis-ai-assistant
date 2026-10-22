import axios from 'axios';
import type { SchoolTask, ContentPost, AgencyProject } from '../types';

const api = axios.create({ baseURL: '/api' });

export const dashboard = {
  get: () => api.get('/dashboard').then(r => r.data.data),
};

export const school = {
  list: () => api.get('/school').then(r => r.data.data as SchoolTask[]),
  create: (body: Omit<SchoolTask, 'id' | 'createdAt'>) =>
    api.post('/school', body).then(r => r.data.data as SchoolTask),
  update: (id: number, body: Partial<Omit<SchoolTask, 'id' | 'createdAt'>>) =>
    api.put(`/school/${id}`, body).then(r => r.data.data as SchoolTask),
  remove: (id: number) => api.delete(`/school/${id}`),
};

export const content = {
  list: () => api.get('/content').then(r => r.data.data as ContentPost[]),
  create: (body: Omit<ContentPost, 'id' | 'createdAt'>) =>
    api.post('/content', body).then(r => r.data.data as ContentPost),
  update: (id: number, body: Partial<Omit<ContentPost, 'id' | 'createdAt'>>) =>
    api.put(`/content/${id}`, body).then(r => r.data.data as ContentPost),
  remove: (id: number) => api.delete(`/content/${id}`),
};

export const agency = {
  list: () => api.get('/agency').then(r => r.data.data as AgencyProject[]),
  create: (body: Omit<AgencyProject, 'id' | 'createdAt'>) =>
    api.post('/agency', body).then(r => r.data.data as AgencyProject),
  update: (id: number, body: Partial<Omit<AgencyProject, 'id' | 'createdAt'>>) =>
    api.put(`/agency/${id}`, body).then(r => r.data.data as AgencyProject),
  remove: (id: number) => api.delete(`/agency/${id}`),
};

export const calendar = {
  status: () => api.get('/calendar/status').then(r => r.data),
  authUrl: () => api.get('/calendar/auth').then(r => r.data.url),
  today: () => api.get('/calendar/today').then(r => r.data.data),
  week: (weekStart?: string) =>
    api.get('/calendar/week', { params: weekStart ? { weekStart } : {} }).then(r => r.data.data),
  createBlock: (body: { title: string; description?: string; startTime: string; endTime: string; category?: string }) =>
    api.post('/calendar/block', body).then(r => r.data.data),
  deleteEvent: (id: string) => api.delete(`/calendar/event/${id}`),
};

export const planning = {
  getGoals: (weekOffset = 0) => api.get('/planning/goals', { params: { weekOffset } }).then(r => r.data.data),
  saveGoals: (body: { weekStart: string; goal1?: string; goal2?: string; goal3?: string }) =>
    api.post('/planning/goals', body).then(r => r.data.data),
  weekEvents: (weekStart?: string) =>
    api.get('/planning/week', { params: weekStart ? { weekStart } : {} }).then(r => r.data.data),
};

export const bot = {
  triggerBriefing: () => api.post('/bot/briefing'),
  triggerExamAlerts: () => api.post('/bot/exam-alerts'),
  triggerWeeklyPrompt: () => api.post('/bot/weekly-prompt'),
};

export default api;
