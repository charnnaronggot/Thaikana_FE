import { authHandlers } from './auth';
import { salesHandlers } from './sales';
import { designHandlers } from './design';
import { planningHandlers } from './planning';
import { inventoryHandlers } from './inventory';
import { productionHandlers } from './production';
import { qcHandlers } from './qc';
import { Handler } from './models';
export const handlers: Record<string, Handler> = {
  ...authHandlers,
  ...salesHandlers,
  ...designHandlers,
  ...planningHandlers,
  ...inventoryHandlers,
  ...productionHandlers,
  ...qcHandlers,
};
