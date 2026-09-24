import { authHandlers } from './auth';
import { salesHandlers } from './sales';
import { designHandlers } from './design';
import { planningHandlers } from './planning';
import { inventoryHandlers } from './inventory';
import { productionHandlers } from './production';
import { Handler } from './models';
export const handlers: Record<string, Handler> = {
  ...authHandlers,
  ...salesHandlers,
  ...designHandlers,
  ...planningHandlers,
  ...inventoryHandlers,
  ...productionHandlers,
};
