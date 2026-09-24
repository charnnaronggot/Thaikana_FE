import { authHandlers } from './auth';
import { salesHandlers } from './sales';
import { designHandlers } from './design';
import { planningHandlers } from './planning';
import { Handler } from './models';
export const handlers: Record<string, Handler> = {
  ...authHandlers,
  ...salesHandlers,
  ...designHandlers,
  ...planningHandlers,
};
