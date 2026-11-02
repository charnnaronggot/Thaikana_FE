import type { components } from '../../core/services/api/generated/native-schema';

export type DashboardSummary = components['schemas']['DashboardSummary'];
type Metric = Exclude<keyof DashboardSummary, 'nextActions'>;

const metricLabels: Record<Metric, string> = {
  openWorkOrders: 'WO ที่ยังไม่จบ',
  activeRuns: 'งานกำลังผลิต',
  materialShortages: 'คำขอวัสดุขาด',
  pendingQc: 'รอตรวจ QC',
  pendingGps: 'รอตรวจสถานที่ส่งมอบ',
  failedPdf: 'เอกสารสร้างไม่สำเร็จ',
  unpublishedEvents: 'รายการรอประมวลผล',
};
const actionLabels: Record<string, string> = {
  'planning.material_shortage': 'วัสดุขาด · รอ Planner ตัดสินใจ',
  'qc.pending_inspection': 'รอตรวจคุณภาพ',
  'delivery.awaiting_pod': 'ส่งออกแล้ว · รอยืนยันส่งมอบ (POD)',
};

// The API returns null for a count outside the actor's scope; never show it as 0.
export function dashboardStats(summary: DashboardSummary): { label: string; value: number }[] {
  return (Object.keys(metricLabels) as Metric[])
    .filter((key) => summary[key] !== null && summary[key] !== undefined)
    .map((key) => ({ label: metricLabels[key], value: Number(summary[key]) }));
}

export function dashboardNextActions(summary: DashboardSummary): { label: string; count: number; path: string }[] {
  return (summary.nextActions ?? [])
    .filter((action) => action.path.startsWith('/') && !action.path.startsWith('//'))
    .map((action) => ({ label: actionLabels[action.code] ?? action.code, count: Number(action.count), path: action.path }));
}
