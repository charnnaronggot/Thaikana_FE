import { salesHandlers } from './sales';
import { Handler } from './models';
import { authHandlers } from './auth';
export const handlers: Record<string, Handler> = { ...authHandlers, ...salesHandlers };
