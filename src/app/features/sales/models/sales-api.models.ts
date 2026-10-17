import type { components } from '../../../core/services/api/generated/schema';
export type Quotation=components['schemas']['QuotationResponse'];
export interface DesignCost {
  estimateId: string; productRevisionId: string; plantId: string; frozenAt: string;
  outputQty: number; material: number; labor: number; overhead: number; waste: number;
  unitCost: number; currency: string;
}
export type ProductRevision=components['schemas']['ProductRevisionResponse'] & { cost?: DesignCost | null };
export type QuotationRevision=components['schemas']['QuotationRevisionResponse'];
export type PriceLine=components['schemas']['PriceLine'];
export type SalesOrder=components['schemas']['SalesOrderResponse'];
export type ManagedFile=components['schemas']['ManagedFileResponse'];
export type LineDesignChange=components['schemas']['QuotationLineDesignChangeResponse'];
