import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiClient, OfflineTransactionError, problemMessage } from '../../core/services/api/api-client.service';
/** Provide per form. Keep the exact command when its commit result is unknown. */
@Injectable()
export class MutationSession {
 private api=inject(ApiClient);
 readonly busy=signal(false);readonly error=signal('');readonly uncertain=signal(false);
 private command?:{path:string;body:unknown;key:string;done:(result:unknown)=>Promise<void>|void;confirmed?:boolean;result?:unknown};
 async run<T>(path:string,body:unknown,done:(result:T)=>Promise<void>|void){
  if(this.busy())return;
  if(!this.command)this.command={path,body:structuredClone(body),key:crypto.randomUUID(),done:r=>done(r as T)};
  await this.retry();
 }
 async retry(){
  const command=this.command;if(!command||this.busy())return;this.busy.set(true);this.error.set('');
  try{if(!command.confirmed){command.result=await this.api.post(command.path,command.body,command.key);command.confirmed=true;}await command.done(command.result);this.command=undefined;this.uncertain.set(false);}
  catch(e){const unknown=command.confirmed||e instanceof OfflineTransactionError&&this.uncertain()||e instanceof HttpErrorResponse&&(e.status===0||e.status>=500);this.uncertain.set(unknown);if(!unknown)this.command=undefined;this.error.set((command.confirmed?'บันทึกสำเร็จแล้ว แต่โหลดผลไม่ได้ · ':'')+problemMessage(e));}
  finally{this.busy.set(false);}
 }
}
