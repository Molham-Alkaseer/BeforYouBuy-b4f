import { request } from './request';
import type { AuthClient } from '../types';
import { mockApi } from '../mocks/mock-api';
const httpAuth: AuthClient = {
  register: input => request('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: input => request('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: () => request('/auth/me'),
  listMembers: () => request('/household/members'),
  addMember: input => request('/household/members', { method: 'POST', body: JSON.stringify(input) }),
};
export const authApi: AuthClient = import.meta.env.VITE_USE_MOCKS === 'true' ? mockApi : httpAuth;
