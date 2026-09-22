export type Role =
  | 'Admin'
  | 'Sales'
  | 'Designer'
  | 'Planner'
  | 'Store'
  | 'Operator'
  | 'QC'
  | 'Delivery'
  | 'Viewer'
  | 'Station';
export const STAGES = ['laser', 'bend', 'weld', 'polish', 'assembly'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  laser: 'เลเซอร์คัท',
  bend: 'พับ',
  weld: 'เชื่อม',
  polish: 'ขัดผิว',
  assembly: 'ประกอบ',
};
export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  stages: Stage[];
  pinFailures: number;
  locked: boolean;
  credentialVersion: number;
}
export interface Actor {
  userId: string;
  stationId?: string;
  deviceId: string;
}
export interface Asset {
  id: string;
  name: string;
  mime: string;
  blob: Blob;
}
export interface BomLine {
  materialId: string;
  quantity: number;
  scrapPercent: number;
  note: string;
}
export interface ProductRevision {
  id: string;
  productId: string;
  code: string;
  name: string;
  revision: number;
  status: 'Draft' | 'Approved';
  spec: string;
  drawingNumber: string;
  drawings: string[];
  bom: BomLine[];
  labor: number;
  overhead: number;
  waste: number;
  materialCost: number;
  cost: number | null;
  costDate: string;
}
export interface QuoteLine {
  id: string;
  kind: 'Existing' | 'MadeToOrder';
  productRevisionId: string | null;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  spec: string;
  finish: string;
  requirement: string;
  unitPrice: number | null;
  discount: number;
}
export interface Quotation {
  id: string;
  number: string;
  revision: number;
  status: 'Draft' | 'Design' | 'Pricing' | 'Issued';
  decision: 'Pending' | 'Accepted' | 'Rejected' | 'Expired';
  superseded: boolean;
  customer: string;
  contact: string;
  address: string;
  dueDate: string;
  validUntil: string;
  vatRate: number;
  salesId: string;
  lines: QuoteLine[];
  createdAt: string;
  po: string;
  evidence: string;
  decisionReason: string;
}
export interface DesignTask {
  id: string;
  quoteId: string;
  lineId: string;
  revisionId: string;
  status: 'Open' | 'Approved';
  assignedTo: string;
  dueDate: string;
}
export interface OrderLine {
  id: string;
  quoteLineId: string;
  productRevisionId: string;
  name: string;
  quantity: number;
  planned: number;
  allocated: number;
  dispatched: number;
  delivered: number;
}
export interface SalesOrder {
  id: string;
  number: string;
  quoteId: string;
  customer: string;
  po: string;
  address: string;
  dueDate: string;
  lines: OrderLine[];
}
export interface WorkOrder {
  id: string;
  number: string;
  orderId: string | null;
  orderLineId: string | null;
  snapshot: ProductRevision;
  quantity: number;
  processQuantity: number;
  stage: Stage;
  status: 'Ready' | 'Running' | 'Paused' | 'QC' | 'Complete' | 'Cancelled';
  dueDate: string;
  priority: 'Normal' | 'High';
  reason: string;
  salesName: string;
  printNote: string;
  reserved: Record<string, number>;
  issued: Record<string, number>;
  qcPending: number;
  fgReceived: number;
  createdAt: string;
}
export interface Execution {
  id: string;
  woId: string;
  stage: Stage;
  workerId: string;
  stationId: string | null;
  machine: string;
  status: 'Running' | 'Paused' | 'Complete';
  startedAt: string;
  segmentStartedAt: string | null;
  elapsedMs: number;
  completedAt: string | null;
  good: number;
  reject: number;
  scrap: number;
  reason: string;
}
export interface Problem {
  id: string;
  woId: string;
  source: string;
  destination: Stage;
  reason: string;
  note: string;
  assetIds: string[];
  actorId: string;
  at: string;
  resolved: boolean;
}
export interface Material {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: string;
  location: string;
  barcode: string;
  lot: string;
  onHand: number;
  reserved: number;
  averageCost: number;
  reorder: number;
  active: boolean;
}
export type MovementType =
  'Receive' | 'Reserve' | 'Issue' | 'Return' | 'Adjust' | 'Scrap' | 'Unreserve';
export interface Movement {
  id: string;
  materialId: string;
  type: MovementType;
  quantity: number;
  onHand: number;
  reserved: number;
  cost: number;
  reference: string;
  reason: string;
  actorId: string;
  at: string;
}
export interface Inspection {
  id: string;
  woId: string;
  quantity: number;
  passed: number;
  failed: number;
  pending: number;
  checklist: boolean[];
  photos: string[];
  reason: string;
  destination: Stage;
  actorId: string;
  at: string;
  received: boolean;
}
export interface FgLot {
  id: string;
  revisionId: string;
  code: string;
  location: string;
  quantity: number;
  reserved: number;
  inspectionId: string | null;
}
export interface Allocation {
  id: string;
  orderId: string;
  lineId: string;
  lotId: string;
  quantity: number;
  dispatched: number;
}
export interface DeliveryLine {
  allocationId: string;
  quantity: number;
  revisionId: string;
  name: string;
}
export interface Delivery {
  id: string;
  number: string;
  orderId: string;
  status: 'Dispatched' | 'Delivered';
  lines: DeliveryLine[];
  boxes: number;
  carrier: string;
  reference: string;
  address: string;
  dispatchedAt: string;
  deliveredAt: string | null;
  receiver: string;
  proof: string;
  coordinates: string;
  actorId: string;
}
export interface DocumentRecord {
  id: string;
  number: string;
  kind: 'Quotation' | 'WorkOrder' | 'Label' | 'Invoice' | 'Billing' | 'Receipt';
  referenceId: string;
  revision: number;
  assetId: string;
  createdAt: string;
  snapshot: unknown;
  total: number;
}
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  reference: string;
  at: string;
  actorId: string;
}
export interface Audit {
  id: string;
  actorId: string;
  stationId: string | null;
  action: string;
  target: string;
  at: string;
  detail: string;
}
export interface DemoState {
  schema: 1;
  version: number;
  users: User[];
  revisions: ProductRevision[];
  quotations: Quotation[];
  designs: DesignTask[];
  orders: SalesOrder[];
  workOrders: WorkOrder[];
  executions: Execution[];
  problems: Problem[];
  materials: Material[];
  movements: Movement[];
  inspections: Inspection[];
  fg: FgLot[];
  allocations: Allocation[];
  deliveries: Delivery[];
  documents: DocumentRecord[];
  payments: Payment[];
  assets: Asset[];
  audit: Audit[];
  applied: Record<string, unknown>;
  settings: { vatRate: number };
}
export interface Command<T = unknown> {
  type: string;
  data: T;
  key: string;
  expectedVersion: number;
}
export interface CommandContext {
  actor: Actor;
  now: string;
  user: User;
}
export type Handler = (state: DemoState, data: unknown, context: CommandContext) => unknown;
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function ensure(value: unknown, message: string, code = 'validation'): asserts value {
  if (!value) throw new DomainError(code, message);
}
export function required<T>(value: T | undefined | null, message = 'ไม่พบรายการ'): T {
  ensure(value != null, message, 'not_found');
  return value;
}
export function positive(n: number, label = 'จำนวน'): void {
  ensure(
    Number.isFinite(n) && n > 0 && n <= 1e9,
    label + ' ต้องมากกว่า 0 และไม่เกิน 1,000,000,000',
  );
}
export function nonnegative(n: number, label = 'จำนวน'): void {
  ensure(Number.isFinite(n) && n >= 0 && n <= 1e12, label + ' ต้องไม่ติดลบ');
}
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
export function permit(ctx: CommandContext, roles: Role[]): void {
  ensure(
    ctx.user.active && (ctx.user.role === 'Admin' || roles.includes(ctx.user.role)),
    'ไม่มีสิทธิ์ดำเนินการ กรุณาติดต่อผู้ดูแล',
    'denied',
  );
}
export function audit(
  state: DemoState,
  ctx: CommandContext,
  action: string,
  target: string,
  detail = '',
): void {
  state.audit.unshift({
    id: uid(),
    actorId: ctx.user.id,
    stationId: ctx.actor.stationId ?? null,
    action,
    target,
    at: ctx.now,
    detail,
  });
}
