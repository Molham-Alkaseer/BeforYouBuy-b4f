export { request, API_URL } from './services/request';
export { ApiError } from './types';
export type { ApiClient, ApiErrorBody, SafeUser, HouseholdRole, RegisterInput, LoginInput, LoginResult, AuthClient } from './types';
export { authApi } from './services/auth-api';
export { api, isMockMode } from './services/api-client';
