"""Exact actual-payment states and lexicographic, target-neutral selection."""
from fractions import Fraction
from copy import deepcopy
STATE={};TEST_STOP_AFTER=None

def outcomes(u,paid,s,ref):
    from reference009 import project_unit
    x=project_unit(u,max(0,paid-u['stock']),s)
    d,rd=Fraction(x['debt']),Fraction(ref['debt'])
    return dict(reduction=max(0,ref['maintenance']-paid),newLoss=max(0,x['loss']-ref['loss']),
        newPenalty=int(any(rd<t<=d for t in [1,2])),penaltyCrossing=int(any(Fraction(u['debt'])<t<=d for t in [1,2])),projection=x)

def optimize(p,s,units,reference,ys,delivery,work,lastwork,hub_end,arcs):
    import model
    from solver_audit import capture,register
    global STATE
    STATE=dict(stages=[],primaryProven=False,complete=False,failedStage=None,oneHotStates={})
    register(p);reduction={};newloss={};threshold={}
    assert set(reference)=={u['id'] for u in units} and s['clock']=='full'
    for u in units:
        uid=u['id'];b=model.budget(u['B'],s);ref=reference[uid];d=delivery[uid];states={};table=[]
        assert ref['maintenance']==min(b,u['stock']+ref['received'])
        # PLAYABLE-004: player-selected ceiling on maintenance reduction.
        # Zero is the default. Original min(stock+delivery, due) constraints remain.
        floor=max(0,ref['maintenance']-s.get('player_reductions',{}).get(uid,0))
        p.row({ys[uid]:1},lo=floor,label='player maintenance floor:'+uid)
        for k in range(min(b,u['stock']),b+1):
            z=p.var('actual_paid:'+uid+':'+str(k),1);states[k]=z;o=outcomes(u,k,s,ref)
            reduction[z]=o['reduction'];newloss[z]=o['newLoss'];threshold[z]=o['penaltyCrossing'];table.append(dict(paid=k,variable=p.names[z],**o))
        p.row({z:1 for z in states.values()},1,1,'one actual payment:'+uid)
        p.row({ys[uid]:1,**{z:-k for k,z in states.items()}},0,0,'actual payment value:'+uid)
        # Original y <= stock+delivery is retained. This upper envelope makes
        # equality exact when k<B; at k=B the original delivery cap may refill reserves.
        maximumDelivery=max(0,min(u['cap'],u['target'])-u['stock']);M=max(0,maximumDelivery+u['stock']-b)
        row=dict(d);row[ys[uid]]=-1;row[states[b]]=row.get(states[b],0)-M
        p.row(row,hi=-u['stock'],label='actual min upper envelope:'+uid)
        STATE['oneHotStates'][uid]=table
    x=None;objectives=[]
    def stage(name,obj,maximize=False):
        nonlocal x
        STATE['failedStage']=name;p.stage_name=name
        obj={i:v for i,v in obj.items() if v}
        x,val=p.solve(obj,maximize,True)
        objectives.append([name,int(round(val))]);STATE['stages'].append(dict(name=name,value=int(round(val)),optimal=True,solverStatus=0))
        if name=='minimum_total_maintenance_reduction_q':STATE['primaryProven']=True;STATE['minimumReductionQ']=int(round(val))
        if TEST_STOP_AFTER==name:raise TimeoutError('SYNTHETIC_STOP_AFTER_PROVED_STAGE')
    try:
        stage('minimum_total_maintenance_reduction_q',reduction)
        stage('minimum_additional_step_losses',newloss)
        stage('minimum_penalty_crossing_units',threshold)
        # Ordinary sorted IDs, not a preselected armored sacrifice list.
        for uid in sorted(ys):stage('canonical_actual_maintenance:'+uid,{ys[uid]:1},True)
        stage('reserve_delivery',{i:u.get('priority',1) for u in units for i in delivery[u['id']]},True)
        totalhub={}
        for a in hub_end.values():
            for i,v in a.items():totalhub[i]=totalhub.get(i,0)+v
        stage('remaining_hub_stock',totalhub,True)
        for u in units:stage('canonical_delivery:'+u['id'],delivery[u['id']],True)
        stage('transport_work',work|lastwork)
        # Fix every physical column in lexical order; indicators are now implied.
        indices={a['i'] for a in arcs}|{i for i,n in enumerate(p.names) if n.startswith(('source:','unload:'))}
        for i in sorted(indices,key=lambda i:p.names[i]):stage('canonical_flow:'+p.names[i],{i:1})
        STATE.update(complete=True,failedStage=None)
    except Exception as e:
        STATE['error']=str(e);STATE['partial']=True
        if x is None:raise
        # No new variables are added between stages. The last proved solution
        # satisfies all frozen objectives and all original network constraints.
    certificate=capture(p,x);STATE['certificateHashColumns']=len(certificate['columns'])
    return x,objectives,certificate
