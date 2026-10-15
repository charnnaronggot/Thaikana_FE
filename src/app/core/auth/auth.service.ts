import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthResponse, UserProfile } from '../models/api.models';
import { environment } from '../../../environments/environment';
@Injectable({providedIn:'root'})
export class AuthService {
 private http=new HttpClient(inject(HttpBackend));
 readonly user=signal<UserProfile|null>(null);
 private accessToken=''; private initialized?:Promise<void>; private refreshPromise?:Promise<string>;
 get token(){return this.accessToken;}
 has(permission:string){const aliases:Record<string,string>={'quotation.view':'business.view','quotation.manage':'sales.manage','quotation.send':'sales.manage','quotation.accept':'sales.manage','sales_order.view':'business.view','sales_order.manage':'sales.manage','customer.view':'master.view','customer.manage':'master.manage','product_revision.view':'master.view','settings.manage':'user.manage'};return !!this.user()?.permissions?.includes(aliases[permission]??permission);}
 hasAny(permissions:string[]){return permissions.length===0||permissions.some(p=>this.has(p));}
 private accept(response:AuthResponse){this.accessToken=response.accessToken;const user:UserProfile={...response.user,accountType:String(response.user.accountType)==='STATION'?'Station':'Personal'};this.user.set(user);return user;}
 initialize(){return this.initialized??=this.refresh().then(()=>undefined).catch(()=>{this.clear();});}
 async login(username:string,password:string){const response=await firstValueFrom(this.http.post<AuthResponse>(environment.apiUrl+'/auth/login',{username,password},{withCredentials:true}));return this.accept(response);}
 async changePassword(currentPassword:string,newPassword:string){return this.accept(await firstValueFrom(this.http.post<AuthResponse>(environment.apiUrl+'/auth/change-password',{currentPassword,newPassword},{withCredentials:true,headers:{Authorization:'Bearer '+this.accessToken}})));}
 refresh(){if(!this.refreshPromise)this.refreshPromise=firstValueFrom(this.http.post<AuthResponse>(environment.apiUrl+'/auth/refresh',{},{withCredentials:true,headers:{'X-Thaikana-CSRF':'1'}})).then(r=>{this.accept(r);return r.accessToken;}).catch(e=>{this.clear();throw e;}).finally(()=>{this.refreshPromise=undefined;});return this.refreshPromise;}
 async logout(){try{await firstValueFrom(this.http.post(environment.apiUrl+'/auth/logout',{},{withCredentials:true,headers:{'X-Thaikana-CSRF':'1'}}));}finally{this.clear();}}
 clear(){this.accessToken='';this.user.set(null);}
}
