import {Campaign as Land1} from './authority.mjs';
export const VERSION='BLACKICE-001-LAND-1-R1';
export class Campaign extends Land1{
 static newCampaignClass=Campaign;
 static rulesVersion=VERSION;
 get tacticalPolicyOptions(){return {preserveRecoveryOnReplan:true};}
}
