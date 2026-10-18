import type { SalesQuoteItem, ProductRevision } from './sales-api.models';

export const workflowLabels: Record<string, string> = {
  NeedsDesign: 'รอ Sales ส่งงาน',
  WaitingDesign: 'รอแบบและต้นทุน',
  ReadyToPrice: 'พร้อมตั้งราคา',
  ReadyToIssue: 'พร้อมออกเอกสาร',
  ReadyToSend: 'พร้อมส่งลูกค้า',
  AwaitingCustomer: 'รอลูกค้าตอบรับ',
  Accepted: 'ส่งต่อ Planning แล้ว',
  Closed: 'ปิดรายการ',
};
export const workflowGuidance: Record<
  string,
  { title: string; description: string; owner: string }
> = {
  NeedsDesign: {
    title: 'ส่งโจทย์ให้ Design',
    description: 'ตรวจ Requirement แล้วส่งเฉพาะรายการสั่งทำ สินค้าเดิมใช้แบบและต้นทุนที่มีอยู่ได้',
    owner: 'Sales',
  },
  WaitingDesign: {
    title: 'กำลังรอแบบและต้นทุนจาก Design',
    description: 'ติดตามความคืบหน้ารายสินค้าได้ด้านล่าง เมื่อได้รับต้นทุนแล้วจึงตั้งราคาขาย',
    owner: 'Design',
  },
  ReadyToPrice: {
    title: 'ได้รับต้นทุนแล้ว · ตั้งราคาขายต่อได้เลย',
    description:
      'ตรวจต้นทุนวัตถุดิบและต้นทุนอ้างอิงจาก Design แล้วกรอก COGS ที่ใช้ตั้งราคา กำหนดราคาขายและส่วนลด',
    owner: 'Sales',
  },
  ReadyToIssue: {
    title: 'ราคาครบแล้ว · พร้อมออกใบเสนอราคา',
    description: 'ตรวจยอดและรายละเอียด แล้วดาวน์โหลด PDF รุ่นล่าสุดก่อนส่งลูกค้า',
    owner: 'Sales',
  },
  ReadyToSend: {
    title: 'เอกสารพร้อมแล้ว · บันทึกการส่งลูกค้า',
    description: 'ส่ง PDF ให้ลูกค้า แล้วกดส่งใบเสนอราคาเพื่อเริ่มติดตามผลตอบรับ',
    owner: 'Sales',
  },
  AwaitingCustomer: {
    title: 'รอคำตอบจากลูกค้า',
    description:
      'เมื่อลูกค้ารับราคา ให้แนบหลักฐาน/PO และระบุกำหนดส่ง ถ้าเปลี่ยนราคาใช้แบบเดิม ถ้าเปลี่ยนสเปกส่งเฉพาะรายการกลับ Design',
    owner: 'ลูกค้า / Sales',
  },
  Accepted: {
    title: 'รับคำสั่งซื้อและส่งต่อ Planning แล้ว',
    description: 'เก็บแบบ ราคา หลักฐานและ PO ของรุ่นนี้ไว้ตรวจย้อนหลัง',
    owner: 'Planning',
  },
  Closed: {
    title: 'รายการนี้ปิดแล้ว',
    description: 'ดูข้อมูลและประวัติเอกสารย้อนหลังได้',
    owner: 'Sales',
  },
};
export function lineProgress(item: SalesQuoteItem) {
  switch (item.designState) {
    case 'Ready':
      return { label: 'แบบและต้นทุนพร้อม', owner: 'Sales · ตั้งราคาขาย', tone: 'ready' };
    case 'InProgress':
      return {
        label: 'Design กำลังทำงาน',
        owner: 'Design · จัดทำแบบ BOM และต้นทุน',
        tone: 'waiting',
      };
    case 'Waiting':
      return {
        label: 'ส่ง Design แล้ว · รอเริ่มงาน',
        owner: 'Design · รับโจทย์และเริ่มออกแบบ',
        tone: 'waiting',
      };
    case 'CostMissing':
      return {
        label: 'ยังไม่มีต้นทุนยืนยัน',
        owner: 'Sales · ขอแบบและต้นทุนจาก Design',
        tone: 'waiting',
      };
    default:
      return {
        label: 'ยังไม่ได้ส่ง Design',
        owner: 'Sales · ตรวจโจทย์และส่งออกแบบ',
        tone: 'pending',
      };
  }
}
export function suggestedProduct(item: SalesQuoteItem, products: ProductRevision[]) {
  const options = products.filter(
    (p) =>
      p.status === 'Approved' &&
      !!p.cost &&
      (item.requiredDesignId
        ? p.designId === item.requiredDesignId
        : p.id === item.productRevisionId),
  );
  return (
    options.find((p) => p.id === item.productRevisionId)?.id ??
    (options.length === 1 ? options[0].id : undefined)
  );
}
