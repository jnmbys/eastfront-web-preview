import json,statistics,pathlib,sys
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '../perf004-evidence')
def stats(a):
 return {'n':len(a),'median':round(statistics.median(a),2),'max':round(max(a),2)} if a else None
def summarize(file,part):
 d=json.loads((root/file).read_text());ss=d['samples'][part:part+10];out={'n':len(ss),'lodsBefore':[s['lodsBefore'] for s in ss],'lodsAfter':[s['lodsAfter'] for s in ss]}
 for name in ['main.js:refreshDynamicView','core-adapter/session.js:dispatchGameAction','core-adapter/session.js:sessionPlayerView','core-adapter/browserProjection.js:deriveBrowserRenderModel','multiplayer/networkSession.js:NetworkPlayerSession.renderModel','fog/surface.js:deriveFogPlan','fog/surface.js:rasterizeFog','fog:upload','fog:encodePNG','fog/runtime.js:FogRuntime.sync','render/dynamicMap.js:DynamicMapRenderer.update','presentation/svgUnits.js:SvgUnitPresentation.bind','ui/deploymentPanelRenderer.js:DeploymentPanelRenderer.update','main.js:bindDynamic','main.js:paintDeploymentFocus','ui/commandPresentation.js:commandHeader','layout:read-panelScroll','layout:write-panelScroll']:
  per=[[x['ms'] for x in d['spans'] if x['name']==name and x['start']>=s['start'] and x['start']<s['appliedAt']] for s in ss]
  out[name]={'time':stats([sum(a) for a in per]),'count':stats([len(a) for a in per])}
 out['confirmationToApplied']=stats([s['appliedAt']-s['start'] for s in ss]);out['twoRafProxy']=stats([s['readyProxyMs'] for s in ss]);
 out['confirmationTaskOrResponseTask']=stats([max([x['ms'] for x in d['tasks'] if x['start']<s['appliedAt'] and x['start']+x['ms']>s['start']] or [0]) for s in ss]);
 out['maxFrameGapInWindow']=stats([max([x['ms'] for x in d['frames'] if s['start']<=x['start']<s['start']+s['readyProxyMs']]or[0]) for s in ss]);
 for k in ['fogBuilds','presenceCreated','presenceRemoved','presenceReused','countersCreated','countersReused','createdSVG','createdHTML']:out[k]=stats([s[k] for s in ss])
 ack=[];snap=[];apply=[]
 for s in ss:
  messages=[x for x in d['network'] if s['start']<=x['start']<s['appliedAt']];a=next((x for x in messages if x['type']=='ACTION_ACCEPTED'),None);v=next((x for x in messages if x['type']=='PLAYER_VIEW_SNAPSHOT'),None)
  if a:ack.append(a.get('rtt',0))
  if a and v:snap.append(v['start']-a['start'])
  if v:apply.append(s['appliedAt']-v['start'])
 out['applyLongTask']=stats([max([x['ms'] for x in d['tasks'] if x['start']<s['appliedAt'] and x['start']+x['ms']>next((m['start'] for m in d['network'] if m.get('type')=='PLAYER_VIEW_SNAPSHOT' and s['start']<=m['start']<s['appliedAt']),s['start'])]or[0])for s in ss]);out['actionRTT']=stats(ack);out['ackToSnapshot']=stats(snap);out['snapshotApply']=stats(apply)
 out['queryMessages']=sum(x['type']=='QUERY_MATCH' for x in d['network'] if ss[0]['start']<=x['start']<=ss[-1]['appliedAt']);out['resyncMessages']=sum(x['type']=='RESYNC_MATCH' for x in d['network'] if ss[0]['start']<=x['start']<=ss[-1]['appliedAt']);out['earlyApplied']=stats([s['appliedAt']-s['start'] for s in ss[:3]]);out['lateApplied']=stats([s['appliedAt']-s['start'] for s in ss[-3:]])
 return out
out={}
for version in ['before','final']:
 for mode in ['local','mp-actor','mp-waiter']:
  file=f'browser-{version}-{mode}'+('-v3' if version=='before' else '')+'.json'
  for group,part in [('initial',0),('complete',10)]:out[f'{version}:{mode}:{group}']=summarize(file,part)
out['before:mp-actor:background']=summarize('browser-before-mp-background.json',0)
out['before:mp-waiter:background']=summarize('browser-before-waiter-background.json',0)
(root/'comparison.json').write_text(json.dumps(out,indent=2)+'\n')
for k,v in out.items():print(k,'LOD',v['lodsBefore'],'refresh',v['main.js:refreshDynamicView']['time'],'task',v['confirmationTaskOrResponseTask'],'RTT',v['actionRTT'],'ACK-SNAPSHOT',v['ackToSnapshot'])
