import {Campaign as Base} from '../grand-map-002/authority.mjs';
import {rules} from '../grand-play-001/rules.mjs';
// Public display constants only. The original simulation caps organization at100.
export class Campaign extends Base {
 snapshot(draft){const d=super.snapshot(draft);d.continuous.unitStatusRules={orgMax:100,lowOrg:rules.orgRetreat};return d;}
}
