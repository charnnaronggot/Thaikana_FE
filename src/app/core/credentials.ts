import{Actor,CommandContext,DemoState,ensure,required,uid}from'../domain/models';
interface Proof{token:string;workerId:string;woId:string;action:string;version:number;credentialVersion:number;actorId:string;expires:number}
const proofs=new Map<string,Proof>();
/** Explicit sample credentials, used only in this browser's Demo. Never stored in IndexedDB. */
export const DEMO_PASSWORD='demo';export const DEMO_PIN='123456';
export function validateLogin(state:DemoState,username:string,password:string){const u=required(state.users.find(u=>u.username===username),'Username หรือ Password ไม่ถูกต้อง');ensure(u.active,'บัญชีถูกระงับ','denied');ensure(password===DEMO_PASSWORD,'Username หรือ Password ไม่ถูกต้อง','credentials');return u}
export function issueProof(state:DemoState,actor:Actor,woId:string,action:string,username:string,secret:string):string{
const w=required(state.users.find(u=>u.username===username),'ไม่พบผู้ทำงาน');ensure(w.active&&!w.locked,'ผู้ทำงานถูกระงับหรือล็อก กรุณาติดต่อผู้ดูแล','locked');const wo=required(state.workOrders.find(w=>w.id===woId));ensure(w.role==='Operator'||w.role==='Admin','บัญชีนี้ไม่มีสิทธิ์ปฏิบัติงาน','denied');ensure(w.stages.includes(wo.stage),'ผู้ทำงานอยู่นอกขอบเขตสถานี','denied');
if(action==='start'||action==='resume')ensure(secret===DEMO_PASSWORD,'Username หรือ Password ไม่ถูกต้อง','credentials');else ensure(secret===DEMO_PIN,'PIN ไม่ถูกต้อง งานยังไม่เปลี่ยนสถานะ','pin');
const token=uid();proofs.set(token,{token,workerId:w.id,woId,action,version:state.version,credentialVersion:w.credentialVersion,actorId:actor.userId,expires:Date.now()+60000});return token}
export function consumeProof(s:DemoState,token:string,action:string,woId:string,c:CommandContext){const p=proofs.get(token);proofs.delete(token);ensure(p&&p.expires>=Date.now()&&p.action===action&&p.woId===woId&&p.version===s.version&&p.actorId===c.user.id,'ผลยืนยันหมดอายุหรือข้อมูลเปลี่ยน กรุณายืนยันใหม่','credentials');const u=required(s.users.find(u=>u.id===p.workerId));ensure(u.active&&!u.locked&&u.credentialVersion===p.credentialVersion,'สิทธิ์ของผู้ทำงานเปลี่ยน กรุณายืนยันใหม่','denied');u.pinFailures=0;return u}
export function discardProof(token:string){proofs.delete(token)}
