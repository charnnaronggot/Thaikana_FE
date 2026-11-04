import type { GlobalSearchResult } from './search-api.service';
// F15 search view helpers. Groups come from the server already scoped; a missing group means "no access", not zero.
export const searchStatusLabels:Readonly<Record<string,string>>={ACTIVE:'ใช้งาน',INACTIVE:'ปิดใช้งาน',DRAFT:'ร่าง',ISSUED:'ออกแล้ว',SENT:'ส่งแล้ว',ACCEPTED:'รับราคาแล้ว',REJECTED:'ไม่รับ',EXPIRED:'หมดอายุ',PRICE_CHANGE:'ขอแก้ราคา',DESIGN_CHANGE:'ขอแก้แบบ',CONFIRMED:'ยืนยันแล้ว',PARTIALLY_DELIVERED:'ส่งบางส่วน',COMPLETED:'ครบแล้ว',CANCELLED:'ยกเลิก',RELEASED:'ปล่อยแล้ว',IN_PROGRESS:'กำลังผลิต',PLANNED:'วางแผน',PICKING:'กำลังหยิบ',DISPATCHED:'ออกจัดส่ง',DELIVERED:'ส่งถึงแล้ว',FAILED:'ส่งไม่สำเร็จ',RM:'วัสดุ',FG:'สินค้าสำเร็จรูป'};
export const minimumSearchLength=2;
export function validSearch(query:string){const q=query.trim();return q.length>=minimumSearchLength&&q.length<=100;}
export function statusLabel(status:string|null|undefined){return status?searchStatusLabels[status]??status:'';}
/** Splits a server route such as "/sales?salesOrderId=…" into a router path and query params. */
export function hitLink(route:string|null|undefined):{path:string;queryParams:Record<string,string>}|null{
  if(!route||!route.startsWith('/')||route.startsWith('//'))return null;
  const [path,query='']=route.split('?');return {path,queryParams:Object.fromEntries(new URLSearchParams(query))};
}
export function searchSummary(result:GlobalSearchResult|null):'none'|'no-modules'|'no-match'|'found'{
  if(!result)return 'none';if(!result.groups.length)return 'no-modules';
  return result.groups.some(x=>Number(x.total)>0)?'found':'no-match';
}
