import {Conservative} from '../grand-officer-002-r1/authority.mjs';
import {recoveryStatus} from './status.mjs';
export class Campaign extends Conservative {
 snapshot(draft){const d=super.snapshot(draft);d.continuous.recovery=recoveryStatus(d);for(const r of d.continuous.recovery.rows){const u=d.continuous.units[r.id];u.reason=u.reason.replace('执行整补；等待人员和对应装备',r.step>0?'执行整补；'+r.reason:'执行整补；恢复组织或等待军官重新投入，不代表还缺一个人员编制组');}return d;}
 save(){return {...super.save(),campaignLoop:1};}
 restore(s,pause=true){if(s.campaignLoop!==1)throw Error('CAMPAIGN_LOOP_VERSION_MISMATCH');super.restore(s,pause);}
}
