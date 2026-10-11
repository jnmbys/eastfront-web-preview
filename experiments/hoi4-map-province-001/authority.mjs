import {Campaign as Base} from '../blackice-content-002/authority.mjs';
import {places} from './geography.mjs';
export class Campaign extends Base{
 static newCampaignClass=Campaign;
 constructor(){super();this.clock.mapPlaces=places(this,super.snapshot());}
 snapshot(draft){const d=super.snapshot(draft);d.mapPlaces=structuredClone(this.clock.mapPlaces??[]);return d;}
}
