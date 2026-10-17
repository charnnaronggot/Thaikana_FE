import type { DesignDetail } from './design.models';
export function designReadiness(d: DesignDetail) {
  const checklist = d.specification.checklist;
  return [
    {
      tab: 'Spec',
      label: 'ข้อกำหนดและ QC',
      ready:
        Number.isFinite(d.outputBaseQty) &&
        d.outputBaseQty > 0 &&
        checklist.length > 0 &&
        checklist.every((c) => !!c.code.trim()) &&
        new Set(checklist.map((c) => c.code)).size === checklist.length,
      help: 'ระบุจำนวนฐาน และหัวข้อตรวจ QC ที่มีรหัสไม่ซ้ำ',
    },
    {
      tab: 'Drawing',
      label: 'ไฟล์แบบ',
      ready: d.drawings.length > 0 && d.drawings.every((x) => !!x.drawingNo.trim()),
      help: 'แนบแบบและระบุเลขที่แบบให้ครบ',
    },
    {
      tab: 'BOM',
      label: 'รายการวัสดุ',
      ready:
        d.components.length > 0 &&
        d.components.every(
          (c) =>
            !!c.itemId &&
            c.itemId !== d.item.id &&
            Number.isFinite(c.quantity) &&
            c.quantity > 0 &&
            Number.isFinite(c.scrapAllowancePct) &&
            c.scrapAllowancePct >= 0 &&
            c.scrapAllowancePct <= 100,
        ),
      help: 'เพิ่มวัสดุ จำนวน และค่าเผื่อสูญเสียให้ถูกต้อง',
    },
    {
      tab: 'COGS',
      label: 'ต้นทุนประมาณการ',
      ready:
        d.costs.length > 0 &&
        d.costs.every(
          (c) =>
            Number.isFinite(c.quantity) &&
            Number.isFinite(c.unitCost) &&
            c.quantity >= 0 &&
            c.unitCost >= 0 &&
            !!c.sourceNote.trim(),
        ),
      help: 'เพิ่มต้นทุนพร้อมจำนวน ราคา และแหล่งอ้างอิง',
    },
  ];
}
