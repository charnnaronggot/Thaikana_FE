import type { components } from '../../../core/services/api/generated/schema';
export type SalesQuoteItem = components['schemas']['QuotationItemResponse'] & {
  designState?: 'NotSent' | 'Waiting' | 'InProgress' | 'Ready' | 'CostMissing';
  suggestedRevisionId?: string | null;
};
export type Quotation = Omit<components['schemas']['QuotationResponse'], 'items'> & {
  items?: SalesQuoteItem[] | null;
  workflowStage?: string;
};
export interface DesignCost {
  estimateId: string;
  productRevisionId: string;
  plantId: string;
  frozenAt: string;
  outputQty: number;
  material: number;
  labor: number;
  overhead: number;
  waste: number;
  unitCost: number;
  currency: string;
}
export type ProductRevision = components['schemas']['ProductRevisionResponse'] & {
  cost?: DesignCost | null;
  specification?: string;
  drawings?: { fileId: string; drawingNo: string; originalName: string; mimeType: string }[];
};
export type QuotationRevision = components['schemas']['QuotationRevisionResponse'];
export type PriceLine = components['schemas']['PriceLine'];
export type SalesOrder = components['schemas']['SalesOrderResponse'];
export type ManagedFile = components['schemas']['ManagedFileResponse'];
export type LineDesignChange = components['schemas']['QuotationLineDesignChangeResponse'];
