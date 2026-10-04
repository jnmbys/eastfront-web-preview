import type {LocalMeta} from './types.js';
/** Presentation only. No policy inputs or decisions. */
export function localStatus(meta:LocalMeta,finished=false):string {
 if(finished)return '对局已结束';
 if(meta.paused){
  const reason=meta.reason??'UNKNOWN',code=reason.split(':')[0]!;
  const labels:Record<string,string>={AGENT_STOP:'AI 没有可提交的候选',AGENT_ERROR:'AI 决策失败',REJECTION_LIMIT:'连续拒绝已达上限',INTEGRITY_FAILURE:'状态检查失败',WORKER_ERROR:'AI 工作线程异常',WORKER_TIMEOUT:'AI 超时（30秒）'};
  return '已停止：'+(labels[code]??'未知原因')+'（'+reason+'）';
 }
 if(meta.manual)return '人工接管模式';
 return meta.ownerSide===meta.humanSide?'等待你的操作':'AI 正在处理';
}
