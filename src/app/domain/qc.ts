import {
  audit,
  ensure,
  Handler,
  nonnegative,
  permit,
  positive,
  required,
  STAGES,
  Stage,
  uid,
  WorkOrder,
} from './models';
export const qcHandlers: Record<string, Handler> = {
  'qc.inspect': (s, d, c) => {
    permit(c, ['QC']);
    const p = d as {
      woId: string;
      quantity: number;
      passed: number;
      failed: number;
      pending: number;
      checklist: boolean[];
      photos: string[];
      reason: string;
      destination: Stage;
    };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(w.status === 'QC' && w.qcPending > 0, 'WO ไม่อยู่ในคิวตรวจ', 'conflict');
    for (const n of [p.quantity, p.passed, p.failed, p.pending]) {
      nonnegative(n);
      ensure(Number.isInteger(n), 'จำนวนตรวจต้องเป็นจำนวนเต็ม');
    }
    positive(p.quantity);
    ensure(p.quantity <= w.qcPending, 'จำนวนตรวจเกินยอดรอตรวจ');
    ensure(
      p.passed + p.failed + p.pending === p.quantity,
      'ผ่าน + ไม่ผ่าน + ค้าง ต้องเท่าจำนวนที่ตรวจ',
    );
    ensure(p.checklist.length >= 3 && p.checklist.every(Boolean), 'กรอก Checklist ให้ครบ');
    ensure(
      p.photos.length === 4 && p.photos.every((id) => s.assets.some((a) => a.id === id)),
      'แนบรูป QC 4 ด้านให้ครบ',
    );
    if (p.failed)
      ensure(
        p.reason.trim() && STAGES.includes(p.destination),
        'งานไม่ผ่านต้องมีเหตุผลและสถานีปลายทาง',
      );
    const id = uid();
    s.inspections.push({
      id,
      woId: w.id,
      quantity: p.quantity,
      passed: p.passed,
      failed: p.failed,
      pending: p.pending,
      checklist: p.checklist,
      photos: p.photos,
      reason: p.reason,
      destination: p.destination,
      actorId: c.user.id,
      at: c.now,
      received: false,
    });
    w.qcPending -= p.passed + p.failed;
    if (w.qcPending === 0) w.status = 'Complete';
    if (p.failed) {
      const rework: WorkOrder = {
        ...structuredClone(w),
        id: uid(),
        number: 'RW-' + String(s.workOrders.length + 1).padStart(5, '0'),
        quantity: p.failed,
        processQuantity: p.failed,
        stage: p.destination,
        status: 'Ready',
        reason: 'Rework จาก ' + w.number + ' · ' + p.reason,
        reserved: {},
        issued: {},
        qcPending: 0,
        fgReceived: 0,
        createdAt: c.now,
      };
      s.workOrders.push(rework);
      s.problems.push({
        id: uid(),
        woId: w.id,
        source: 'QC',
        destination: p.destination,
        reason: p.reason,
        note: 'Rework ' + rework.number,
        assetIds: [...p.photos],
        actorId: c.user.id,
        at: c.now,
        resolved: false,
      });
    }
    audit(
      s,
      c,
      'QC inspection',
      w.id,
      'Pass ' + p.passed + ' Fail ' + p.failed + ' Pending ' + p.pending,
    );
    return id;
  },
  'fg.receive': (s, d, c) => {
    permit(c, ['QC', 'Store']);
    const p = d as { inspectionId: string; lot: string; location: string };
    const inspection = required(s.inspections.find((i) => i.id === p.inspectionId));
    ensure(
      !inspection.received && inspection.passed > 0,
      'จำนวนผ่านตรวจนี้รับ FG แล้วหรือเป็นศูนย์',
    );
    ensure(p.lot.trim() && p.location.trim(), 'ระบุ Lot และ Location');
    const w = required(s.workOrders.find((w) => w.id === inspection.woId));
    s.fg.push({
      id: uid(),
      revisionId: w.snapshot.id,
      code: 'FG-' + String(s.fg.length + 1).padStart(5, '0'),
      location: p.location,
      quantity: inspection.passed,
      reserved: 0,
      inspectionId: inspection.id,
    });
    inspection.received = true;
    w.fgReceived += inspection.passed;
    audit(s, c, 'Finished Goods received', w.id, p.lot + ' / ' + inspection.passed);
    return true;
  },
};
