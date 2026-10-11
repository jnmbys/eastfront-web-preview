import {Campaign as R1} from '../blackice-001/r1-campaign.mjs';
import {Conservative} from '../grand-officer-002-r1/authority.mjs';
import {scheduleFronts} from '../grand-officer-003/front.mjs';
import {ReleaseAdapter} from '../grand-release-001/persistence.mjs';

export const ROOM_VERSION='BLACKICE-MP-001-ROOM-1';
export function roomCampaign(Base=R1, roomVersion=ROOM_VERSION){ return class Campaign extends Base {
 static newCampaignClass=this; static roomVersion=roomVersion;
 // Both strategic seats are human. Keep the same tactical/officer implementation;
 // do not invoke the single-player industrial manager or automatic template adoption.
 territoryStrategy() {}
 enemyPlan(view){Conservative.prototype.enemyPlan.call(this,view);scheduleFronts(this);}
 transaction(req){const result=super.transaction(req);if(req.operation?.type==='CLOCK'&&this.clock.room)this.clock.room.pauseReason=req.operation.paused?(this.viewer==='GERMAN'?'德军':'苏军')+'已暂停世界；由房主继续':'';return result;}
 save(){return {...super.save(),roomVersion:roomVersion};}
 restore(s,pause=true){if(s.roomVersion!==roomVersion||!s.clock?.room?.members?.a)throw Error('MULTIPLAYER_ROOM_SAVE_REQUIRED');super.restore(s,pause);}
}
}
export const Campaign=roomCampaign();
export class RoomAdapter extends ReleaseAdapter {
 constructor(options){super(options);this.connected={a:false,b:false};if(this.c.clock.room)this.c.clock.room.pauseReason='服务恢复；等待双方连接，房主明确继续';}
 seat(seat){if(!['a','b'].includes(seat))throw Error('SEAT_NOT_AUTHORIZED');return seat==='a'?'GERMAN':'SOVIET';}
 summary(seat){const r=this.c.clock.room;return {version:this.c.constructor.roomVersion??ROOM_VERSION,id:r.id,seat,side:this.seat(seat),host:seat==='a',started:r.started,occupied:{a:!!r.members.a,b:!!r.members.b},connected:{...this.connected},paused:this.c.clock.paused,pauseReason:r.pauseReason,localOnly:true};}
 decorateView(seat,d){d.room=this.summary(seat);d.transport.role=seat==='a'?'德军玩家 · 房主':'苏军玩家';}
 async view(seat){const v=await super.view(seat);v.document.release.offlinePolicy='任一玩家断线自动暂停；房主明确继续。';return v;}
 authorizeCommand(seat,e){
  if(e.kind==='LOAD')throw Error('ROOM_RESTORE_REQUIRES_SERVICE_RESTART');
  if(e.kind==='SAVE')return;
  if(e.kind!=='OPERATION')throw Error('UNKNOWN_COMMAND');
  const p=e.payload??{},r=this.c.clock.room;
  if(p.type==='CLOCK'){
   if(seat!=='a'&&(p.paused!==true||p.speed!==this.c.clock.speed))throw Error('ONLY_HOST_MAY_RESUME_OR_CHANGE_SPEED');
   if(p.paused!==true&&(!r.started||!this.connected.a||!this.connected.b))throw Error('BOTH_PLAYERS_AND_HOST_START_REQUIRED');
  }
  if(['AUTOPAUSE','DIVISION_TEMPO'].includes(p.type)&&seat!=='a')throw Error('HOST_ONLY_WORLD_SETTING');
  if(!r.started)throw Error('WAITING_FOR_HOST_START');
  // The underlying economic transaction selects viewer, but line IDs are supplied
  // by clients. Reject a foreign ID before inspecting/modifying its private state.
  if(p.type==='ECON_LINE'&&this.c.econ.modern.lines[p.line]?.side!==this.seat(seat))throw Error('LINE_NOT_AUTHORIZED');
 }
 async connectionChanged(seat,value){return this.exclusive(async()=>{
  this.connected[seat]=value;const r=this.c.clock.room;if(!r)return;
  if(!value){this.c.clock.paused=true;this.accumulated=0;r.pauseReason=(seat==='a'?'德军':'苏军')+'断线；重连后由房主继续';this.c.transport.worldGeneration++;}
  else if(this.connected.a&&this.connected.b)r.pauseReason=r.started?'双方已连接；由房主继续':'双方已到齐；等待房主开始';
  this.c.version++;this.c.match.matchRevision=this.c.version;await this.saveFileNow();
 });}
 async startRoom(identity){return this.exclusive(async()=>{
  const r=this.c.clock.room;if(r.members.a!==identity)throw Error('HOST_ONLY');
  if(r.started)return {ok:true};if(!r.members.b||!this.connected.a||!this.connected.b)throw Error('BOTH_PLAYERS_MUST_CONNECT');
  r.started=true;r.pauseReason='房主已开始，初始暂停；可部署后继续';this.c.clock.paused=true;this.c.version++;this.c.match.matchRevision=this.c.version;this.c.transport.worldGeneration++;try{await this.saveFileNow();}catch(e){r.started=false;r.pauseReason='开始失败：存档未写入，请修复存储后重试';throw e;}return {ok:true};
 });}
 async tick(elapsed){if(!this.c.clock.room?.started||!this.connected.a||!this.connected.b)return;return super.tick(elapsed);}
}
