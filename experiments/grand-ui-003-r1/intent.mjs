import {directPreview} from '../grand-ui-003/preview.mjs';
export function validateMapIntent(c,op){
 if(op.type!=='DIRECT'||!op.mapIntent)return;
 const i=op.mapIntent;if(i.version!==1)throw Error('不支持的地图命令版本');
 const unit=c.clock.units[op.unit];if(!unit||i.unitGeneration!==unit.commandGeneration)throw Error('部队控制或命令已改变，请重新选择');
 const group=c.clock.corps.find(g=>g.members.includes(op.unit));
 if(i.groupId && (!group||group.permanentId!==i.groupId||group.commandGeneration!==i.groupGeneration||unit.direct))throw Error('军团命令或部队归属已改变，请重新选择');
 const view=c.fair(c.viewer).view;
 if(op.order.kind==='ADVANCE'&&view.units.some(u=>u.side!==view.viewer&&u.hex.q===op.order.target.q&&u.hex.r===op.order.target.r))throw Error('目的地出现已识别敌军，请明确选择攻击');
 const result=directPreview(c,{unit:op.unit,kind:op.order.kind,target:op.order.target});
 if(result.reason)throw Error(result.reason);
}
