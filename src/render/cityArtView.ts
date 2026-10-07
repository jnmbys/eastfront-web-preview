import type {BrowserRenderModel} from './coreModel.js';
/** Presentation DTO, independent of turns, phases, production actions and network transport. */
export interface CityArtFacility {id:string;slot?:number;status:string;progress?:number;paidI?:number;}
export interface CityArtDistrict {id:string;cityId?:string;hex:string;paper:string;type:'MAIN'|'STATION'|'INDUSTRIAL'|'RESIDENTIAL';slots:number;control:string|null;unconfirmed?:boolean;service?:boolean;facilities:readonly CityArtFacility[];sealedConstruction?:readonly {id:string;progress:number;paidI?:number}[];}
export interface CityArtCity {id:string;label:string;districts:readonly CityArtDistrict[];}
export interface CityArtView {revision:string|number;viewer:string;cities:readonly CityArtCity[];edges:BrowserRenderModel['edges'];knownHexKeys:readonly string[];}
export type CityArtSelection=(cityId:string,districtId:string)=>void;
