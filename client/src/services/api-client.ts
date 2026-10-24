import { ApiClient, ApiError } from "../types";
import { httpApi } from "./http-api";
import { authApi } from "./auth-api";
import {
  mockApi,
  resetMockState,
  configureMockSimulation,
  getMockSimulationConfig,
} from "../mocks/mock-api";

const useMocks = import.meta.env.VITE_USE_MOCKS === "true";

export const api: ApiClient = useMocks ? mockApi : httpApi;

export { authApi };

export type { ApiClient };
export {
  ApiError,
  useMocks as isMockMode,
  resetMockState,
  configureMockSimulation,
  getMockSimulationConfig,
};
