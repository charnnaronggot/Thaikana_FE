// Make-to-stock Draft WO form (F07). The server re-validates everything; this
// only prevents obviously invalid submissions and builds the typed body.
export interface StockOption { productRevisionId: string; version: number | string; decimalPlaces: number | string; costReady: boolean }
export interface StockForm { plantId: string; productRevisionId: string; quantity: number; plannedStart: string; dueDate: string; priority: number; reason: string }
export function stockFormErrors(form: StockForm, option: StockOption | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.plantId) errors['plant'] = 'เลือกโรงงาน';
  if (!option) errors['revision'] = 'เลือกสินค้าและ Revision ที่เผยแพร่แล้ว';
  else if (!option.costReady) errors['revision'] = 'ต้นทุน BOM ของ Revision นี้ยังไม่พร้อม ให้ Design ตรวจราคาวัสดุก่อน (วัสดุทุกชิ้นต้องมีต้นทุนมากกว่า 0)';
  const places = Number(option?.decimalPlaces ?? 6), quantity = Number(form.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000) errors['quantity'] = 'จำนวนต้องมากกว่า 0';
  else if (Math.round(quantity * 10 ** places) / 10 ** places !== quantity) errors['quantity'] = places === 0 ? 'หน่วยนี้ใช้จำนวนเต็มเท่านั้น' : `ทศนิยมได้ไม่เกิน ${places} ตำแหน่ง`;
  if (!form.plannedStart || !form.dueDate) errors['dates'] = 'ระบุวันเริ่มตามแผนและกำหนดเสร็จ';
  else if (form.plannedStart > form.dueDate) errors['dates'] = 'วันเริ่มตามแผนต้องไม่เกินกำหนดเสร็จ';
  if (!form.reason.trim()) errors['reason'] = 'ระบุเหตุผลที่ผลิตเข้าสต็อก';
  else if (form.reason.trim().length > 2000) errors['reason'] = 'เหตุผลยาวได้ไม่เกิน 2000 ตัวอักษร';
  return errors;
}
export function stockBody(form: StockForm, option: StockOption) {
  return { expectedVersion: Number(option.version), productRevisionId: option.productRevisionId, plantId: form.plantId, quantity: Number(form.quantity),
    plannedStart: form.plannedStart, dueDate: form.dueDate, priority: Number(form.priority), reason: form.reason.trim() };
}
