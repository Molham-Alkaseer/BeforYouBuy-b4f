import { itemApiStub } from './itemApi.stub';
import type { ItemsApi } from './itemTypes';

// Our pages import `itemApi` from here only.
// TEMPORARY: when Mohammad's shared `api` is ready, change this one line
// to use it instead of the stub.
export const itemApi: ItemsApi = itemApiStub;