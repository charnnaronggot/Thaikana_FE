import {
  audit,
  ensure,
  Handler,
  nonnegative,
  permit,
  required,
  Stage,
  STAGES,
  uid,
} from './models';
import { consumeProof } from '../core/credentials';
import { materialDemand } from './planning';
const machinePrefix: Record<Stage, string> = {
  laser: 'LASER',
  bend: 'BEND',
  weld: 'WELD',
  polish: 'POLISH',
  assembly: 'ASSEMBLY',
};
function workerFor(
  s: Parameters<Handler>[0],
  p: { woId: string; proof?: string },
  c: Parameters<Handler>[2],
  action: string,
) {
  if (c.user.role === 'Station') {
    ensure(
      c.actor.stationId === c.user.id &&
        c.user.stages.includes(required(s.workOrders.find((w) => w.id === p.woId)).stage),
      'Station อยู่นอกขอบเขตงาน',
      'denied',
    );
    return consumeProof(s, p.proof ?? '', action, p.woId, c);
  }
  permit(c, ['Operator']);
  ensure(
    c.user.stages.includes(required(s.workOrders.find((w) => w.id === p.woId)).stage),
    'ผู้ทำงานอยู่นอกขอบเขตสถานี',
    'denied',
  );
  return c.user;
}
export const productionHandlers: Record<string, Handler> = {
  'execution.start': (s, d, c) => {
    const p = d as { woId: string; machine: string; proof?: string };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(w.status === 'Ready', 'งานเริ่มแล้วหรือสถานะเปลี่ยน', 'conflict');
    const worker = workerFor(s, p, c, 'start');
    ensure(p.machine.toUpperCase().startsWith(machinePrefix[w.stage]), 'เครื่องจักรไม่ตรงขั้นตอน');
    ensure(
      !s.executions.some((e) => e.status === 'Running' && e.workerId === worker.id),
      'Worker กำลังทำงานอื่นอยู่',
      'conflict',
    );
    ensure(
      !s.executions.some((e) => e.status === 'Running' && e.machine === p.machine),
      'เครื่องจักรกำลังทำงานอื่นอยู่',
      'conflict',
    );
    ensure(
      !s.executions.some((e) => e.woId === w.id && e.status !== 'Complete'),
      'WO นี้มีคนทำแล้ว',
      'conflict',
    );
    if (w.stage === 'laser')
      for (const [id, need] of Object.entries(materialDemand(w.snapshot, w.quantity)))
        ensure((w.issued[id] ?? 0) >= need, 'ยังเบิกวัสดุเข้า WO ไม่ครบ: ' + id, 'readiness');
    const id = uid();
    s.executions.push({
      id,
      woId: w.id,
      stage: w.stage,
      workerId: worker.id,
      stationId: c.actor.stationId ?? null,
      machine: p.machine,
      status: 'Running',
      startedAt: c.now,
      segmentStartedAt: c.now,
      elapsedMs: 0,
      completedAt: null,
      good: 0,
      reject: 0,
      scrap: 0,
      reason: '',
    });
    w.status = 'Running';
    audit(s, c, 'Operation Start', w.id, 'Worker ' + worker.id + ' / ' + p.machine);
    return id;
  },
  'execution.pause': (s, d, c) => {
    const p = d as { woId: string; reason: string; proof?: string };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(w.status === 'Running' && p.reason.trim(), 'งานต้องกำลังทำและระบุเหตุผล');
    const e = required(s.executions.find((e) => e.woId === w.id && e.status === 'Running'));
    const worker = workerFor(s, p, c, 'pause');
    ensure(e.workerId === worker.id, 'PIN/ผู้ทำงานไม่ตรงการ์ดที่เลือก', 'denied');
    e.elapsedMs += Date.parse(c.now) - Date.parse(required(e.segmentStartedAt));
    e.segmentStartedAt = null;
    e.status = 'Paused';
    e.reason = p.reason;
    w.status = 'Paused';
    audit(s, c, 'Operation Pause', w.id, p.reason + ' / Worker ' + worker.id);
    return true;
  },
  'execution.resume': (s, d, c) => {
    const p = d as { woId: string; proof?: string };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(w.status === 'Paused', 'งานไม่ได้หยุดอยู่', 'conflict');
    const e = required(s.executions.find((e) => e.woId === w.id && e.status === 'Paused'));
    const worker = workerFor(s, p, c, 'resume');
    ensure(e.workerId === worker.id, 'ผู้ทำงานไม่ตรงการ์ดที่เลือก', 'denied');
    ensure(
      !s.executions.some(
        (x) =>
          x.id !== e.id &&
          x.status === 'Running' &&
          (x.workerId === worker.id || x.machine === e.machine),
      ),
      'Worker หรือเครื่องจักรกำลังทำงานอื่น',
      'conflict',
    );
    e.status = 'Running';
    e.segmentStartedAt = c.now;
    w.status = 'Running';
    audit(s, c, 'Operation Resume', w.id, 'Worker ' + worker.id);
    return true;
  },
  'execution.complete': (s, d, c) => {
    const p = d as { woId: string; good: number; reject: number; scrap: number; proof?: string };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(w.status === 'Running', 'งานไม่ได้กำลังทำ', 'conflict');
    const e = required(s.executions.find((e) => e.woId === w.id && e.status === 'Running'));
    const worker = workerFor(s, p, c, 'complete');
    ensure(e.workerId === worker.id, 'PIN/ผู้ทำงานไม่ตรงการ์ดที่เลือก', 'denied');
    for (const n of [p.good, p.reject, p.scrap]) {
      nonnegative(n);
      ensure(Number.isInteger(n), 'จำนวนผลผลิตต้องเป็นจำนวนเต็ม');
    }
    ensure(
      p.good > 0 && p.good + p.reject + p.scrap === w.processQuantity,
      'Good + Reject + Scrap ต้องเท่ากับจำนวนงานในขั้นนี้',
    );
    e.elapsedMs += Date.parse(c.now) - Date.parse(required(e.segmentStartedAt));
    e.segmentStartedAt = null;
    e.completedAt = c.now;
    e.status = 'Complete';
    e.good = p.good;
    e.reject = p.reject;
    e.scrap = p.scrap;
    const i = STAGES.indexOf(w.stage);
    if (i < STAGES.length - 1) {
      w.stage = STAGES[i + 1];
      w.processQuantity = p.good;
      w.status = 'Ready';
    } else {
      w.status = 'QC';
      w.qcPending = p.good;
    }
    audit(
      s,
      c,
      'Operation Complete',
      w.id,
      'Worker ' + worker.id + ' · Good ' + p.good + ' Reject ' + p.reject + ' Scrap ' + p.scrap,
    );
    return true;
  },
  'production.problem': (s, d, c) => {
    permit(c, ['Operator', 'Station']);
    const p = d as {
      woId: string;
      reason: string;
      destination: Stage;
      note: string;
      assetIds: string[];
    };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(
      w.status === 'Running' || w.status === 'Paused' || w.status === 'QC',
      'งานไม่อยู่ระหว่างผลิต/ตรวจ',
    );
    ensure(p.reason.trim() && STAGES.includes(p.destination), 'ระบุเหตุผลและสถานีปลายทาง');
    ensure(
      p.assetIds.every((id) => s.assets.some((a) => a.id === id)),
      'ไฟล์แนบไม่พบ',
    );
    s.problems.push({
      id: uid(),
      woId: w.id,
      source: w.stage,
      destination: p.destination,
      reason: p.reason,
      note: p.note,
      assetIds: p.assetIds,
      actorId: c.user.id,
      at: c.now,
      resolved: false,
    });
    audit(s, c, 'Production Problem', w.id, p.reason + ' → ' + p.destination);
    return true;
  },
};
