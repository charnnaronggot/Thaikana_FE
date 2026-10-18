import type { components } from '../../../core/services/api/generated/schema';
export type SalesQuoteItem = components['schemas']['QuotationItemResponse'] & {
  designState?: 'NotSent' | 'Waiting' | 'InProgress' | 'Ready' | 'CostMissing';
  suggestedRevisionId?: string | null;
  salesUnitCost?: number | null; salesLaborCost?: number | null; salesOverheadCost?: number | null; salesMaterialCost?: number | null;
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
  materials?: BomMaterialCost[] | null;
  cost?: DesignCost | null;
  specification?: string;
  drawings?: { fileId: string; drawingNo: string; originalName: string; mimeType: string }[];
};
export interface BomMaterialCost {
  referenceUnitCost?: number | null;
  referenceSource?: string | null;
  referenceAt?: string | null;
  referenceAmount?: number | null;
  lineNo: number;
  itemId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  scrapAllowancePct: number;
  outputBaseQty: number;
  unitCost: number | null;
  amount: number | null;
  source: string | null;
}
export type QuotationRevision = Omit<
  components['schemas']['QuotationRevisionResponse'],
  'lines'
> & {
  lines?:
    | (NonNullable<components['schemas']['QuotationRevisionResponse']['lines']>[number] & {
        salesUnitCost?: number | null; salesLaborCost?: number | null; salesOverheadCost?: number | null; salesMaterialCost?: number | null;
        salesCostEnteredBy?: string | null;
        salesCostEnteredAt?: string | null;
      })[]
    | null;
};
export type PriceLine = components['schemas']['PriceLine'] & { salesUnitCost?: number | null; salesLaborCost?: number | null; salesOverheadCost?: number | null; salesMaterialCost?: number | null };
export type SalesOrder = components['schemas']['SalesOrderResponse'];
export type ManagedFile = components['schemas']['ManagedFileResponse'];
export type LineDesignChange = components['schemas']['QuotationLineDesignChangeResponse'];
