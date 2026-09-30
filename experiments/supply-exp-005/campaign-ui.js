'use strict';
lessons.campaign=['完整战役（未平衡）','从苏军部署开始，随后德军部署；双方均由人操作。','在固定实验补给下完成16回合内的对局，沿用Core胜负。','切换到当前行动方，用下方部署面板选择单位与格位；全部部署后点结束当前阶段。','移动/攻击看储备消耗，苏军回合末看实际配送；有增援先部署，有强制战斗步骤先处理。会话仅保存在内存，空闲30分钟或服务重启会丢失；最多1000次操作或6MiB，达到上限需导出反馈并重置。'];
guides.campaign='完整对局：先完成部署；后续依照当前阶段与强制步骤操作。';
const phase007=phaseLabel;phaseLabel=s=>({SOVIET_DEPLOYMENT:'苏军部署',GERMAN_DEPLOYMENT:'德军部署',SOVIET_REINFORCEMENT_SUPPLY:'苏军增援与补给',GAME_OVER:'对局结束'}[s.core_phase]||phase007(s));
if(!window.campaignOnline)$('clip').replaceChildren();$('clip').prepend(new Option('完整战役 · 实验配置A','campaign'));$('clip').value='campaign';
document.title='EASTFRONT · SUPPLY-CAMPAIGN-010';document.querySelector('h1').textContent='EASTFRONT · 完整战役实验';
const campaignPanel=document.createElement('section');campaignPanel.innerHTML='<h3>部署与增援（当前查看方）</h3><p id="campaignState"></p><div class="bar"><label>待部署单位<select id="roster010"></select></label><label>格位<select id="hex010"></select></label><button id="deploy010">部署选中单位</button><button id="ready010">结束部署／当前阶段</button><button id="entrench010">选中单位构筑阵地</button><button id="repair010">选中单位恢复兵力</button></div><p>部署区及入口为公开地理信息；提交仍由Core检验，不预测隐藏占位。旧模式须切换规则后重置。</p>';$('tutorial').after(campaignPanel);
const draw007=draw,decision007=decision;
function campaignControls(){
 const s=data.state,m=s.campaign;$('clip').value=s.clip;$('mode').value=s.mode;campaignPanel.hidden=!m;if(!m)return;
 $('campaignState').textContent=`回合 ${m.turn}/${m.turn_limit} · ${m.victory.winner?'终局：'+m.victory.winner+' / '+m.victory.reason:'沿用Core胜负；补给实收不增加胜利资格'}`;
 const initial=!!m.deployment,rows=initial?m.deployment.roster.filter(u=>!u.placed):m.reinforcements;
 const coords=initial?m.deployment.zone:m.entry_hexes,ids=Object.fromEntries(s.nodes.map(n=>[`${n.coord.q},${n.coord.r}`,n.id]));
 $('roster010').replaceChildren(...rows.map(u=>new Option(u.id,u.id)));$('hex010').replaceChildren(...coords.map(h=>new Option(ids[`${h.q},${h.r}`],JSON.stringify(h))));
 if(!s.units.length)$('unitCard').textContent='当前查看方尚无已部署存活单位。';
 const disabled=busy||s.decision_side!==$('viewer').value||!!m.victory.winner;
 $('deploy010').disabled=disabled||!rows.length||!coords.length||!!s.pending;
 $('ready010').disabled=disabled||!!s.pending;
 $('entrench010').disabled=disabled||!s.core_phase.endsWith('ENTRENCHMENT');$('repair010').disabled=disabled||!s.core_phase.endsWith('RECOVERY');
 if(m.victory.winner)$('progress').textContent='对局已结束；可查看反馈或重置为新局。';
 if(m.victory.winner)for(const id of ['move','attack','repair','phase','side','options'])$(id).disabled=true;
}
draw=function(){draw007();campaignControls()};decision=function(){decision007();campaignControls()};
$('deploy010').onclick=()=>{const initial=!!data.state.campaign.deployment,h=JSON.parse($('hex010').value),id=$('roster010').value;action(initial?{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:h}:{type:'DEPLOY_REINFORCEMENT',reinforcementId:id,entryHex:h})};
$('ready010').onclick=()=>action({type:'READY_FOR_PHASE_END'});$('entrench010').onclick=()=>action({type:'ENTRENCH',unitId:$('unit').value});$('repair010').onclick=()=>action({type:'REPAIR_UNIT',unitId:$('unit').value});
$('viewer').value='S';
if(data)draw();
