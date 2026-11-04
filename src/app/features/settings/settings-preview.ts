import type { CompanySettingsSnapshot } from './settings.models';
// F04: preview what a new settings revision changes before it is saved. Issued documents keep their own snapshot.
export interface SettingsDraft{legalName:string|null;address:string|null;taxId:string|null;vatRate:number|null;currency:string|null;paymentTerms:string|null;defaultOverheadPercent:number|null;bankName:string|null;bankAccountName:string|null;bankAccountNumber:string|null;logoFileId:string|null;}
export interface SettingsChange{label:string;before:string;after:string;}
const fields:[Exclude<keyof SettingsDraft,'logoFileId'>,string][]=[['legalName','ชื่อบริษัท'],['address','ที่อยู่'],['taxId','เลขผู้เสียภาษี'],['vatRate','VAT (%)'],['currency','สกุลเงิน'],['paymentTerms','เงื่อนไขการชำระเงิน'],['defaultOverheadPercent','Overhead เริ่มต้น (%)'],['bankName','ธนาคาร'],['bankAccountName','ชื่อบัญชี'],['bankAccountNumber','เลขบัญชี']];
function text(value:unknown,upper=false){if(value===null||value===undefined||String(value).trim()==='')return '—';const v=String(value).trim();return upper?v.toUpperCase():v;}
export function settingsChanges(current:CompanySettingsSnapshot|null,draft:SettingsDraft):SettingsChange[]{
  const changes=fields.map(([key,label])=>({label,before:text(current?.[key],key==='currency'),after:text(draft[key],key==='currency')})).filter(x=>x.before!==x.after);
  const oldLogo=current?.logoFileId??null,newLogo=draft.logoFileId??null;
  if(oldLogo!==newLogo)changes.push({label:'โลโก้',before:oldLogo?'โลโก้เดิม':'—',after:newLogo?'โลโก้ใหม่':'นำโลโก้ออก'});
  return changes;
}
