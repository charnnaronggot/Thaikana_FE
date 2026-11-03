// Agile Production Board view model. Lanes are computed by the server from
// readiness/execution; the client only groups and labels them. Cards are never
// moved by the client: a stage changes only through Start/Pause/Resume/Complete.
export type AgileLane = 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'PAUSED' | 'DONE';
export const AGILE_LANES: readonly AgileLane[] = ['BLOCKED', 'READY', 'IN_PROGRESS', 'PAUSED', 'DONE'];
export const AGILE_LANE_LABELS: Readonly<Record<AgileLane, string>> = {
  BLOCKED: 'ติดเงื่อนไข', READY: 'พร้อมเริ่ม', IN_PROGRESS: 'กำลังทำ', PAUSED: 'พัก', DONE: 'เสร็จที่สถานีนี้',
};
export const AGILE_DRAG_NOTICE = 'ลากการ์ดไม่เปลี่ยนขั้นตอน · ขั้นตอนเปลี่ยนเมื่อบันทึกเริ่มงาน พักงาน ทำต่อ หรือจบรอบผลิตเท่านั้น';
export interface AgileCardLike { lane: string; work: { operationId: string } }
/** Group in the server's lane order; unknown lanes are kept (shown last) rather than dropped. */
export function agileColumns<T extends AgileCardLike>(cards: readonly T[], lanes: readonly string[] = AGILE_LANES) {
  const order = [...lanes, ...cards.map((c) => c.lane).filter((lane, i, all) => !lanes.includes(lane) && all.indexOf(lane) === i)];
  return order.map((id) => ({ id, name: AGILE_LANE_LABELS[id as AgileLane] ?? id, items: cards.filter((c) => c.lane === id) }));
}
/** Drag is a no-op on this board. Returns the explanation to show the user. */
export function blockAgileDrag(event: Pick<DragEvent, 'preventDefault'> & { dataTransfer?: DataTransfer | null }) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  return AGILE_DRAG_NOTICE;
}
