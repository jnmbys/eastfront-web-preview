from copy import deepcopy
NAMES={'breakthrough':'装甲突破过远','concentration':'大军集中','cut_repair':'铁路切断与抢修','hub_backup':'枢纽失守与备用线','pocket':'被围、突围与救援'}
def scenario(key='concentration',clock='full',variant='A',reserve=4,policy='last',use_t=True,order='GS'):
    assert key in NAMES and clock in ('full','half') and variant in ('A','B') and reserve in (2,4,6) and policy in ('last','floor') and order in ('GS','SG')
    nodes=[{'id':n,'x':x,'y':y,'terrain':t,'known':True,'control':'G'} for n,x,y,t in [('R',0,2,'city'),('J',1,2,'plain'),('HA',3,1,'city'),('HB',3,3,'city'),('X',4,2,'plain'),('P',5,2,'bridge'),('U1',6,1,'plain'),('U2',6,3,'plain'),('U3',6,2,'plain'),('F',7,2,'forest'),('FH',8,1,'hill'),('FF',8,3,'forest'),('FR',8,2,'river')]]
    edges=[]
    def edge(id,a,b,modes,cap=40,cost=1,**kw):edges.append(dict(id=id,a=a,b=b,modes=modes,cap=cap,cost=cost,rail_cost=1,cut=False,**kw))
    edge('trunk','R','J',['rail'],48);edge('rail_A','J','HA',['rail'],32);edge('rail_B','J','HB',['rail'],32)
    edge('backup','R','HB',['rail'],8);edges[-1]['rail_cost']=4;edges[-1]['cut']=True
    edge('road_A','HA','X',['road']);edge('road_B','HB','X',['road']);edge('bridge','X','P',['road'],bridge_cap=48)
    for n in ['U1','U2','U3']:edge('road_'+n,'P',n,['road'])
    edge('deep','U3','F',['road'],cost=3,move_cost=3)
    edge('hill_exit','F','FH',['road'],cost=2,move_cost=2)
    edge('forest_exit','F','FF',['road'],cost=3,move_cost=3)
    edge('river_exit','F','FR',['road'],cost=2,move_cost=2);edges[-1]['cut']=True
    hubs=[dict(id=n,node=n,side='G',stock=0,cap=32,W=72,quota=24,range=4,floor=4,inactive=False) for n in ['HA','HB']]
    def unit(i,node,B=8,stock=0):return dict(id=i,node=node,side='G',B=B,stock=stock,cap=B*reserve,target=B*reserve,debt='0',strength=3,priority=1,MP=4)
    units=[unit('G1','U1'),unit('G2','U2')]
    s=dict(ruleset='supply-exp-001-'+variant.lower()+'1',scenario=key,name=NAMES[key],nodes=nodes,edges=edges,sources=[dict(id='rear',node='R',side='G',cap=64)],hubs=hubs,units=units,clock=clock,variant=variant,T=160,use_t=use_t,policy=policy,order=order,tick=0,half=0,epoch='L0',rotation=0,repairs=[],done={},actions=[],pending=False,game_over=False,ledger=[],hidden={})
    if key=='breakthrough':
        s['units']=[unit('G1','F',8,max(0,reserve*8-8))]
    if key=='concentration':
        next(e for e in edges if e['id']=='trunk')['cap']=24
        s['units']=[unit('G1','U1'),unit('G2','U2'),unit('G3','U3')]
    if key=='cut_repair':
        next(e for e in edges if e['id']=='trunk')['cut']=True
        for h in hubs:h['stock']=8 if variant=='A' else 0
        s['units']=[unit('G'+str(i+1),['U1','U2','U3','U1'][i],4,0 if variant=='A' else 4) for i in range(4)]
    if key=='hub_backup':
        hubs[0].update(stock=0,inactive=True,side='S')
        s['losses']=[dict(hub='HA',lost=16 if variant=='A' else 0)]
        next(e for e in edges if e['id']=='backup')['cut']=False
        next(e for e in edges if e['id']=='rail_B')['cut']=True
        s['units']=[unit('G1','U1',4),unit('G2','U2',4)]
    if key=='pocket':
        next(e for e in edges if e['id']=='deep')['cut']=True
        s['units']=[unit('G1','F',4,max(0,reserve*4-4)),unit('G2','F',4,max(0,reserve*4-4))]
        for h in hubs:h['range']=7
    return s

def timing_scenario(clock='full',order='GS'):
    # Mirror two independent copies; no privileged nation logistics functions.
    s=scenario('cut_repair',clock=clock,order=order);s['units']=s['units'][:1];s['units'][0]['stock']=4
    for h in s['hubs']:h['stock']=0
    next(e for e in s['edges'] if e['id']=='trunk')['cut']=False
    mirror=deepcopy(s)
    for n in mirror['nodes']:n['id']='S_'+n['id'];n['control']='S'
    for e in mirror['edges']:e['id']='S_'+e['id'];e['a']='S_'+e['a'];e['b']='S_'+e['b']
    for group in ('sources','hubs','units'):
        for x in mirror[group]:x['id']='S_'+x['id'];x['node']='S_'+x['node'];x['side']='S'
    for group in ('nodes','edges','sources','hubs','units'):s[group]+=mirror[group]
    return s
