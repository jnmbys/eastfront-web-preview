// Experimental equipment bundles, not individual rifles. No new armor/piercing statistic.
export const products={
 RIFLE:{label:'步兵装备',icon:'equipment',work:2,output:1,load:2,use:'步兵攻击、防御'},
 GUN:{label:'野战火炮',icon:'equipment',work:6,output:1,load:4,use:'炮兵支援资格、防御'},
 AT:{label:'反坦克炮',icon:'equipment',work:4,output:1,load:3,use:'反坦克部队攻击、防御'},
 TANK:{label:'中型装甲',icon:'equipment',work:8,output:1,load:6,use:'装甲攻击、防御、机动'},
 HEAVY:{label:'重型装甲',icon:'equipment',work:12,output:1,load:8,use:'重装甲攻击、防御、机动'},
 KIT:{label:'工兵与通信器材',icon:'equipment',work:3,output:1,load:2,use:'工兵攻击/防御、总部防御'},
 SCOUT:{label:'侦察器材',icon:'equipment',work:4,output:1,load:2,use:'侦察攻击、防御、机动'},
 TRUCK:{label:'卡车',icon:'truck',work:4,output:1,load:4,use:'摩托化机动；或独占后勤车队'},
 TRAIN:{label:'火车',icon:'train',work:8,output:1,load:8,use:'后勤铁路工作量'}
};
export const recipes={INFANTRY:{RIFLE:2},JAGER:{RIFLE:2,KIT:1},ELITE_INFANTRY:{RIFLE:2},PANZER:{TANK:2,RIFLE:1},TANK:{TANK:2,RIFLE:1},HEAVY_TANK:{HEAVY:2,RIFLE:1},MOTORIZED:{RIFLE:2,TRUCK:1},ARTILLERY:{GUN:2},ENGINEER:{RIFLE:1,KIT:1},RECON:{SCOUT:1,RIFLE:1},ANTI_TANK:{AT:2},HQ:{KIT:1}};
export function initialize(c){
 const g=c.econ.gear={units:{},ledger:[],serial:0};
 for(const u of Object.values(c.state.units)){
  const recipe=recipes[u.type];if(!recipe)throw Error('UNMAPPED_TEMPLATE:'+u.templateId);
  const base=structuredClone(c.rules.unitTemplates[u.templateId]),blocks=base.maxDamageSteps-u.step;
  g.units[u.id]={base,recipe,held:Object.fromEntries(Object.entries(recipe).map(([k,n])=>[k,n*blocks])),staged:[]};
  g.ledger.push({kind:'SCENARIO_INITIAL',unit:u.id,step:u.step,held:structuredClone(g.units[u.id].held)});
  u.templateId='EQUIPPED:'+u.id;
 }sync(c);
}
export function capacity(c,id){const u=c.state.units[id],g=c.econ.gear.units[id],blocks=g.base.maxDamageSteps-u.step;
 return Object.fromEntries(Object.entries(g.recipe).map(([k,n])=>[k,n*blocks]));}
export function sync(c){
 if(!c.econ.gear)return;
 for(const u of Object.values(c.state.units)){
  const g=c.econ.gear.units[u.id],needs=capacity(c,u.id),ratio=Math.min(1,...Object.entries(needs).map(([k,n])=>n?g.held[k]/n:1));
  const t=structuredClone(g.base);t.id=u.templateId;
  // Step already represents lost establishment. Only shortage within the surviving establishment penalizes it again.
  t.steps=t.steps.map(s=>({...s,attack:s.attack*ratio,defense:s.defense*ratio,movement:Math.floor(s.movement*(.5+.5*ratio))}));
  c.rules.unitTemplates[u.templateId]=t;g.ratio=ratio;
 }
}
export function recordLoss(c,before){for(const u of Object.values(c.state.units)){
 const old=before.units[u.id];if(!old||old.step===u.step&&old.alive===u.alive)continue;
 const g=c.econ.gear.units[u.id];if(u.step<old.step)continue;
 const lost={};for(const[k,max]of Object.entries(capacity(c,u.id))){const n=Math.max(0,g.held[k]-(u.alive?max:0));g.held[k]-=n;lost[k]=n;}
 c.econ.gear.ledger.push({kind:'LOSS',unit:u.id,turn:c.state.turn,lost});
 }sync(c);}
export function receive(c,epoch){for(const[uId,g]of Object.entries(c.econ.gear.units)){
 const needs=capacity(c,uId);for(const l of g.staged){if(l.availableTurn>epoch||l.type==='P')continue;const n=Math.min(l.qty,Math.max(0,needs[l.type]-g.held[l.type]));if(n){l.qty-=n;g.held[l.type]+=n;c.econ.gear.ledger.push({kind:'REFILL',unit:uId,type:l.type,qty:n,origin:l.id,turn:epoch});}}
 }sync(c);}
export function repairPlan(c,id){const u=c.state.units[id],g=c.econ.gear.units[id];if(!u||!g)throw Error('UNIT_NOT_FOUND');
 const recipe={P:1,...g.recipe},missing=Object.entries(recipe).filter(([k,n])=>g.staged.filter(l=>l.type===k&&l.availableTurn<=c.state.turn).reduce((a,l)=>a+l.qty,0)<n).map(([k,n])=>({type:k,need:n}));
 return {recipe,missing};}
export function payRepair(c,id,request){const g=c.econ.gear.units[id],p=repairPlan(c,id);if(p.missing.length)throw Error('TYPED_RECOVERY_MATERIALS_REQUIRED');
 const paid=[];for(const[k,n]of Object.entries(p.recipe)){let remain=n;for(const l of g.staged)if(l.type===k&&l.availableTurn<=c.state.turn){const qty=Math.min(remain,l.qty);l.qty-=qty;remain-=qty;if(qty)paid.push({lot:l.id,type:k,qty});}if(k!=='P')g.held[k]+=n;}
 c.econ.uses.push({id:'USE:'+request,unitId:id,side:c.viewer,turn:c.state.turn,paid,rp:0});sync(c);
}
