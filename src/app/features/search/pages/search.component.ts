import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { StateMessage } from '../../../shared/components/ui';
import { GlobalSearchResult, SearchApi } from '../services/search-api.service';
import { hitLink, searchSummary, statusLabel, validSearch } from '../services/search-view';

// F15 global search page (no sidebar search box). The server returns only the modules the user may list.
@Component({imports:[FormsModule,RouterLink,DatePipe,StateMessage],templateUrl:'./search.component.html',styleUrl:'./search.component.scss'})
export class SearchPage {
  private api=inject(SearchApi);private route=inject(ActivatedRoute);private router=inject(Router);
  readonly result=signal<GlobalSearchResult|null>(null);readonly loading=signal(false);readonly error=signal('');readonly denied=signal(false);
  query='';private generation=0;private alive=true;
  readonly statusLabel=statusLabel;readonly hitLink=hitLink;readonly summary=()=>searchSummary(this.result());
  ngOnInit(){this.query=this.route.snapshot.queryParamMap.get('q')??'';if(validSearch(this.query))void this.search(false);}
  ngOnDestroy(){this.alive=false;this.generation++;}
  canLeave(){return true;}
  num(value:unknown){return Number(value??0);}
  async search(navigate=true){
    const q=this.query.trim();this.denied.set(false);
    if(!validSearch(q)){this.generation++;this.loading.set(false);this.result.set(null);this.error.set('พิมพ์คำค้นอย่างน้อย 2 ตัวอักษร (ไม่เกิน 100)');return;}
    if(navigate)void this.router.navigate([],{relativeTo:this.route,queryParams:{q},replaceUrl:true});
    // Only the latest search may update the page; an older slow answer is dropped.
    const generation=++this.generation;this.loading.set(true);this.error.set('');
    try{const result=await this.api.search(q);if(this.alive&&generation===this.generation)this.result.set(result);}
    catch(e){if(this.alive&&generation===this.generation){this.result.set(null);this.denied.set(e instanceof HttpErrorResponse&&e.status===403);this.error.set(problemMessage(e));}}
    finally{if(this.alive&&generation===this.generation)this.loading.set(false);}
  }
  retry(){void this.search(false);}
}
