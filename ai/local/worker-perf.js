// Preview-only scalar timing; never exports policy input, intents, views or authoritative state.
const policy={count:0,totalMs:0,maxMs:0,lastMs:0};
export const measuredPolicy=agent=>input=>{
 const start=performance.now();try{return agent(input);}finally{const ms=performance.now()-start;policy.count++;policy.totalMs+=ms;policy.lastMs=ms;policy.maxMs=Math.max(policy.maxMs,ms);}
};
export function measuredThink(match,send){
 const start=performance.now();send(match.think());
 self.postMessage({kind:'AI_PREVIEW_PERF',policy:{...policy},workerStepMs:performance.now()-start,strategy:'AI-005',source:'695ca0524eb039808491b18c69cea1fb74da0cca'});
}
