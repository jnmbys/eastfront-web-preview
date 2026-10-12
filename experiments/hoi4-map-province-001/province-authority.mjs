import {Campaign as Visual} from './authority.mjs';
import {VERSION,createProvinces,reconcileProvinces,mobilizeStep,validateProvinces,provinceView} from './provinces.mjs';
import {validate} from '../grand-division-002/inventory.mjs';
export class Campaign extends Visual{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();createProvinces(this);validate(this.clock.divisionLedger);}
 advance(){reconcileProvinces(this);const r=super.advance();mobilizeStep(this);return r;}
 transaction(req){if(req.operation?.type!=='PROVINCE_MOBILIZE'){const result=super.transaction(req);reconcileProvinces(this,this.clock.provinces?.origins[req.operation?.unit]);return result;}
  const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return structuredClone(prior.result);}if(req.version!==this.version)throw Error('STALE_VERSION');if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');const g=this.clock.provinces,p=g.items.find(p=>p.id===req.operation.province);
  if(!p||p.owner!==this.viewer)throw Error('PROVINCE_NOT_AUTHORIZED');if(req.operation.revision!==g.revision[this.viewer])throw Error('PROVINCE_ORDER_CHANGED');if(typeof req.operation.active!=='boolean')throw Error('INVALID_MOBILIZATION_ORDER');if(req.operation.active&&(this.state.hexes[p.capital].control!==this.viewer||!p.eligible))throw Error('PROVINCE_MOBILIZATION_UNAVAILABLE');
  p.mobilizing=req.operation.active;g.revision[this.viewer]++;this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version,province:p.id,revision:g.revision[this.viewer]};this.receipts.set(req.id,{signature,result});return structuredClone(result);
 }
 snapshot(draft){const d=super.snapshot(draft);if(this.clock.provinces)d.provinces=provinceView(this,d);return d;}
 restore(s,pause=true){if(s.clock?.provinces?.version!==VERSION||!s.clock.divisionLedger?.provinceManpower)throw Error('PROVINCE_NEW_CAMPAIGN_REQUIRED');super.restore(s,pause);validateProvinces(this);}
}
