import { DataColumn } from '../../shared/components/data-table.component';
export interface NativeSection {
  kind: string;
  label: string;
  columns: DataColumn[];
  detail?: boolean;
}
export interface NativeModule {
  title: string;
  description: string;
  note: string;
  sections: NativeSection[];
}
const c = (key: string, label: string): DataColumn => ({ key, label });
const workOrders: NativeSection = {
  kind: 'work-orders',
  label: 'ใบสั่งผลิต',
  detail: true,
  columns: [
    c('woNo', 'เลขที่ WO'),
    c('plannedQty', 'จำนวนผลิต'),
    c('cancelledQty', 'ยกเลิก'),
    c('dueDate', 'กำหนดส่ง'),
    c('status', 'สถานะ'),
  ],
};
const operations: NativeSection = {
  kind: 'operations',
  label: 'ขั้นตอนผลิต',
  detail: true,
  columns: [
    c('workOrderNumber', 'ใบสั่งผลิต'),
    c('operationNo', 'ขั้นตอน'),
    c('centerName', 'สถานี'),
    c('inputQty', 'จำนวนรับเข้า'),
    c('status', 'สถานะ'),
  ],
};
export const nativeModules: Record<string, NativeModule> = {
  design: {
    title: 'ออกแบบ',
    description: 'คำขอจาก Sales และแบบสินค้าแต่ละ Revision',
    note: 'ดูคำขอ แบบ และ BOM จากระบบจริงได้ การสร้าง/แก้แบบและส่งอนุมัติในหน้านี้ยังไม่เปิดให้ทดสอบ',
    sections: [
      {
        kind: 'sales-requests',
        label: 'คำขอสินค้า / ออกแบบ',
        detail: true,
        columns: [
          c('requestNo', 'เลขที่คำขอ'),
          c('status', 'สถานะ'),
          c('submittedAt', 'วันที่ส่ง'),
        ],
      },
      {
        kind: 'product-revisions',
        label: 'แบบสินค้า',
        detail: true,
        columns: [
          c('productName', 'สินค้า'),
          c('revisionCode', 'Revision'),
          c('status', 'สถานะ'),
          c('frozenAt', 'วันที่เผยแพร่'),
        ],
      },
    ],
  },
  planning: {
    title: 'วางแผนผลิต',
    description: 'ตรวจความต้องการและตัดสินใจออกใบสั่งผลิตผ่าน Planning',
    note: 'Planner: สร้างคำขอ → WO ร่าง → เลือกขั้นผลิตและวันเริ่ม → ทบทวน → จองวัสดุ → Release · Store เบิกจริงก่อน Operator เริ่มงาน',
    sections: [
      {
        kind: 'planning-requests',
        label: 'คำขอวางแผน',
        detail: true,
        columns: [
          c('requestNo', 'เลขที่คำขอ'),
          c('demandTypeLabel', 'ประเภทงาน'),
          c('requestedQty', 'จำนวน'),
          c('dueDate', 'กำหนดส่ง'),
          c('status', 'สถานะ'),
        ],
      },
      workOrders,
    ],
  },
  production: {
    title: 'งานผลิต',
    description: 'ติดตามใบสั่งผลิตและขั้นตอนงานจากข้อมูลจริง',
    note: 'ดูบอร์ด ขั้นตอน และประวัติงานได้ การเริ่ม/พัก/จบงานในหน้านี้ยังไม่เปิดให้ทดสอบ',
    sections: [workOrders, operations],
  },
  station: {
    title: 'งานของสถานี',
    description: 'งานและขั้นตอนที่บัญชีนี้มีสิทธิ์เข้าถึง',
    note: 'บัญชีสถานีเห็นเฉพาะงานในสถานีที่ผูกไว้ การยืนยัน Worker/PIN และเริ่ม/พัก/จบงานในหน้านี้ยังไม่เปิดให้ทดสอบ',
    sections: [operations],
  },
  inventory: {
    title: 'คลังสินค้า',
    description: 'ยอดคงเหลือ คำขอวัสดุ และประวัติการเคลื่อนไหว',
    note: 'Store: เตรียมใบเบิกจาก WO ที่ Release → เบิกจริงตามยอดจอง · รับ/คืน/โอน/ตัดเสีย/ปรับยอดและย้อนรายการต้องตรวจจำนวนและแหล่งอ้างอิงก่อนยืนยัน',
    sections: [
      {
        kind: 'stock',
        label: 'ยอดคงเหลือ',
        columns: [
          c('itemName', 'สินค้า / วัสดุ'),
          c('locationName', 'ตำแหน่งจัดเก็บ'),
          c('stockCategory', 'ประเภทสต็อก'),
          c('onHandQty', 'คงเหลือ'),
          c('unitName', 'หน่วย'),
        ],
      },
      {
        kind: 'material-requests',
        label: 'คำขอวัสดุ',
        detail: true,
        columns: [c('requestNo', 'เลขที่คำขอ'), c('requestType', 'ประเภท'), c('status', 'สถานะ')],
      },
      {
        kind: 'material-documents',
        label: 'เอกสารเคลื่อนไหว',
        detail: true,
        columns: [c('documentNo', 'เลขที่เอกสาร'), c('postedAt', 'วันที่บันทึก')],
      },
    ],
  },
  qc: {
    title: 'ตรวจคุณภาพ',
    description: 'รายการตรวจและผลการตัดสินคุณภาพ',
    note: 'ดู Checklist ผลตรวจ และประวัติได้ การบันทึกผลตรวจ รูป และตัดสินผ่าน/ส่งกลับในหน้านี้ยังไม่เปิดให้ทดสอบ',
    sections: [
      {
        kind: 'inspections',
        label: 'รายการตรวจ',
        detail: true,
        columns: [
          c('inspectionNo', 'เลขที่ตรวจ'),
          c('inspectionKind', 'ประเภท'),
          c('inspectedQty', 'จำนวนตรวจ'),
          c('status', 'สถานะ'),
        ],
      },
    ],
  },
  delivery: {
    title: 'จัดส่ง',
    description: 'รอบส่งสินค้าและหลักฐานส่งมอบตามสิทธิ์ของบัญชี',
      note: 'จัดรอบส่ง หยิบ FG จัดกล่อง สแกน ส่งออก และรับมอบผ่านหน้าจัดส่งตามสิทธิ์ของบัญชี',
    sections: [
      {
        kind: 'deliveries',
        label: 'รอบจัดส่ง',
        detail: true,
        columns: [
          c('deliveryNo', 'เลขที่รอบส่ง'),
          c('plannedDate', 'วันที่นัดส่ง'),
          c('carrierName', 'ผู้ขนส่ง'),
          c('status', 'สถานะ'),
        ],
      },
    ],
  },
  users: {
    title: 'ผู้ใช้และสิทธิ์',
    description: 'บัญชีและ Roles จากระบบจริง',
    note: 'แสดงสิทธิ์ที่ใช้อยู่จริง การแก้ Role/สิทธิ์และรีเซ็ตบัญชีในหน้านี้ยังไม่เปิดให้ทดสอบ',
    sections: [
      {
        kind: 'users',
        label: 'บัญชีผู้ใช้',
        columns: [
          c('username', 'บัญชี'),
          c('displayName', 'ชื่อ'),
          c('rolesLabel', 'Role'),
          c('isActive', 'สถานะ'),
        ],
      },
    ],
  },
};
export const detailLabels: Record<string, string> = {
  requestNo: 'เลขที่คำขอ',
  woNo: 'เลขที่ WO',
  inspectionNo: 'เลขที่ตรวจ',
  deliveryNo: 'เลขที่จัดส่ง',
  documentNo: 'เลขที่เอกสาร',
  revisionCode: 'Revision',
  description: 'รายละเอียด',
  username: 'บัญชี',
  displayName: 'ชื่อ',
  rolesLabel: 'Role',
  status: 'สถานะ',
  demandType: 'ประเภทงาน',
  requestType: 'ประเภทคำขอ',
  requestedQty: 'จำนวนที่ขอ',
  plannedQty: 'จำนวนผลิต',
  cancelledQty: 'จำนวนยกเลิก',
  dueDate: 'กำหนดส่ง',
  plannedDate: 'วันที่นัดส่ง',
  carrierName: 'ผู้ขนส่ง',
  operationNo: 'ลำดับขั้นตอน',
  inputQty: 'จำนวนรับเข้า',
  isFinalQc: 'ขั้นตอน QC',
  standardMinutes: 'เวลามาตรฐาน (นาที)',
  inspectedQty: 'จำนวนตรวจ',
  inspectionKind: 'ประเภทการตรวจ',
  stockCategory: 'ประเภทสต็อก',
  onHandQty: 'คงเหลือ',
  available: 'พร้อมใช้หลังหักจอง',
  itemName: 'สินค้า / วัสดุ',
  locationName: 'ตำแหน่งจัดเก็บ',
  centerName: 'สถานี',
  productName: 'สินค้า',
  workOrderNumber: 'ใบสั่งผลิต',
  quantity: 'จำนวน',
  componentQty: 'จำนวนวัสดุ',
  baseQty: 'จำนวนฐาน',
  goodQty: 'จำนวนดี',
  rejectQty: 'จำนวนเสีย',
  scrapQty: 'จำนวนทิ้ง',
  dispositionCode: 'ผลการตัดสิน',
  eventType: 'เหตุการณ์',
  serverTime: 'เวลาบันทึก',
  startedAt: 'เริ่ม',
  endedAt: 'สิ้นสุด',
  createdAt: 'วันที่สร้าง',
  submittedAt: 'วันที่ส่ง',
  frozenAt: 'วันที่เผยแพร่',
  releasedAt: 'วันที่ Release',
  postedAt: 'วันที่บันทึก',
  remark: 'หมายเหตุ',
  reason: 'เหตุผล',
  decision: 'การตัดสิน',
  roundNo: 'รอบ',
  drawingNo: 'เลขแบบ',
  note: 'หมายเหตุ',
  code: 'รหัส',
  name: 'ชื่อ',
  observedValue: 'ค่าที่ตรวจ',
  passed: 'ผลตรวจ',
  inspectedValue: 'ค่าที่ตรวจ',
  lineNo: 'ลำดับ',
  requestedBaseQty: 'จำนวนที่ขอ',
  reservedQty: 'จำนวนจอง',
  quantityDelta: 'จำนวนเปลี่ยนแปลง',
  unitName: 'หน่วย',
  quantityBase: 'จำนวนฐาน',
  requiredBaseQty: 'จำนวนที่ต้องใช้',
  scrapAllowancePct: 'เผื่อสูญเสีย (%)',
  characteristicCode: 'หัวข้อตรวจ',
  defectCode: 'รหัสข้อบกพร่อง',
  requestedAt: 'วันที่ขอ',
  postingDate: 'วันที่ลงรายการ',
};
