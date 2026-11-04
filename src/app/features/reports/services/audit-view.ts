import type { AuditChange } from './reports-api.service';
// F15 audit detail view. Masked values are withheld by the server; the UI only explains why.
export const auditMaskLabels:Readonly<Record<string,string>>={cost:'ซ่อน · ไม่มีสิทธิ์ดูต้นทุน',finance:'ซ่อน · ไม่มีสิทธิ์ดูข้อมูลการเงิน',secret:'ซ่อน · ข้อมูลยืนยันตัวตน'};
export function auditValue(change:AuditChange,side:'before'|'after'):string{
  if(change.masked)return auditMaskLabels[change.masked]??'ซ่อนตามสิทธิ์';
  const value=side==='before'?change.before:change.after;return value===null||value===undefined||value===''?'—':value;
}
/** Human label for a JSON field path, e.g. "lines[0].unitPrice" → "lines 1 · unitPrice". */
export function auditField(path:string){return path.replace(/\[(\d+)\]/g,(_,i)=>' '+(Number(i)+1)).split('.').join(' · ');}
export function maskedCount(changes:readonly AuditChange[]){return changes.filter(x=>!!x.masked).length;}
