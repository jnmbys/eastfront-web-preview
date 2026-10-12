import {Campaign as Training} from '../blackice-training-001/authority.mjs';
import {POLICY,plan} from './policy.mjs';
export const VERSION='BLACKICE-AI-TRAINING-002-1';
export class Campaign extends Training{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.aiTraining={version:POLICY.version,tasks:{},sequence:0,events:[],lastCheck:null};}
 trainingAIInput(view){const side=view.viewer,a=this.clock.aiTraining,own={};for(const u of view.units.filter(u=>u.side===side)){const v=this.clock.units[u.id],d=this.clock.divisionLedger.units[u.id],t=a.tasks[u.id];own[u.id]={org:v.org,direct:!!v.direct,manual:!!v.manual,engaged:v.engaged,march:!!v.march,withdrawing:this.isWithdrawalInProgress(u.id),supply:v.dailySupply?.effective??this.econ.modern.net[side]?.rows[u.id]?.ratio??0,eligibility:this.trainingEligibility(u.id),training:!!this.clock.training.tasks[u.id]?.active,templateId:d.templateId,templateVersion:d.templateVersion,phase:this.clock.tactical.states[u.id]?.phase,front:Object.values(this.clock.frontDefense.groups).some(g=>Object.values(g.posts??{}).some(p=>p.unit===u.id)),owned:t?.hold===JSON.stringify([v.direct,v.manual])};}
  return {view,own,groups:this.clock.corps.filter(g=>g.side===side),tasks:a.tasks,tick:this.clock.tick};
 }
 trainingAIOperation(side,operation){const viewer=this.viewer;this.viewer=side;this.aiTrainingExecuting=true;try{const result=this.transaction({id:'ai-training-'+(++this.clock.aiTraining.sequence),version:this.version,operation});const u=this.clock.units[operation.unit];u.commandGeneration=(u.commandGeneration??0)+1;return result;}finally{this.viewer=viewer;this.aiTrainingExecuting=false;}}
 trainingAIStep(view){if(this.clock.room||view.viewer!=='SOVIET')return;const a=this.clock.aiTraining,result=plan(this.trainingAIInput(view));
  if(this.clock.tick%POLICY.interval===0)a.lastCheck={tick:this.clock.tick,rejections:result.rejections};
  for(const d of result.decisions){let t=a.tasks[d.id];try{
   if(d.kind==='START'){this.trainingAIOperation(view.viewer,{type:'TRAINING',unit:d.id,active:true});t=a.tasks[d.id]={phase:'TRAIN',since:this.clock.tick,stamp:d.stamp};}
   else if(d.kind==='STOP'){if(this.clock.training.tasks[d.id]?.active)this.trainingAIOperation(view.viewer,{type:'TRAINING',unit:d.id,active:false});t.phase='RECOVER';t.stopped=this.clock.tick;delete t.stopRequested;}
   else if(d.kind==='RESUME'){this.trainingAIOperation(view.viewer,{type:'RESUME_PLAN',unit:d.id});t.phase='COOLDOWN';t.next=this.clock.tick+POLICY.cooldown;}
   else {t.phase='RELEASED';t.next=this.clock.tick+POLICY.cooldown;}
   t.reason=d.reason;t.hold=JSON.stringify([this.clock.units[d.id]?.direct,this.clock.units[d.id]?.manual]);a.events.push({tick:this.clock.tick,unit:d.id,kind:d.kind,reason:d.reason,org:this.clock.units[d.id]?.org,xp:this.clock.divisionLedger.units[d.id]?.trainingExperience});this.note(view.viewer,'训练安排：'+d.reason,d.id);
  }catch(e){if(t)t.reason='训练命令被拒：'+e.message;a.events.push({tick:this.clock.tick,unit:d.id,kind:'REJECTED',reason:e.message});}}
  a.events=a.events.slice(-120);
 }
 enemyPlan(view){super.enemyPlan(view);this.trainingAIStep(view);}
 transaction(req){const replay=this.receipts.has(req.id),r=super.transaction(req);if(replay||this.aiTrainingExecuting||!this.clock.aiTraining)return r;const op=req.operation,a=this.clock.aiTraining;
  if(['DIRECT','TRAINING','ASSIGN','RESUME_PLAN','DIVISION_FORMAL_ADOPT'].includes(op?.type)){const t=a.tasks[op.unit];if(t&&['TRAIN','RECOVER'].includes(t.phase)){t.phase='RELEASED';t.reason='玩家/外部命令优先，训练AI退出';t.next=this.clock.tick+POLICY.cooldown;}}
  if(op?.type==='ORDER')for(const id of this.clock.corps.find(g=>g.id===op.group)?.members??[]){const t=a.tasks[id];if(t?.phase==='TRAIN')t.stopRequested='军团命令改变，停止训练恢复战备';}
  return r;
 }
 snapshot(draft){const d=super.snapshot(draft);if(!this.clock.aiTraining)return d;for(const[id,u]of Object.entries(d.continuous.units)){const t=this.clock.aiTraining.tasks[id];if(t)u.training.ai={phase:t.phase,reason:t.reason,next:t.next??null};}return d;}
 restore(s,pause=true){if(s.clock?.aiTraining?.version!==POLICY.version)throw Error('AI_TRAINING_NEW_CAMPAIGN_REQUIRED');return super.restore(s,pause);}
}
