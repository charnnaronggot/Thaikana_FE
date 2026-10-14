import { afterRenderEffect, Component, ElementRef, input, signal, viewChild } from '@angular/core';
import JsBarcode from 'jsbarcode';
@Component({selector:'app-barcode-label',template:`<section class="barcode-label"><strong>{{caption()}}</strong><svg #barcode role="img" [attr.aria-label]="'Barcode '+value()"></svg>@if(error()){<p role="alert">{{error()}}</p>}<button type="button" (click)="download()" [disabled]="!!error()">ดาวน์โหลดฉลาก SVG</button></section>`,styles:`.barcode-label{display:flex;flex-direction:column;align-items:flex-start;gap:8px;border:1px solid var(--border);border-radius:3px;padding:16px;background:white;overflow:auto}.barcode-label svg{max-width:100%;height:auto;background:white}.barcode-label button{font-size:12px}`})
export class BarcodeLabel {
 readonly value=input.required<string>();readonly caption=input('Package label');readonly error=signal('');private svg=viewChild.required<ElementRef<SVGSVGElement>>('barcode');
 constructor(){afterRenderEffect(()=>{try{JsBarcode(this.svg().nativeElement,this.value(),{format:'CODE128',height:56,width:2,margin:16,fontSize:14,displayValue:true});this.error.set('');}catch{this.error.set('ไม่สามารถสร้างฉลากจาก Barcode นี้ได้');}});}
 download(){const blob=new Blob([new XMLSerializer().serializeToString(this.svg().nativeElement)],{type:'image/svg+xml'});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=this.value()+'.svg';anchor.click();URL.revokeObjectURL(url);}
}
