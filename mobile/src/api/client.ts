import { env } from '@/config/env';
import { httpApi } from './http';
import { mockApi } from './mock';

/** Single switch between sample data and the real backend (see .env.example). */
export const api: typeof httpApi = env.useMock ? mockApi : httpApi;
