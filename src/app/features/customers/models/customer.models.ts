import type { components } from '../../../core/services/api/generated/schema';
type WireCustomer=components['schemas']['CustomerResponse'];
export type CustomerAddress=Required<components['schemas']['CustomerAddressResponse']>;
export type CustomerReference=Required<components['schemas']['CustomerDocumentReference']>;
export type Customer=Omit<WireCustomer,'id'|'code'|'name'|'version'|'addresses'|'quotations'|'salesOrders'> & {
 id:string;code:string;name:string;version:string;addresses:CustomerAddress[];quotations:CustomerReference[];salesOrders:CustomerReference[];
};
export type CustomerPage=Omit<components['schemas']['CustomerPage'],'items'> & {items:Customer[]};
export type SaveCustomer=components['schemas']['SaveCustomerRequest'];
