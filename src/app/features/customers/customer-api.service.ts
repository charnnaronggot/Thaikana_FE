import { inject, Injectable } from '@angular/core';
import { ApiClient } from '../../core/services/api/api-client.service';
import { Customer, CustomerPage } from './models/customer.models';
@Injectable({providedIn:'root'})
export class CustomerApi {
 private api=inject(ApiClient);
 list(search='',page=1,active?:boolean){return this.api.get<CustomerPage>('/customers',{search,page,pageSize:25,active});}
 detail(id:string){return this.api.get<Customer>('/customers/'+id);}
}
