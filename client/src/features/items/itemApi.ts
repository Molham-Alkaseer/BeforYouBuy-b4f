import { api } from '../../services/api-client';
import type { ItemsApi } from './itemTypes';

// All pages share the same live API (or the same explicitly enabled mock state).
export const itemApi: ItemsApi = api;
