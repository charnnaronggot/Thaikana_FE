import { authHandlers } from './auth';
import { salesHandlers } from './sales';
import { designHandlers } from './design';
import { Handler } from './models';
export const handlers: Record<string, Handler> = {
  ...authHandlers,
  ...salesHandlers,
  ...designHandlers,
};
