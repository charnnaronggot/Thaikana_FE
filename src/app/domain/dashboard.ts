import { DemoState, SalesOrder } from './models';
export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  detail: string;
  route: string;
}
export function searchRecords(s: DemoState, query: string): SearchHit[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [
    ...s.quotations.map((x) => ({
      id: x.id,
      kind: 'Quotation',
      title: x.number + ' / R' + x.revision,
      detail: x.customer + ' ' + x.lines.map((l) => l.name).join(' '),
      route: '/sales/' + x.id,
    })),
    ...s.orders.map((x) => ({
      id: x.id,
      kind: 'Sales Order',
      title: x.number,
      detail: x.customer + ' ' + x.po,
      route: '/planning',
    })),
    ...s.workOrders.map((x) => ({
      id: x.id,
      kind: 'Work Order',
      title: x.number,
      detail: x.snapshot.name + ' ' + x.snapshot.code + ' ' + x.snapshot.drawingNumber,
      route: '/production',
    })),
    ...s.revisions.map((x) => ({
      id: x.id,
      kind: 'Product',
      title: x.code + ' / R' + x.revision,
      detail: x.name + ' ' + x.spec,
      route: '/design',
    })),
    ...s.materials.map((x) => ({
      id: x.id,
      kind: 'Material',
      title: x.code,
      detail: x.name + ' ' + x.barcode + ' ' + x.lot,
      route: '/inventory',
    })),
    ...s.deliveries.map((x) => ({
      id: x.id,
      kind: 'Delivery',
      title: x.number,
      detail: x.reference + ' ' + x.carrier,
      route: '/delivery',
    })),
    ...s.documents.map((x) => ({
      id: x.id,
      kind: 'Document',
      title: x.number,
      detail: x.kind + ' ' + x.referenceId,
      route: '/documents',
    })),
  ];
  return hits
    .filter((h) => (h.title + ' ' + h.detail).toLocaleLowerCase().includes(q))
    .slice(0, 50);
}
export function progress(s: DemoState, o: SalesOrder) {
  return o.lines.map((line) => ({
    id: line.id,
    name: line.name,
    ordered: line.quantity,
    allocated: line.allocated,
    woCount: s.workOrders.filter((w) => w.orderLineId === line.id).length,
    inProduction: s.workOrders
      .filter((w) => w.orderLineId === line.id && ['Ready', 'Running', 'Paused'].includes(w.status))
      .reduce((n, w) => n + w.processQuantity, 0),
    qcPending: s.workOrders
      .filter((w) => w.orderLineId === line.id)
      .reduce((n, w) => n + w.qcPending, 0),
    fgReceived: s.workOrders
      .filter((w) => w.orderLineId === line.id)
      .reduce((n, w) => n + w.fgReceived, 0),
    dispatched: line.dispatched,
    delivered: line.delivered,
  }));
}
export function dashboardMetrics(s: DemoState) {
  const now = Date.now();
  return {
    openQuotes: s.quotations.filter((q) => !q.superseded && q.decision === 'Pending').length,
    activeWo: s.workOrders.filter((w) => ['Ready', 'Running', 'Paused', 'QC'].includes(w.status))
      .length,
    overdueWo: s.workOrders.filter(
      (w) =>
        ['Ready', 'Running', 'Paused', 'QC'].includes(w.status) &&
        new Date(w.dueDate).getTime() < now,
    ).length,
    qcQueue: s.workOrders.reduce((n, w) => n + w.qcPending, 0),
    qcFailed: s.inspections.reduce((n, i) => n + i.failed, 0),
    readyDispatch: s.allocations.reduce((n, a) => n + a.quantity - a.dispatched, 0),
    materialShortage: s.materials.filter((m) => m.onHand - m.reserved < m.reorder).length,
    delivered: s.deliveries.filter((d) => d.status === 'Delivered').length,
  };
}
