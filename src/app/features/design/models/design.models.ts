export interface DesignItem {
  id: string;
  code: string;
  name: string;
  itemType: string;
  baseUomId: string;
}
export interface DesignLookups {
  items: DesignItem[];
  uoms: { id: string; code: string; name: string }[];
  plants: { id: string; code: string; name: string }[];
  revisions: { id: string; itemId: string; revisionCode: string }[];
}
export interface DesignSummary {
  id: string;
  itemId: string;
  code: string;
  name: string;
  revisionCode: string;
  status: string;
  rowVersion: number;
  designSubmissionId: string | null;
  frozenAt: string | null;
}
export interface DesignTask {
  id: string;
  roundNo: number;
  submittedAt: string;
  lineNo: number;
  requestedQty: number;
  itemId: string | null;
  requestNo: string;
  customer: string;
  requirement: unknown;
  quotations: string[];
  current: boolean;
  revisions: { id: string; revisionCode: string; status: string; rowVersion: number }[];
}
export interface DesignInbox {
  tasks: DesignTask[];
  products: DesignSummary[];
}
export interface DesignDrawing {
  fileId: string;
  drawingNo: string;
  note: string | null;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
}
export interface DesignBom {
  itemId: string;
  revisionId: string | null;
  quantity: number;
  scrapAllowancePct: number;
  note: string | null;
}
export type CostCategory = 'MATERIAL' | 'LABOR' | 'OVERHEAD' | 'WASTE';
export interface DesignCost {
  category: CostCategory;
  quantity: number;
  unitCost: number;
  sourceNote: string;
  amount?: number;
}
export interface DesignSpecification {
  [key: string]: unknown;
  description: string;
  dimensions: string;
  finish: string;
  checklist: { code: string; label?: string; required: boolean }[];
}
export interface DesignDetail {
  revision: {
    id: string;
    itemId: string;
    revisionCode: string;
    status: string;
    rowVersion: number;
    predecessorId: string | null;
  };
  item: DesignItem;
  source: {
    id: string;
    requestNo: string;
    lineNo: number;
    requestedQty: number;
    requirement: unknown;
  } | null;
  current: boolean;
  attachments: { fileId: string; originalName: string; mimeType: string }[] | null;
  specification: DesignSpecification;
  outputBaseQty: number;
  components: DesignBom[];
  drawings: DesignDrawing[];
  plantId: string;
  costs: DesignCost[];
  history: {
    id: string;
    revisionCode: string;
    status: string;
    frozenAt: string | null;
    predecessorId: string | null;
  }[];
}
