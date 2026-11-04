import type { Customer } from './customer.models';
// F04 customer detail helpers. Coordinates are optional; the text address is always the record of truth.
type Located={addressType?:string|null;addressText?:string|null;latitude?:number|null;longitude?:number|null};
export function customerAddress(customer:Customer,type:'Billing'|'Shipping'):Located|undefined{return (customer.addresses as Located[]).find(a=>a.addressType===type);}
export function mapUrl(address:Located|undefined):string|null{
  const lat=Number(address?.latitude),lng=Number(address?.longitude);
  if(address?.latitude==null||address?.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng);
}
export const inactiveCustomerNotice='ลูกค้าปิดใช้งาน · เปิดดูประวัติได้ แต่เริ่มคำขอ/ใบเสนอราคาใหม่ ส่งแบบ ออก PDF แก้ราคา ส่ง หรือรับ PO ไม่ได้ · ใบสั่งขายที่ยืนยันแล้วยังส่งของ ออกใบแจ้งหนี้ และรับชำระยอดเดิมได้';
