from __future__ import annotations
import json, math, random, heapq, csv, statistics, os
from dataclasses import dataclass, field, asdict
from collections import defaultdict, deque, Counter
from pathlib import Path

MAP_PATH = '/mnt/data/eastfront_strategic_reset_F_AI_map.json'
MAP = json.load(open(MAP_PATH, encoding='utf-8'))
ROWS, COLS = MAP['rows'], MAP['cols']

# ---------- Hex geometry / graph ----------
def neigh_pos(p):
    c,r=p
    q=c-1
    if q%2==0: # unshifted column
        cand=[(c,r-1),(c,r+1),(c-1,r-1),(c-1,r),(c+1,r-1),(c+1,r)]
    else:
        cand=[(c,r-1),(c,r+1),(c-1,r),(c-1,r+1),(c+1,r),(c+1,r+1)]
    return [x for x in cand if 1<=x[0]<=COLS and 1<=x[1]<=ROWS]

NBR={ (c,r):neigh_pos((c,r)) for c in range(1,COLS+1) for r in range(1,ROWS+1)}

def cube(p):
    c,r=p; q=c-1; rr=r-1
    x=q; z=rr-(q-(q&1))//2; y=-x-z
    return x,y,z

def hdist(a,b):
    ax,ay,az=cube(a); bx,by,bz=cube(b)
    return max(abs(ax-bx),abs(ay-by),abs(az-bz))

TERR={tuple(map(int,k.split(','))):v for k,v in MAP['terrain'].items()}
ROADS={frozenset((tuple(a),tuple(b))) for a,b in MAP['roads']}
RAILS={frozenset((tuple(a),tuple(b))) for a,b in MAP['rails']}
ROAD_G=defaultdict(list); RAIL_G=defaultdict(list)
for e in ROADS:
    a,b=tuple(e); ROAD_G[a].append(b); ROAD_G[b].append(a)
for e in RAILS:
    a,b=tuple(e); RAIL_G[a].append(b); RAIL_G[b].append(a)
RIVER={frozenset((tuple(x['a']),tuple(x['b']))):x['kind'] for x in MAP['rivers']}
WEST_ENTRIES=[(1,5),(1,10),(1,16)]
EAST_EXITS=[(32,4),(32,10),(32,16)]
CORE={(29,10),(29,11)}; OUTER={(30,10)}
CITY_NODES={p for p,t in TERR.items() if t in ('city','maincity','outercity')}
RAIL_NODES=set(RAIL_G)
ROAD_NODES=set(ROAD_G)

# Rail line attribution based on nearest west entry along rail graph.
def rail_bfs(entry):
    d={entry:0}; dq=deque([entry])
    while dq:
        u=dq.popleft()
        for v in RAIL_G.get(u,[]):
            if v not in d:
                d[v]=d[u]+1; dq.append(v)
    return d
RAIL_ENTRY_DIST=[rail_bfs(e) for e in WEST_ENTRIES]
RAIL_LINE={}
for p in RAIL_NODES:
    ds=[d.get(p,9999) for d in RAIL_ENTRY_DIST]
    RAIL_LINE[p]=min(range(3),key=lambda i:ds[i])

# ---------- Units ----------
# A, D, M for damage states 0,1,2. Damage 3 destroys regular units.
SPECS={
 'G':{
  'inf':[(5,5,3),(4,4,3),(3,3,2)],
  'jager':[(5,5,4),(4,4,4),(3,3,3)],
  'panzer':[(8,6,6),(6,5,6),(4,3,5)],
  'mot':[(6,5,5),(5,4,5),(3,3,4)],
  'arty':[(0,1,2),(0,1,2),(0,1,1)],
  'eng':[(3,3,3),(2,2,3),(1,1,2)],
  'recon':[(2,2,6),(1,1,6),(1,1,5)],
  'hq':[(0,1,4)]*3,
 },
 'S':{
  'inf':[(3,3,3),(2,2,3),(1,1,2)],
  'elite':[(5,5,3),(4,4,3),(2,2,2)],
  'tank':[(6,5,5),(4,4,5),(3,2,4)],
  'mot':[(4,4,5),(3,3,4),(2,2,4)],
  'heavy':[(5,7,4),(4,6,4),(2,4,3)],
  'at':[(2,2,3),(1,1,3),(1,1,2)],
  'arty':[(0,1,2),(0,1,2),(0,1,1)],
  'eng':[(2,2,3),(1,1,3),(1,1,2)],
  'hq':[(0,1,4)]*3,
 }
}
SUPPORT_TYPES={'arty','eng','hq'}
ZOC_TYPES={'inf','jager','panzer','mot','recon','elite','tank','heavy','at'}
ARMOR_TYPES={'panzer','tank','heavy'}
INF_COORD_TYPES={'inf','jager','mot','elite'}
ENTRENCH_TYPES={'inf','jager','elite'}
TYPE_VALUE={
 'inf':4,'jager':5,'panzer':9,'mot':7,'arty':6,'eng':5,'recon':3,'elite':7,'tank':8,'heavy':9,'at':5,'hq':8
}
TYPE_CN={'inf':'步兵','jager':'猎兵','panzer':'装甲','mot':'摩托化','arty':'炮兵','eng':'工兵','recon':'侦察','elite':'精锐','tank':'坦克','heavy':'重型坦克','at':'反坦克','hq':'HQ'}

@dataclass
class Unit:
    id:str; side:str; typ:str; pos:tuple
    step:int=0; alive:bool=True; supplied:bool=True; entrenched:bool=False
    moved:bool=False; fought:bool=False; temp_supply:bool=False; dedicated_repair:bool=False
    last_hq_cmd_turn:int=0
    sector:int=1
    def stat(self):
        s=min(self.step,2); return SPECS[self.side][self.typ][s]
    @property
    def A(self): return self.stat()[0]
    @property
    def D(self): return self.stat()[1]
    @property
    def M(self): return self.stat()[2]
    @property
    def support(self): return self.typ in SUPPORT_TYPES
    @property
    def max_steps(self): return 1 if self.typ=='hq' else 3

# CRT
COLS_CRT=['1:3','1:2','2:3','1:1','3:2','2:1','3:1','4:1+']
THRESH=[1/3,1/2,2/3,1,1.5,2,3,4]
CRT={
2:['A3R','A3R','A3R','A2','A1','AR','EX','NE'],
3:['A3R','A3R','A2','A1','AR','EX','NE','DR'],
4:['A3R','A3R','A2','A1','AR','EX','NE','DR'],
5:['A3R','A2','A1','AR','EX','NE','DR','D1R'],
6:['A3R','A2','A1','AR','EX','NE','DR','D1R'],
7:['A2','A1','AR','EX','NE','DR','D1R','D2R'],
8:['A1','AR','EX','NE','DR','D1R','D2R','D3R'],
9:['AR','EX','NE','DR','D1R','D2R','D3R','D3R'],
10:['EX','NE','DR','D1R','D2R','D3R','D3R','D3R'],
11:['NE','DR','D1R','D2R','D3R','D3R','D3R','D3R'],
12:['DR','D1R','D2R','D3R','D3R','D3R','D3R','D3R']}
DICE_PROB={2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1}
RES_LOSS={
 'A3R':(3,0,1,0),'A2':(2,0,0,0),'A1':(1,0,0,0),'AR':(0,0,1,0),
 'EX':(1,1,0,0),'NE':(0,0,0,0),'DR':(0,0,0,1),'D1R':(0,1,0,1),
 'D2R':(0,2,0,2),'D3R':(0,3,0,2)} # a_loss,d_loss,a_ret,d_ret

# Latest Soviet reinforcement curve: 13 units, no special counterattack system.
REINFORCEMENTS={
 4:['inf','inf'],
 7:['inf','inf','at'],
 10:['inf','mot','tank'],
 13:['inf','tank','elite'],
 15:['tank','mot']
}

@dataclass
class BattleRecord:
    side:str; target:tuple; target_hex:str; terrain:str
    attackers:list; defenders:list; odds_base:str; odds_final:str
    shift_reasons:list; dice:int; result:str
    attacker_command:str|None=None; defender_command:str|None=None
    attacker_artillery:str|None=None; defender_artillery:str|None=None
    before_attackers:list=field(default_factory=list); before_defenders:list=field(default_factory=list)
    after_attackers:list=field(default_factory=list); after_defenders:list=field(default_factory=list)
    second_attack:bool=False

# ---------- Game ----------
class Game:
    def __init__(self, seed=1, record=False, ai_level='v3'):
        self.rng=random.Random(seed); self.seed=seed; self.record=record; self.ai_level=ai_level
        self.units={}; self.turn=0; self.phase='Deployment'; self.winner=None; self.win_turn=None
        self.rp={'G':8,'S':12}; self.cp={'G':1,'S':1}
        self.repaired=set(WEST_ENTRIES)
        self.railheads=list(WEST_ENTRIES)
        self.city_control={p:('G' if p[0]<=3 else 'S') for p in CITY_NODES}
        self.frames=[]; self.events=[]; self.battles=[]; self.schwerpunkt_used=False
        self.staff_plan={'G':None,'S':None}; self.delayed_reinf=[]
        self._pos_cache=None; self._supply_hex={'G':set(),'S':set()}; self._road_supply=set()
        self.metrics={
            'hq_commands_G':Counter(),'hq_commands_S':Counter(), 'soviet_attacks_t10plus':0,
            'g_oos_turns':[],'s_oos_turns':[], 'rail_repaired_per_turn':[], 'g_max_col':3,
            'capital_battles':0,'s_reinforcements_entered':0,'s_reinforcements_delayed':0,
        }
        self._deploy()
        self._update_controls()
        self._compute_supply('G'); self._compute_supply('S')
        if record:self._snapshot('Deployment')

    def _deploy(self):
        # Use the extensively playtested V9 reference deployment as the AI's legal free-deployment choice.
        for x in MAP['deployment']:
            side='G' if x['side']=='German' else 'S'
            typ=x['type']
            u=Unit(x['unit_id'],side,typ,(x['col'],x['row']))
            u.sector=0 if x['row']<=7 else 1 if x['row']<=13 else 2
            self.units[u.id]=u
        # HQs are extra units, North and South.
        for side,items in [('G',[('G-HQ-N',(2,6),0),('G-HQ-S',(2,15),2)]),
                           ('S',[('S-HQ-N',(13,7),0),('S-HQ-S',(13,15),2)])]:
            for uid,pos,sec in items:
                # If support slot occupied, find nearest legal hex.
                if not self._can_stack(side,'hq',pos,ignore=None):
                    pos=self._nearest_stackable(side,'hq',pos)
                self.units[uid]=Unit(uid,side,'hq',pos,sector=sec)

    def _nearest_stackable(self,side,typ,start):
        for rad in range(0,6):
            cand=[p for p in NBR if hdist(start,p)==rad]
            self.rng.shuffle(cand)
            for p in cand:
                if self._can_stack(side,typ,p,None):return p
        return start

    def us(self,side,alive=True):
        return [u for u in self.units.values() if u.side==side and (u.alive or not alive)]
    def enemy(self,side): return 'S' if side=='G' else 'G'
    def _rebuild_pos_cache(self):
        d=defaultdict(list)
        for u in self.units.values():
            if u.alive:d[u.pos].append(u)
        self._pos_cache=d
    def _invalidate_pos(self): self._pos_cache=None
    def _set_pos(self,u,p):
        if u.pos!=p:
            u.pos=p; self._invalidate_pos()
    def at(self,p,side=None):
        if self._pos_cache is None:self._rebuild_pos_cache()
        arr=self._pos_cache.get(p,[])
        return arr if side is None else [u for u in arr if u.side==side]
    def occupied(self,p,side=None): return bool(self.at(p,side))

    def _can_stack(self,side,typ,p,ignore=None):
        if not (1<=p[0]<=COLS and 1<=p[1]<=ROWS): return False
        if TERR.get(p)=='lake': return False
        if self.occupied(p,self.enemy(side)): return False
        arr=[u for u in self.at(p,side) if u.id!=ignore]
        return len(arr)<2

    def _update_controls(self):
        for p in CITY_NODES:
            arr=self.at(p)
            sides={u.side for u in arr}
            if len(sides)==1:self.city_control[p]=next(iter(sides))

    def enemy_zoc(self,side):
        enemy=self.enemy(side); out=set()
        for u in self.us(enemy):
            if u.typ in ZOC_TYPES:
                out.update(NBR[u.pos])
        return out

    # ---------- Supply ----------
    def _connected_repaired(self):
        # Repaired rail network connected to any west entry. Captured cities are required to pass through city nodes.
        valid=set(self.repaired)
        dq=deque([e for e in WEST_ENTRIES if e in valid]); seen=set(dq)
        while dq:
            u=dq.popleft()
            for v in RAIL_G.get(u,[]):
                if v not in valid or v in seen: continue
                if self.occupied(v,'S'): continue
                if v in CITY_NODES and self.city_control.get(v)=='S' and v not in WEST_ENTRIES: continue
                seen.add(v); dq.append(v)
        return seen

    def _choose_railheads(self):
        conn=self._connected_repaired(); heads=[]
        for line in range(3):
            nodes=[p for p in conn if RAIL_LINE.get(p)==line]
            if not nodes: continue
            # frontier preferred, then deepest along line
            front=[p for p in nodes if any(v not in conn for v in RAIL_G.get(p,[]))]
            pool=front or nodes
            d=RAIL_ENTRY_DIST[line]
            best=max(pool,key=lambda p:(d.get(p,-1),p[0]))
            heads.append(best)
        # cap 3, unique
        out=[]
        for h in heads:
            if h not in out:out.append(h)
        self.railheads=out[:3]
        return self.railheads

    def _german_sources(self):
        conn=self._connected_repaired(); self._choose_railheads()
        cities=[p for p in conn if p in CITY_NODES and self.city_control.get(p)=='G']
        return list(dict.fromkeys(self.railheads+cities))

    def _soviet_active_rail(self):
        blocked=set()
        for p in RAIL_NODES:
            if self.occupied(p,'G'): blocked.add(p)
            elif p in CITY_NODES and self.city_control.get(p)=='G': blocked.add(p)
        dq=deque([e for e in EAST_EXITS if e not in blocked]); seen=set(dq)
        while dq:
            u=dq.popleft()
            for v in RAIL_G.get(u,[]):
                if v in blocked or v in seen:continue
                seen.add(v);dq.append(v)
        return seen

    def _road_reachable(self,sources,maxd=8):
        d={s:0 for s in sources if s in ROAD_G}; dq=deque(d)
        while dq:
            u=dq.popleft()
            if d[u]>=maxd: continue
            for v in ROAD_G.get(u,[]):
                if v not in d:
                    d[v]=d[u]+1;dq.append(v)
        return d

    def _radius_hexes(self,sources,radius):
        # Multi-source unweighted hex BFS.
        seen=set(sources); dq=deque((s,0) for s in sources)
        while dq:
            u,d=dq.popleft()
            if d>=radius:continue
            for v in NBR[u]:
                if v not in seen:
                    seen.add(v);dq.append((v,d+1))
        return seen

    def _build_supply_env(self,side):
        if side=='G':
            sources=self._german_sources(); self._supply_hex['G']=self._radius_hexes(sources,5)
            self._road_supply=set()
        else:
            active=self._soviet_active_rail(); self._supply_hex['S']=self._radius_hexes(active,5)

    def _compute_supply(self,side,commit=True):
        self._build_supply_env(side)
        supplied=self._supply_hex[side]
        res={}
        for u in self.us(side):
            val=u.pos in supplied
            if commit:u.supplied=val
            res[u.id]=val
        return res

    def is_effectively_supplied(self,u): return u.supplied or u.temp_supply

    # ---------- Rail repair ----------
    def _engineer_bonus_available(self):
        # Current tabletop rule only requires a supplied engineer to be dedicated; no extra distance test.
        return [u for u in self.us('G') if u.typ=='eng' and u.supplied]

    def repair_rail(self):
        conn=self._connected_repaired(); engs=self._engineer_bonus_available()
        bonus=bool(engs); total=5 if bonus else 4
        line_cap=[2,2,2]
        if engs:
            # Dedicate the engineer closest to the most strategically useful frontier; its line can receive 3.
            # Dedicate one supplied engineer. Its current operational sector gets the 3-hex line cap.
            # Choose the engineer/sector with the greatest current frontline demand.
            def line_demand(e):
                ln=0 if e.pos[1]<=7 else 1 if e.pos[1]<=13 else 2
                front=max((u.pos[0] for u in self.us('G') if u.sector==ln and u.typ!='hq'),default=3)
                repaired=max((p[0] for p in conn if RAIL_LINE.get(p)==ln),default=1)
                return front-repaired,ln
            e=max(engs,key=lambda x:line_demand(x)[0]); e.dedicated_repair=True
            line=line_demand(e)[1]; line_cap[line]=3
        used=[0,0,0]; added=[]
        for _ in range(total):
            conn=self._connected_repaired()
            cands=[]
            occS={u.pos for u in self.us('S')}
            for u in conn:
                for v in RAIL_G.get(u,[]):
                    if v in self.repaired or v in occS:continue
                    ln=RAIL_LINE.get(v,1)
                    if used[ln]>=line_cap[ln]:continue
                    # Cannot repair/cross an uncaptured city.
                    if v in CITY_NODES and self.city_control.get(v)=='S':continue
                    # score: eastward progress + nearby friendly demand + capital direction + avoid enemy ZOC
                    friendly=[x for x in self.us('G') if x.sector==ln]
                    demand=sum(max(0,6-hdist(v,x.pos)) for x in friendly)
                    cap=-min(hdist(v,c) for c in CORE)
                    zpen=6 if v in self.enemy_zoc('G') else 0
                    sc=2.2*v[0]+0.7*demand+0.3*cap-zpen+self.rng.random()*0.25
                    cands.append((sc,v,ln))
            if not cands:break
            _,v,ln=max(cands)
            self.repaired.add(v); used[ln]+=1;added.append(v)
        self._choose_railheads()
        self.metrics['rail_repaired_per_turn'].append(len(added))
        if added:self.events.append({'type':'rail_repair','hexes':[hexname(x) for x in added],'count':len(added),'engineer_bonus':bonus})
        return added

    # ---------- HQ commands ----------
    def hqs(self,side,available_only=False):
        hs=[u for u in self.us(side) if u.typ=='hq' and u.supplied]
        if available_only: hs=[h for h in hs if h.last_hq_cmd_turn!=self.turn]
        return hs
    def hq_in_range(self,side,target,available=True):
        hs=self.hqs(side,available)
        return [h for h in hs if hdist(h.pos,target)<=3]
    def use_hq(self,side,hq,cmd,cost,target=None,extra=None):
        if self.cp[side]<cost or hq.last_hq_cmd_turn==self.turn or not hq.supplied:return False
        self.cp[side]-=cost; hq.last_hq_cmd_turn=self.turn
        self.metrics['hq_commands_'+side][cmd]+=1
        self.events.append({'type':'hq_command','side':side,'hq':hq.id,'command':cmd,'cost':cost,'target':hexname(target) if target else None,'extra':extra})
        return True

    def _prepare_hq_turn(self,side):
        self.cp[side]=min(3,self.cp[side]+1); self.staff_plan[side]=None
        # Extra Supplies: smart use on high-value OOS units near an available HQ.
        if self.cp[side]>=2:
            candidates=[]
            for h in self.hqs(side,True):
                us=[u for u in self.us(side) if not u.supplied and hdist(u.pos,h.pos)<=3 and u.typ!='hq']
                us.sort(key=lambda u:(TYPE_VALUE.get(u.typ,4)+(4 if u.typ in ARMOR_TYPES else 0)+(2 if u.typ=='arty' else 0),u.pos[0] if side=='G' else -u.pos[0]),reverse=True)
                if us:
                    # only if meaningful frontline assets are stranded
                    chosen=us[:3]; value=sum(TYPE_VALUE.get(u.typ,4) for u in chosen)
                    if value>=12 and self.use_hq(side,h,'Extra Supplies',2,extra=[u.id for u in chosen]):
                        for u in chosen:u.temp_supply=True
                        break
        # Staff plan: use 1CP only when a clear high-value adjacent battle already exists and one HQ remains.
        if self.cp[side]>=1:
            best=None
            enemy=self.enemy(side)
            for p in {u.pos for u in self.us(enemy)}:
                if not self.hq_in_range(side,p,True):continue
                adj=[u for u in self.us(side) if u.typ not in ('arty','hq') and u.pos in NBR[p] and self.is_effectively_supplied(u)]
                if len(adj)<2:continue
                val=self.target_value(side,p)+sum(u.A for u in adj)*0.15
                if best is None or val>best[0]:best=(val,p,adj)
            if best and best[0]>13:
                p=best[1]; h=min(self.hq_in_range(side,p,True),key=lambda x:hdist(x.pos,p))
                if self.use_hq(side,h,'Staff Office Plan',1,target=p): self.staff_plan[side]=(p,h.id)

    # ---------- Movement ----------
    def move_cost(self,u,a,b):
        edge=frozenset((a,b))
        if edge in ROADS:
            return 1
        t=TERR[b]
        if t=='lake': return 999
        base=1 if t in ('plain','city','maincity','outercity') else 2
        if u.typ=='jager' and t in ('forest','hill'): base=max(1,base-1)
        kind=RIVER.get(edge)
        if kind=='small': base+=1
        elif kind=='main': base+=2
        return base

    def reachable(self,u):
        base_mp=u.M-(0 if self.is_effectively_supplied(u) else 1); base_mp=max(0,base_mp)
        ez=self.enemy_zoc(u.side); start=u.pos; recon=(u.typ=='recon')
        # State = (position, recon_ignore_used, road_only, zoc_clean).
        # A unit that remains entirely on roads and never enters enemy ZOC may use +1 MP.
        clean0=start not in ez
        dist={(start,False,True,clean0):0}; pq=[(0,start,False,True,clean0)]
        out={start:0}
        while pq:
            cost,p,ig,road_only,clean=heapq.heappop(pq)
            if cost!=dist.get((p,ig,road_only,clean)): continue
            start_in_z=p in ez
            for q in NBR[p]:
                if TERR.get(q)=='lake': continue
                if self.occupied(q,self.enemy(u.side)): continue
                edge=frozenset((p,q)); edge_road=edge in ROADS
                nr=road_only and edge_road
                qz=q in ez; nclean=clean and not qz
                nc=cost+self.move_cost(u,p,q)
                limit=base_mp + (1 if nr and nclean else 0)
                if nc>limit: continue
                if start_in_z and qz and not (recon and not ig): continue
                # Entering enemy ZOC normally ends movement. Recon may spend its once/turn ignore.
                if qz and recon and not ig:
                    st=(q,True,nr,False)
                    if nc<dist.get(st,999):
                        dist[st]=nc; heapq.heappush(pq,(nc,q,True,nr,False))
                st=(q,ig,nr,nclean)
                if nc<dist.get(st,999):
                    dist[st]=nc
                    if not qz: heapq.heappush(pq,(nc,q,ig,nr,nclean))
                out[q]=min(out.get(q,999),nc)
        return out

    def _front_col(self,side,sector):
        us=[u.pos[0] for u in self.us(side) if u.sector==sector and u.typ!='hq']
        if not us:return 3 if side=='G' else 29
        return max(us) if side=='G' else min(us)

    def _supply_if_at(self,u,p):
        return p in self._supply_hex[u.side]

    def _strategic_score(self,u,p):
        side=u.side;t=TERR[p]; enemy=self.enemy(side); score=0.0
        # Stacking legality as destination.
        if not self._can_stack(side,u.typ,p,u.id):return -1e9
        if side=='G':
            turnfrac=self.turn/16
            # Progress and capital convergence increase over time.
            capd=min(hdist(p,c) for c in CORE)
            score += 1.1*p[0] - (1.15+1.6*turnfrac)*capd
            sector_row=[5,10,16][u.sector]
            score -= 0.22*abs(p[1]-sector_row)
            if self.turn>=10: score -= 0.45*abs(p[1]-10.5)
            # Logistics: don't outrun the rail/road umbrella unless recon/exploitation.
            supp=self._supply_if_at(u,p) or u.temp_supply
            if supp:score+=5.5
            else:score-=8.5 if u.typ in ('panzer','mot','arty') else 5.0
            # terrain role
            if u.typ=='panzer':
                if t in ('forest','marsh'):score-=2.7
                if t in ('plain','city','maincity','outercity'):score+=1.0
            if u.typ=='jager' and t in ('forest','hill'):score+=2.3
            if u.typ in ('inf','jager') and t in ('forest','hill','city','outercity'):score+=0.8
            # Recon seeks rail cuts / depth, but not suicide.
            if u.typ=='recon' and p in RAIL_NODES:score+=3.0
            # Engineers stay near railhead/front and river approaches.
            if u.typ=='eng':
                rh=min((hdist(p,h) for h in self.railheads),default=9);score-=0.8*rh
                if any(frozenset((p,q)) in RIVER for q in NBR[p]):score+=1.1
            # Artillery behind front, within 2 of enemies but not adjacent.
            if u.typ=='arty':
                ed=min((hdist(p,x.pos) for x in self.us(enemy)),default=9)
                score += 2.8 if ed==2 else 1.1 if ed==3 else -3 if ed<=1 else 0
                score-=0.35*p[0] # don't over-lead the line
            if u.typ=='hq':
                friends=[x for x in self.us(side) if x.typ not in ('hq','arty') and x.sector==u.sector]
                near=sum(1 for x in friends if hdist(p,x.pos)<=3)
                score+=1.3*near;score-=2.5 if any(hdist(p,e.pos)<=1 for e in self.us(enemy)) else 0
            # Attack setup and cohesion.
            adjE=[e for e in self.us(enemy) if e.pos in NBR[p]]
            if adjE:
                score += min(5,1.1*sum(TYPE_VALUE.get(e.typ,4) for e in adjE))
                if u.typ=='arty' or u.typ=='hq':score-=10
            nearF=sum(1 for x in self.us(side) if x.id!=u.id and hdist(p,x.pos)<=1)
            score+=0.45*min(3,nearF)
            if p in CITY_NODES:score+=2.0
            if p in CORE:score+=20
            # Soviet rail cutting
            if p in RAIL_NODES:score+=0.6
        else:
            gfront=self._front_col('G',u.sector)
            # Desired defense line is a few hexes ahead of German front, with increasing capital compression.
            desired=min(28,max(6,gfront+(3 if self.turn<=6 else 2)))
            if self.turn>=11:desired=max(desired,23)
            # Reserves stay a little deeper.
            if u.typ in ('tank','mot','heavy'):desired+=2
            if u.typ=='arty':desired+=2
            if u.typ=='hq':desired+=3
            score -= 0.9*abs(p[0]-desired)
            # Preserve capital and central approaches late.
            capd=min(hdist(p,c) for c in CORE)
            score -= (0.45+1.0*self.turn/16)*capd
            if self.turn>=10:score-=0.25*abs(p[1]-10.5)
            # defensive terrain
            if t=='forest':score+=2.0
            elif t=='hill':score+=2.2
            elif t in ('city','outercity'):score+=2.8
            elif t=='maincity':score+=5.0
            elif t=='marsh':score+=1.2
            if p in CORE:score+=18
            if p== (30,10):score+=8
            # Supply/rail integrity
            supp=self._supply_if_at(u,p) or u.temp_supply
            if supp:score+=5
            else:score-=7 if u.typ in ('tank','mot','heavy','arty') else 4.5
            if p in RAIL_NODES:score+=1.0
            # Frontline infantry delay; mobile reserve avoids premature contact early.
            adjE=[e for e in self.us('G') if e.pos in NBR[p]]
            if adjE:
                if u.typ in ('inf','elite','at') and t in ('forest','hill','city','maincity','outercity'):score+=3.0
                elif u.typ in ('tank','mot','heavy') and self.turn<9:score-=2.5
                else:score+=0.6
                # strongly avoid being adjacent to multiple German stacks when unsupported
                score-=1.2*max(0,len(adjE)-1)
            nearF=sum(1 for x in self.us(side) if x.id!=u.id and hdist(p,x.pos)<=1)
            score+=0.55*min(3,nearF)
            # Mobile units become genuine counterattack reserve from T10, without a special combat bonus.
            if self.turn>=10 and u.typ in ('tank','mot','heavy'):
                vulnerable=[g for g in self.us('G') if (not g.supplied or g.typ in ('panzer','mot')) and hdist(p,g.pos)<=2]
                score+=1.8*len(vulnerable)
            if u.typ=='arty':
                ed=min((hdist(p,x.pos) for x in self.us('G')),default=9)
                score+=2.2 if ed in (2,3) else -3 if ed<=1 else 0
            if u.typ=='hq':
                friends=[x for x in self.us(side) if x.typ not in ('hq','arty') and x.sector==u.sector]
                score+=1.15*sum(1 for x in friends if hdist(p,x.pos)<=3)
                if any(hdist(p,e.pos)<=1 for e in self.us('G')):score-=6
        # If Staff Office Plan was declared, actually maneuver combat units toward the planned target.
        sp=self.staff_plan.get(side)
        if sp and u.typ not in ('arty','hq'):
            target=sp[0]
            if p in NBR[target]: score+=4.2
            elif hdist(p,target)<=2: score+=1.2
        # German armor is valuable: keep Panzers near infantry coordination instead of solo raiding.
        if side=='G' and u.typ=='panzer':
            coord=sum(1 for x in self.us('G') if x.id!=u.id and x.typ in ('inf','jager','mot') and hdist(p,x.pos)<=1)
            score+=1.5*min(2,coord)
            if coord==0 and self.turn<12: score-=2.8
        # Small random tie breaker for strategy diversity.
        score += self.rng.random()*0.35
        return score

    def move_unit(self,u):
        if not u.alive or u.dedicated_repair:return
        reach=self.reachable(u)
        scored=[]
        for p,cost in reach.items():
            if not self._can_stack(u.side,u.typ,p,u.id):continue
            sc=self._strategic_score(u,p)
            # slight movement cost preference to prevent pointless shuffling
            sc-=0.08*cost
            if p==u.pos:sc+=0.35
            scored.append((sc,p))
        if not scored:return
        scored.sort(reverse=True,key=lambda x:x[0])
        # Smart but non-deterministic top choice; 85% top, otherwise among top3.
        if len(scored)>1 and self.rng.random()>0.85:
            pick=self.rng.choice(scored[:min(3,len(scored))])[1]
        else:pick=scored[0][1]
        if pick!=u.pos:
            old=u.pos;self._set_pos(u,pick);u.moved=True;u.entrenched=False
            self.events.append({'type':'move','unit':u.id,'from':hexname(old),'to':hexname(pick)})

    def movement_phase(self,side):
        # Order supports coordinated fronts and avoids HQ/artillery getting in the way.
        if side=='G':order={'inf':1,'jager':1,'panzer':2,'mot':2,'recon':3,'eng':4,'arty':5,'hq':6}
        else:order={'inf':1,'elite':1,'at':1,'tank':2,'heavy':2,'mot':2,'eng':4,'arty':5,'hq':6}
        us=sorted(self.us(side),key=lambda u:(order.get(u.typ,4),u.sector,self.rng.random()))
        for u in us:self.move_unit(u)
        self._update_controls()

    # ---------- Combat ----------
    def ratio_col(self,A,D):
        if D<=0:return 7
        r=A/D
        idx=0
        for i,t in enumerate(THRESH):
            if r>=t:idx=i
        return min(7,idx)

    def art_support(self,side,target,attack=True):
        cand=[]
        for u in self.us(side):
            if u.typ!='arty' or not u.supplied or u.step>=2:continue
            rng=2 if u.step==0 else 1
            if hdist(u.pos,target)<=rng:cand.append(u)
        if not cand:return None
        return min(cand,key=lambda u:hdist(u.pos,target))

    def _fully_surrounded(self,side,p):
        ez=self.enemy_zoc(side)
        for q in NBR[p]:
            if self.occupied(q,self.enemy(side)):continue
            if q in ez:continue
            # at least some stack capacity for a combat/support unit
            if any(self._can_stack(side,t,q,None) for t in ('inf','tank','eng')):return False
        return True

    def combat_calc(self,side,target,attackers,att_cmd=None,def_cmd=None,second_attack=False,for_eval=False):
        enemy=self.enemy(side); defenders=self.at(target,enemy)
        if not defenders:return None
        A=0
        for u in attackers:
            val=u.A
            if not self.is_effectively_supplied(u):val=math.ceil(val/2)
            A+=val
        D=sum(u.D for u in defenders)
        if defenders and all((not u.supplied) for u in defenders) and self._fully_surrounded(enemy,target):D=math.ceil(D/2)
        base_idx=self.ratio_col(A,D); shifts=[]; shift=0
        terr=TERR[target]
        # terrain defense
        terrain_pen=0
        if terr in ('forest','hill','marsh','city','maincity','outercity'):terrain_pen=1
        if terr=='forest' and any(u.typ=='jager' for u in attackers):terrain_pen=0
        # river only if every attack direction crosses river; use strongest river penalty among edges.
        dirs={u.pos for u in attackers}
        river_kinds=[]
        if dirs:
            for p in dirs:
                k=RIVER.get(frozenset((p,target)))
                if k:river_kinds.append(k)
            if len(river_kinds)!=len(dirs):river_pen=0
            else: river_pen=2 if 'main' in river_kinds else (1 if river_kinds else 0)
        else:river_pen=0
        # Engineer cancels one river OR city penalty.
        has_eng=any(u.typ=='eng' for u in attackers)
        if has_eng:
            if river_pen>0:river_pen-=1;shifts.append(('engineer',+1))
            elif terrain_pen>0 and terr in ('city','maincity','outercity'):terrain_pen-=1;shifts.append(('engineer',+1))
        if terrain_pen:shift-=terrain_pen;shifts.append(('terrain',-terrain_pen))
        if river_pen:shift-=river_pen;shifts.append(('river_crossing',-river_pen))
        # Combined arms German
        if side=='G':
            good_pz=any(u.typ=='panzer' and u.step<=1 and self.is_effectively_supplied(u) for u in attackers)
            coord=any(u.typ in ('inf','jager','mot') and self.is_effectively_supplied(u) for u in attackers)
            if good_pz and coord:shift+=1;shifts.append(('combined_arms',1))
        # unsupported armor in complex terrain
        if terr in ('forest','city','maincity','outercity','marsh') and any(u.typ in ARMOR_TYPES for u in attackers):
            if not any(u.typ in INF_COORD_TYPES for u in attackers):shift-=1;shifts.append(('unsupported_armor',-1))
        # AT defense
        if any(u.typ=='at' and u.step<=1 for u in defenders) and any(u.typ in ARMOR_TYPES for u in attackers):shift-=1;shifts.append(('AT_defense',-1))
        # Artillery
        a_art=self.art_support(side,target,True); d_art=self.art_support(enemy,target,False)
        if a_art:shift+=1;shifts.append(('attacker_artillery',1))
        if d_art:shift-=1;shifts.append(('defender_artillery',-1))
        # flank: at least 3 origins
        if len(dirs)>=3:shift+=1;shifts.append(('flank_attack',1))
        # entrenchment
        ent=any(u.entrenched for u in defenders) and target not in CORE
        if ent:shift-=1;shifts.append(('entrenchment',-1))
        # HQ attacker command
        if att_cmd=='Force Attack':shift+=1;shifts.append(('Force Attack',1))
        elif att_cmd=='Staff Office Plan':shift+=1;shifts.append(('Staff Office Plan',1))
        elif att_cmd=='Makeshift Bridges' and river_pen>0:
            shift+=1;shifts.append(('Makeshift Bridges',1))
        elif att_cmd=='Siege Artillery' and a_art and (terrain_pen>0 or ent):
            shift+=1;shifts.append(('Siege Artillery',1))
        if second_attack:shift-=1;shifts.append(('Schwerpunkt 2nd',-1))
        if def_cmd=='Last Stand':shift-=1;shifts.append(('Last Stand',-1))
        shift=max(-2,min(2,shift))
        final_idx=max(0,min(7,base_idx+shift))
        return {'A':A,'D':D,'base_idx':base_idx,'final_idx':final_idx,'shifts':shifts,'a_art':a_art,'d_art':d_art,'terr':terr,'river_pen':river_pen,'ent':ent}

    def _expected_utility(self,side,target,attackers,calc,att_cmd=None,def_cmd=None):
        util=0.0
        tval=self.target_value(side,target)
        for roll,w in DICE_PROB.items():
            res=CRT[roll][calc['final_idx']]; al,dl,ar,dr=RES_LOSS[res]
            if att_cmd=='Force Attack' and ar:al+=1;ar=0
            if def_cmd=='Last Stand' and dr:dl+=1;dr=0
            # side-specific preservation priorities
            if side=='G':
                # If a subset contains infantry screens, multi-step losses tend to fall on cheaper troops first;
                # solo/armor-heavy attacks are much more expensive and the AI should recognize that.
                cheap=min((TYPE_VALUE.get(u.typ,4) for u in attackers if u.alive),default=5)
                armor_share=sum(u.typ in ARMOR_TYPES for u in attackers)/max(1,len(attackers))
                loss_cost=3.4 + .34*cheap + 2.0*armor_share
                util += w*(dl*4.0 + dr*(1.4+tval*.16) - al*loss_cost - ar*1.6 + (dr>0)*tval*.11)
            else:
                late=1 if self.turn>=10 else 0
                cheap=min((TYPE_VALUE.get(u.typ,4) for u in attackers if u.alive),default=5)
                armor_share=sum(u.typ in ARMOR_TYPES for u in attackers)/max(1,len(attackers))
                loss_cost=(3.5-0.35*late)+.28*cheap+1.4*armor_share
                util += w*(dl*(3.4+0.5*late)+dr*(1.0+tval*.09)-al*loss_cost-ar*1.4+(dr>0)*tval*.07)
        return util/36

    def target_value(self,side,p):
        terr=TERR[p];v=0
        if terr in ('city','outercity'):v+=5
        if terr=='maincity':v+=20
        if p in CORE:v+=30
        if p in RAIL_NODES:v+=2
        # rail junctions
        if len(RAIL_G.get(p,[]))>=3:v+=4
        if side=='G':v+=0.45*p[0]
        else:
            # counterattacks prize German armor, OOS units and railheads
            for g in self.at(p,'G'):
                v+=TYPE_VALUE.get(g.typ,4)*(1.5 if not g.supplied else 1)
            if p in self.railheads:v+=10
            v+=0.15*(32-p[0])
        return v

    def _candidate_subsets(self,units):
        # Compact V3 candidate search: strongest prefixes, origin groups, combined-arms/flank mixes.
        units=[u for u in units if u.alive and not u.fought and u.typ not in ('arty','hq') and u.A>0]
        if not units:return []
        cands=[];seen=set()
        def add(xs):
            ids=tuple(sorted(u.id for u in xs))
            if not ids or ids in seen:return
            seen.add(ids);cands.append(xs[:])
        # all and strongest prefixes
        ss=sorted(units,key=lambda u:(u.A if self.is_effectively_supplied(u) else math.ceil(u.A/2),TYPE_VALUE.get(u.typ,4)),reverse=True)
        add(ss)
        for k in range(1,min(6,len(ss))+1):add(ss[:k])
        # by origin directions and combinations of 2/3 directions
        groups=defaultdict(list)
        for u in units:groups[u.pos].append(u)
        gps=list(groups.values())
        for g in gps:add(g)
        import itertools
        for k in (2,3):
            for comb in itertools.combinations(gps,min(k,len(gps))):
                if len(comb)!=k:continue
                xs=[u for g in comb for u in g];add(xs)
                if len(cands)>=32:break
            if len(cands)>=32:break
        # explicit combined arms mixes
        arm=[u for u in units if u.typ in ARMOR_TYPES]; inf=[u for u in units if u.typ in INF_COORD_TYPES]
        if arm and inf:
            add([max(arm,key=lambda u:u.A),max(inf,key=lambda u:u.A)])
            add([max(arm,key=lambda u:u.A)]+sorted(inf,key=lambda u:u.A,reverse=True)[:2])
        return cands[:36]

    def combat_phase(self,side):
        if not self._is_v4(side): return super().combat_phase(side)
        # Focused iterative planning: fewer global rescans, but recalculate after each real result.
        for _ in range(12):
            plans=self.plan_battles(side)
            if not plans: break
            done=False
            for val,target,xs,_ in plans:
                xs=[u for u in xs if u.alive and not u.fought and u.pos in NBR[target]]
                if xs and self.at(target,self.enemy(side)):
                    self.resolve_battle(side,target,xs);done=True;break
            if not done: break

    def choose_attacker_command(self,side,target,attackers,basecalc):
        # Staff plan, if pre-declared and valid, consumes the battle's command slot automatically.
        sp=self.staff_plan.get(side)
        if sp and sp[0]==target:
            h=self.units.get(sp[1])
            if h and h.alive and h.supplied and sum(1 for u in attackers if hdist(u.pos,h.pos)<=3)>=2:
                return 'Staff Office Plan',sp[1]
        hqs=self.hq_in_range(side,target,True)
        if not hqs:return None,None
        # Evaluate available commands vs no command.
        options=[]
        if self.cp[side]>=2:options.append(('Force Attack',2))
        if self.cp[side]>=1 and basecalc['river_pen']>0:options.append(('Makeshift Bridges',1))
        if self.cp[side]>=1 and basecalc['a_art'] and (TERR[target] in ('city','maincity','outercity') or basecalc['ent']):options.append(('Siege Artillery',1))
        if not options:return None,None
        baseU=self._expected_utility(side,target,attackers,basecalc)
        best=(0,None,None)
        for cmd,cost in options:
            calc=self.combat_calc(side,target,attackers,att_cmd=cmd)
            u=self._expected_utility(side,target,attackers,calc,att_cmd=cmd)-0.35*cost
            # Capital/critical attacks are more willing to spend CP.
            bonus=0.9 if target in CORE else 0.25 if TERR[target] in ('city','outercity') else 0
            gain=u-baseU+bonus
            if gain>best[0]:best=(gain,cmd,cost)
        if best[1] and best[0]>0.35:
            h=min(hqs,key=lambda x:hdist(x.pos,target))
            return best[1],h.id
        return None,None

    def choose_defender_command(self,defside,target,attackers,calc):
        if self.cp[defside]<2:return None,None
        hs=self.hq_in_range(defside,target,True)
        if not hs:return None,None
        val=self.target_value(defside,target)
        # Estimate chance of retreat in current CRT.
        pret=0
        for roll,w in DICE_PROB.items():
            res=CRT[roll][calc['final_idx']]
            if RES_LOSS[res][3]>0:pret+=w/36
        if target in CORE:threshold=.12
        elif TERR[target] in ('city','outercity') or len(RAIL_G.get(target,[]))>=3:threshold=.33
        else:threshold=.53
        if pret>=threshold and val>=8:
            h=min(hs,key=lambda x:hdist(x.pos,target));return 'Last Stand',h.id
        return None,None

    def plan_battles(self,side):
        enemy=self.enemy(side); plans=[]
        targets=list({u.pos for u in self.us(enemy)})
        for target in targets:
            adj=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj:continue
            best=None
            for xs in self._candidate_subsets(adj)[:24]:
                calc=self.combat_calc(side,target,xs)
                if not calc:continue
                util=self._expected_utility(side,target,xs,calc)
                # Strategic value and late urgency.
                util += self.target_value(side,target)*(.05 if side=='G' else .025)
                if side=='G' and self.turn>=12:util+=0.35*self.target_value(side,target)
                if side=='S' and self.turn<8:util-=1.2
                if best is None or util>best[0]:best=(util,xs,calc)
            if best:
                threshold=1.45 if side=='G' else (2.2 if self.turn<10 else .8)
                if target in CORE and side=='G':threshold=-3.5
                # Do not burn German armor in low-odds solo attacks except at the final objective/last turns.
                xs=best[1];calc=best[2]
                armor_heavy=sum(u.typ=='panzer' for u in xs)>=1 and not any(u.typ in ('inf','jager','mot') for u in xs)
                if side=='G' and armor_heavy and calc['final_idx']<=3 and target not in CORE and self.turn<14:
                    continue
                if best[0]>=threshold:plans.append((best[0],target,best[1],best[2]))
        # highest value first, then recalc eligibility when executing
        plans.sort(reverse=True,key=lambda x:x[0])
        return plans

    def _snapshot_units(self,us):
        return [{'id':u.id,'typ':u.typ,'side':u.side,'pos':list(u.pos),'step':u.step,'alive':u.alive,'supplied':u.supplied,'entrenched':u.entrenched} for u in us]

    def apply_losses(self,units,n,owner_side):
        units=[u for u in units if u.alive]
        if n<=0 or not units:return
        # Fair multi-step distribution: every participant must take one before any second.
        rounds=0
        while n>0 and any(u.alive for u in units):
            alive=[u for u in units if u.alive]
            # Owner preserves high-value units; cheap/damaged units take losses first.
            alive.sort(key=lambda u:(TYPE_VALUE.get(u.typ,4)+3*(u.typ in ARMOR_TYPES), -u.step))
            for u in alive:
                if n<=0:break
                u.step+=1;n-=1
                if u.step>=u.max_steps:
                    u.alive=False;u.entrenched=False;self._invalidate_pos()
                    self.events.append({'type':'destroyed','unit':u.id})
            rounds+=1
            if rounds>4:break

    def retreat_unit(self,u,steps,away_side):
        # Retreat away from attacker orientation; enemy ZOC illegal.
        side=u.side; ez=self.enemy_zoc(side)
        for _ in range(steps):
            cand=[]
            for q in NBR[u.pos]:
                if self.occupied(q,self.enemy(side)) or q in ez:continue
                if not self._can_stack(side,u.typ,q,u.id):continue
                progress=(-q[0] if side=='G' else q[0]) # G retreats west (smaller col); S east (larger)
                supply=2 if self._supply_if_at(u,q) else 0
                terr=1 if TERR[q] in ('forest','hill','city','maincity','outercity') else 0
                cand.append((progress+supply+terr+self.rng.random()*.2,q))
            if not cand:return False
            old=u.pos;self._set_pos(u,max(cand)[1]);u.moved=True;u.entrenched=False
            self.events.append({'type':'retreat','unit':u.id,'from':hexname(old),'to':hexname(u.pos)})
        return True

    def _advance_after(self,side,target,attackers,result):
        # One surviving attacker may enter vacated target.
        if self.occupied(target,self.enemy(side)):return None
        surv=[u for u in attackers if u.alive and self._can_stack(side,u.typ,target,u.id)]
        if not surv:return None
        # Prefer supplied armor, then motorized, then strongest.
        surv.sort(key=lambda u:(self.is_effectively_supplied(u),u.typ in ARMOR_TYPES,u.typ=='mot',u.A),reverse=True)
        u=surv[0];old=u.pos;self._set_pos(u,target);u.moved=True
        self.events.append({'type':'advance','unit':u.id,'from':hexname(old),'to':hexname(target)})
        return u

    def _breakthrough(self,side,target,attackers,result,advanced):
        if result not in ('D1R','D2R','D3R') or TERR[target]=='marsh':return None
        # Panzer/tank/heavy can exploit; German Schwerpunkt specifically needs panzer.
        cand=[u for u in attackers if u.alive and u.typ in ARMOR_TYPES and self.is_effectively_supplied(u)]
        if not cand:return None
        # Prefer the unit that advanced; otherwise move one armor into target if legal.
        cand.sort(key=lambda u:(u.typ=='panzer',u.step<=1,u.A),reverse=True)
        u=advanced if advanced in cand else cand[0]
        if u.pos!=target and self._can_stack(side,u.typ,target,u.id):self._set_pos(u,target)
        extra=2 if u.step<=1 else 1
        # Greedy exploitation toward side objective while respecting ZOC and stacking.
        for _ in range(extra):
            ez=self.enemy_zoc(side); opts=[]
            for q in NBR[u.pos]:
                if self.occupied(q,self.enemy(side)) or not self._can_stack(side,u.typ,q,u.id):continue
                if TERR[q]=='marsh':continue
                sc=(q[0] if side=='G' else -q[0])
                if side=='G':sc-=0.7*min(hdist(q,c) for c in CORE)
                else:
                    # Soviet exploitation attacks exposed railheads / westward space.
                    if q in self.railheads:sc+=10
                opts.append((sc+self.rng.random()*.2,q))
            if not opts:break
            old=u.pos;self._set_pos(u,max(opts)[1]);u.moved=True
            self.events.append({'type':'breakthrough','unit':u.id,'from':hexname(old),'to':hexname(u.pos)})
            if u.pos in ez:break
        return u

    def resolve_battle(self,side,target,attackers,second_attack=False):
        enemy=self.enemy(side);attackers=[u for u in attackers if u.alive and not (u.fought and not second_attack)]
        if not attackers or not self.at(target,enemy):return None
        basecalc=self.combat_calc(side,target,attackers,second_attack=second_attack)
        att_cmd,hqid=self.choose_attacker_command(side,target,attackers,basecalc) if not second_attack else (None,None)
        if att_cmd:
            h=self.units[hqid];cost=2 if att_cmd=='Force Attack' else 1
            # Staff plan was already spent at start; do not spend again.
            if att_cmd!='Staff Office Plan':
                if not self.use_hq(side,h,att_cmd,cost,target=target):att_cmd=None
        calc=self.combat_calc(side,target,attackers,att_cmd=att_cmd,second_attack=second_attack)
        def_cmd,dhqid=self.choose_defender_command(enemy,target,attackers,calc)
        if def_cmd:
            h=self.units[dhqid]
            if not self.use_hq(enemy,h,'Last Stand',2,target=target):def_cmd=None
            calc=self.combat_calc(side,target,attackers,att_cmd=att_cmd,def_cmd=def_cmd,second_attack=second_attack)
        defenders=self.at(target,enemy)
        beforeA=self._snapshot_units(attackers);beforeD=self._snapshot_units(defenders)
        roll=self.rng.randint(1,6)+self.rng.randint(1,6);res=CRT[roll][calc['final_idx']]
        al,dl,ar,dr=RES_LOSS[res]
        if att_cmd=='Force Attack' and ar:al+=1;ar=0
        if def_cmd=='Last Stand' and dr:dl+=1;dr=0
        self.apply_losses(attackers,al,side);self.apply_losses(defenders,dl,enemy)
        # Retreat all surviving participants if required; if any has no legal retreat, +1 step max for side.
        if ar:
            failed=False
            for u in [x for x in attackers if x.alive]:
                if not self.retreat_unit(u,ar,enemy):failed=True
            if failed:self.apply_losses([u for u in attackers if u.alive],1,side)
        if dr:
            failed=False
            for u in [x for x in defenders if x.alive]:
                if not self.retreat_unit(u,dr,side):failed=True
            if failed:self.apply_losses([u for u in defenders if u.alive],1,enemy)
        # Mark fought.
        for u in attackers:
            if u.alive:u.fought=True
        advanced=None;breaker=None
        if dr and not self.occupied(target,enemy):
            advanced=self._advance_after(side,target,attackers,res)
            breaker=self._breakthrough(side,target,attackers,res,advanced)
        self._update_controls()
        afterA=self._snapshot_units(attackers);afterD=self._snapshot_units([u for u in defenders])
        rec=BattleRecord(side,target,hexname(target),calc['terr'],[{'id':u.id,'from':list(next((tuple(x['pos']) for x in beforeA if x['id']==u.id),u.pos))} for u in attackers],
                         [{'id':u.id,'pos':list(target)} for u in defenders],COLS_CRT[calc['base_idx']],COLS_CRT[calc['final_idx']],calc['shifts'],roll,res,
                         att_cmd,def_cmd,calc['a_art'].id if calc['a_art'] else None,calc['d_art'].id if calc['d_art'] else None,beforeA,beforeD,afterA,afterD,second_attack)
        self.battles.append(rec)
        if target in CORE:self.metrics['capital_battles']+=1
        if side=='S' and self.turn>=10:self.metrics['soviet_attacks_t10plus']+=1
        # Schwerpunkt: once/G turn, supplied full/one-step Panzer, D2R/D3R, completed breakthrough.
        if side=='G' and not second_attack and not self.schwerpunkt_used and res in ('D2R','D3R') and breaker and breaker.typ=='panzer' and breaker.step<=1 and self.is_effectively_supplied(breaker):
            # choose best adjacent Soviet target and attack immediately with this Panzer + any unfought co-located allies if legal.
            tgts=[e.pos for e in self.us('S') if e.pos in NBR[breaker.pos]]
            best=None
            for t in tgts:
                xs=[breaker]+[u for u in self.at(breaker.pos,'G') if u.id!=breaker.id and not u.fought and u.typ not in ('arty','hq')]
                c=self.combat_calc('G',t,xs,second_attack=True)
                if not c:continue
                val=self._expected_utility('G',t,xs,c)+self.target_value('G',t)*.1
                if best is None or val>best[0]:best=(val,t,xs)
            if best and best[0]>0:
                self.schwerpunkt_used=True
                self.events.append({'type':'schwerpunkt','unit':breaker.id,'target':hexname(best[1])})
                # Allow breaker second attack despite fought flag by temporarily clear.
                oldf=breaker.fought;breaker.fought=False
                self.resolve_battle('G',best[1],best[2],second_attack=True)
                breaker.fought=True
        return rec

    def combat_phase(self,side):
        # Iterative re-planning improves reaction after retreats/breakthroughs.
        for _ in range(18):
            plans=self.plan_battles(side)
            if not plans:break
            done=False
            for val,target,xs,_ in plans:
                xs=[u for u in xs if u.alive and not u.fought and u.pos in NBR[target]]
                if xs and self.at(target,self.enemy(side)):
                    self.resolve_battle(side,target,xs);done=True;break
            if not done:break

    # ---------- Reinforcement / RP / Entrench ----------
    def valid_east_exits(self):
        active=self._soviet_active_rail();gz=self.enemy_zoc('S')
        return [e for e in EAST_EXITS if e in active and not self.occupied(e,'G') and e not in gz]

    def add_reinforcements(self):
        incoming=[]
        if self.turn in REINFORCEMENTS:incoming+=REINFORCEMENTS[self.turn]
        incoming=self.delayed_reinf+incoming;self.delayed_reinf=[]
        if not incoming:return
        valid=self.valid_east_exits(); entered=[]
        for typ in incoming:
            choices=[]
            for e in valid:
                if not self._can_stack('S',typ,e,None):continue
                # choose threatened sector / shortest to useful front.
                sec=0 if e[1]<=7 else 1 if e[1]<=13 else 2
                gfront=self._front_col('G',sec)
                threat=gfront + (4 if sec==1 else 0)
                score=threat - .15*hdist(e,min(CORE,key=lambda c:hdist(e,c)))+self.rng.random()
                choices.append((score,e,sec))
            if not choices:
                self.delayed_reinf.append(typ);self.metrics['s_reinforcements_delayed']+=1;continue
            _,e,sec=max(choices)
            prefix={'inf':'I','at':'AT','mot':'M','tank':'T','elite':'EL'}[typ]
            n=1
            while f'S-R-{prefix}{n}' in self.units:n+=1
            uid=f'S-R-{prefix}{n}';u=Unit(uid,'S',typ,e,sector=sec);self.units[uid]=u;self._invalidate_pos();entered.append(uid);self.metrics['s_reinforcements_entered']+=1
        if entered:self.events.append({'type':'reinforcements','units':entered,'delayed':len(self.delayed_reinf)})

    def recovery_bases(self,side):
        if side=='G':return self._german_sources()
        active=self._soviet_active_rail();bases=[p for p in active if p in CITY_NODES and self.city_control.get(p)=='S']
        capital_function=all(self.city_control.get(p)!='G' for p in CORE|OUTER)
        if not capital_function:bases=[p for p in bases if p not in CORE|OUTER]
        return bases

    def recovery_phase(self,side):
        maxn=1 if side=='G' else (1 if self.turn<=4 else 2 if self.turn<=9 else 3)
        bases=self.recovery_bases(side);enemy=self.enemy(side)
        cand=[]
        for u in self.us(side):
            if u.step<=0 or not u.supplied or u.moved or u.fought:continue
            if any(e.pos in NBR[u.pos] for e in self.us(enemy)):continue
            if not any(hdist(u.pos,b)<=2 for b in bases):continue
            cost=2 if u.typ in ('panzer','tank','heavy','mot','arty') else 1
            if self.rp[side]<cost:continue
            value=TYPE_VALUE.get(u.typ,4)+u.step*1.5
            cand.append((value,u,cost))
        cand.sort(reverse=True,key=lambda x:x[0]);restored=[]
        for _,u,cost in cand[:maxn]:
            if self.rp[side]<cost:continue
            self.rp[side]-=cost;u.step-=1;restored.append(u.id)
        if restored:self.events.append({'type':'recovery','side':side,'units':restored,'rp_left':self.rp[side]})

    def entrench_phase(self,side):
        for u in self.us(side):
            if u.typ in ENTRENCH_TYPES and not u.moved and u.pos not in CORE:
                u.entrenched=True

    def reset_turn_flags(self,side):
        for u in self.us(side):
            u.moved=False;u.fought=False;u.temp_supply=False;u.dedicated_repair=False

    # ---------- Victory / frames ----------
    def german_victory_condition(self):
        for p in CORE:
            gs=self.at(p,'G')
            if self.at(p,'S') or not any(u.typ not in ('recon','arty','eng','hq') for u in gs):return False
        # at least one occupying German is currently supplied under live network
        old={u.id:u.supplied for u in self.us('G')};self._compute_supply('G')
        ok=any(u.supplied for p in CORE for u in self.at(p,'G'))
        for u in self.us('G'):u.supplied=old.get(u.id,u.supplied)
        return ok

    def _snapshot(self,phase):
        if not self.record:return
        fr={
          'turn':self.turn,'phase':phase,'g_rp':self.rp['G'],'s_rp':self.rp['S'],'g_cp':self.cp['G'],'s_cp':self.cp['S'],
          'railheads':[list(x) for x in self.railheads],'repaired':[list(x) for x in self.repaired],
          'events':self.events[:], 'battles':[battle_to_dict(b) for b in self.battles],
          'units':{u.id:{'p':list(u.pos),'side':u.side,'typ':u.typ,'step':u.step,'alive':u.alive,'sup':u.supplied,'ent':u.entrenched} for u in self.units.values()}
        }
        self.frames.append(fr)

    def play(self):
        for t in range(1,17):
            self.turn=t
            # German player turn
            self.phase='German';self.events=[];self.battles=[];self.schwerpunkt_used=False
            self.reset_turn_flags('G');self._compute_supply('G');self._compute_supply('S')
            self.metrics['g_oos_turns'].append(sum(not u.supplied for u in self.us('G')))
            self._prepare_hq_turn('G')
            self.repair_rail()  # supply already checked; repairs help next turn
            self._build_supply_env('G')  # planning looks at next-turn logistics, current unit supply remains fixed
            self.movement_phase('G');self.combat_phase('G');self.recovery_phase('G');self.entrench_phase('G')
            self._update_controls();self.metrics['g_max_col']=max(self.metrics['g_max_col'],max((u.pos[0] for u in self.us('G')),default=3))
            self._snapshot('German')
            if t==16 and self.german_victory_condition():
                self.winner='German';self.win_turn=t;break
            # Soviet player turn
            self.phase='Soviet';self.events=[];self.battles=[]
            self.reset_turn_flags('S');self.add_reinforcements();self._compute_supply('G');self._compute_supply('S')
            self.metrics['s_oos_turns'].append(sum(not u.supplied for u in self.us('S')))
            self._prepare_hq_turn('S')
            self.movement_phase('S');self.combat_phase('S');self.recovery_phase('S');self.entrench_phase('S')
            self._update_controls();self._snapshot('Soviet')
            if self.german_victory_condition():
                self.winner='German';self.win_turn=t;break
        if not self.winner:self.winner='Soviet';self.win_turn=16
        return self.summary()

    def summary(self):
        aliveG=sum(u.alive for u in self.units.values() if u.side=='G');aliveS=sum(u.alive for u in self.units.values() if u.side=='S')
        cores=sum(bool(self.at(p,'G')) and not self.at(p,'S') for p in CORE)
        return {
          'seed':self.seed,'winner':self.winner,'win_turn':self.win_turn,'alive_G':aliveG,'alive_S':aliveS,'cores_G':cores,
          'g_rp':self.rp['G'],'s_rp':self.rp['S'],'g_cp':self.cp['G'],'s_cp':self.cp['S'],
          'g_max_col':self.metrics['g_max_col'],'capital_battles':self.metrics['capital_battles'],
          'soviet_attacks_t10plus':self.metrics['soviet_attacks_t10plus'],
          'avg_g_oos':statistics.mean(self.metrics['g_oos_turns']) if self.metrics['g_oos_turns'] else 0,
          'avg_s_oos':statistics.mean(self.metrics['s_oos_turns']) if self.metrics['s_oos_turns'] else 0,
          'avg_rail_repair':statistics.mean(self.metrics['rail_repaired_per_turn']) if self.metrics['rail_repaired_per_turn'] else 0,
          'reinforcements_entered':self.metrics['s_reinforcements_entered'],'reinforcements_delayed':self.metrics['s_reinforcements_delayed'],
          'hq_G':dict(self.metrics['hq_commands_G']),'hq_S':dict(self.metrics['hq_commands_S'])
        }

# Helpers
def hexname(p):
    c,r=p; s='';n=c
    while n:
        n-=1;s=chr(65+n%26)+s;n//=26
    return s+str(r)

def battle_to_dict(b:BattleRecord):
    d=asdict(b);d['target']=list(b.target);return d

def map_for_replay():
    return {'rows':ROWS,'cols':COLS,'terrain':{f'{p[0]},{p[1]}':t for p,t in TERR.items()},'roads':MAP['roads'],'rails':MAP['rails'],'rivers':MAP['rivers'],'main_city':[list(x) for x in CORE],'outer_city':[list(x) for x in OUTER]}

def run_batch(n=64,seed0=1000):
    rows=[]
    for i in range(n):
        g=Game(seed0+i,record=False);rows.append(g.play())
    return rows



# ============================================================
# V4 Hybrid Wargame AI
# Hierarchical operational planning + stochastic macro rollouts
# + battle counterfactual evaluation.  The rules engine is the
# same as V3.2; only decision quality changes.
# ============================================================
import copy

class V4Game(Game):
    """Full-rules game with a hierarchical hybrid wargame AI.

    ai_by_side: {'G':'v4'|'v3', 'S':'v4'|'v3'} lets us run
    controlled head-to-head experiments against the V3.2 policy.
    """
    G_PLANS=(
        {'name':'平衡推进','focus':None,'aggr':1.00,'logi':1.00,'reserve':1.00},
        {'name':'北线主攻','focus':0,'aggr':1.12,'logi':1.05,'reserve':.88},
        {'name':'中央突破','focus':1,'aggr':1.18,'logi':1.08,'reserve':.84},
        {'name':'南线主攻','focus':2,'aggr':1.12,'logi':1.05,'reserve':.88},
        {'name':'整顿补给','focus':None,'aggr':.78,'logi':1.45,'reserve':1.18},
        {'name':'主城冲刺','focus':1,'aggr':1.42,'logi':1.08,'reserve':.58},
    )
    S_PLANS=(
        {'name':'纵深迟滞','focus':None,'defense':1.05,'counter':.76,'reserve':1.08},
        {'name':'北线加固','focus':0,'defense':1.18,'counter':.74,'reserve':1.00},
        {'name':'中央加固','focus':1,'defense':1.22,'counter':.72,'reserve':1.00},
        {'name':'南线加固','focus':2,'defense':1.18,'counter':.74,'reserve':1.00},
        {'name':'机动预备队','focus':None,'defense':.96,'counter':1.35,'reserve':1.42},
        {'name':'首都防御','focus':1,'defense':1.38,'counter':.88,'reserve':1.18},
    )

    def __init__(self, seed=1, record=False, ai_by_side=None):
        super().__init__(seed=seed, record=record, ai_level='v4')
        self.ai_by_side=ai_by_side or {'G':'v4','S':'v4'}
        self.op_plan={'G':None,'S':None}
        self.plan_history={'G':Counter(),'S':Counter()}
        self.plan_scores={'G':{},'S':{}}
        self._planning_rng=random.Random(seed*7919+104729)

    def _is_v4(self,side):
        return self.ai_by_side.get(side,'v4')=='v4'

    # ---------- Operational situation model ----------
    def _sector_units(self,side,sec,include_support=False):
        us=[u for u in self.us(side) if u.sector==sec and (include_support or u.typ not in ('arty','hq'))]
        return us

    def _sector_power(self,side,sec,attack=True):
        val=0.0
        for u in self._sector_units(side,sec,True):
            if u.typ=='hq': continue
            if u.typ=='arty':
                # artillery contributes operationally but less than direct strength
                val += (2.2 if u.supplied and u.step<2 else .4)
                continue
            s=(u.A if attack else u.D)
            if attack and not u.supplied: s=math.ceil(s/2)
            # wounded formations still matter, but damaged mobile units are precious
            qual=1.0-.10*u.step
            if u.typ in ARMOR_TYPES: qual+=.10
            val += max(.2,s*qual)
        return val

    def _sector_supply_ratio(self,side,sec):
        us=[u for u in self._sector_units(side,sec,True) if u.typ!='hq']
        if not us:return 1.0
        return sum(1 for u in us if self.is_effectively_supplied(u))/len(us)

    def _rail_front_by_line(self,sec):
        conn=self._connected_repaired()
        xs=[p[0] for p in conn if RAIL_LINE.get(p)==sec]
        return max(xs,default=1)

    def _sector_front(self,side,sec):
        vals=[u.pos[0] for u in self._sector_units(side,sec) if u.alive]
        if not vals:return 3 if side=='G' else 30
        # use an 80th/20th percentile-ish robust front instead of a lone recon
        vals=sorted(vals)
        if side=='G': return vals[max(0,int(.78*(len(vals)-1)))]
        return vals[min(len(vals)-1,int(.22*(len(vals)-1)))]

    def _macro_rollout(self,side,plan,rollouts=10,horizon=2):
        """Cheap stochastic operational rollout.

        This is intentionally coarse: it projects sector fronts, force ratios,
        supply lag and reserve effects for a few future player-turns.  It is
        fast enough to run every turn, unlike cloning the entire hex engine.
        """
        vals=[]
        # Seed independently so planning does not consume combat dice RNG.
        salt=(self.seed*1000003 + self.turn*9176 + (0 if side=='G' else 1)*31337 + sum(ord(x) for x in plan['name']))
        prng=random.Random(salt)
        for rr in range(rollouts):
            gf=[float(self._sector_front('G',s)) for s in range(3)]
            sf=[float(self._sector_front('S',s)) for s in range(3)]
            rail=[float(self._rail_front_by_line(s)) for s in range(3)]
            gp=[self._sector_power('G',s,True) for s in range(3)]
            sp=[self._sector_power('S',s,False) for s in range(3)]
            gsup=[self._sector_supply_ratio('G',s) for s in range(3)]
            ssup=[self._sector_supply_ratio('S',s) for s in range(3)]
            g_loss=s_loss=0.0
            for h in range(horizon):
                tt=min(16,self.turn+h)
                # Coarse German rail growth under a 4/5 repair rule.
                total=5 if any(u.typ=='eng' and u.supplied for u in self.us('G')) else 4
                alloc=[1,1,1]
                extra=max(0,total-3)
                gfocus=plan.get('focus') if side=='G' else None
                # When projecting Soviet plans, assume baseline German focus follows the weakest Soviet sector.
                if side=='S':
                    gfocus=max(range(3),key=lambda s:(gp[s]*gsup[s])/(sp[s]+2))
                for _ in range(extra):
                    opts=range(3)
                    pick=max(opts,key=lambda s:((2.0 if s==gfocus else 0)+max(0,gf[s]-rail[s])-.35*alloc[s]+prng.random()*.15))
                    alloc[pick]+=1
                for s in range(3): rail[s]+=min(alloc[s],3)

                for s in range(3):
                    focusG=1.0
                    focusS=1.0
                    if side=='G':
                        focusG=(1.18 if plan.get('focus')==s else .98) * plan.get('aggr',1)
                        logi=plan.get('logi',1)
                    else:
                        focusS=(1.18 if plan.get('focus')==s else .99)*plan.get('defense',1)
                        logi=1.0
                    # Soviet plans change reserve allocation / counterpressure.
                    if side=='S' and plan['name']=='机动预备队' and tt>=10:
                        focusS*=1.03
                    # Supply falls rapidly if robust front outruns rail umbrella.
                    lag=max(0,gf[s]-rail[s])
                    projected_gsup=max(.28,min(1.0,gsup[s]+.10*logi-.055*lag))
                    projected_ssup=max(.45,ssup[s])
                    ga=gp[s]*projected_gsup*focusG
                    sd=sp[s]*projected_ssup*focusS
                    # terrain/defense noise and battle friction
                    friction=prng.gauss(0,2.4)
                    margin=(ga-sd+friction)/(7.5+sd*.16)
                    p_push=1/(1+math.exp(-margin))
                    # Strategic tempo: early German edge, late Soviet density.
                    p_push += .07 if tt<=6 else -.02 if tt>=12 else 0
                    p_push=max(.06,min(.92,p_push))
                    r=prng.random()
                    step=2 if r<p_push*.22 else 1 if r<p_push else 0
                    # supply caps exploitation; this is where logistics plans pay off
                    if projected_gsup<.55: step=min(step,1)
                    gf[s]=min(30.0,gf[s]+step)
                    # Soviet defense front bends eastward with German progress
                    sf[s]=max(gf[s]+1,min(30.0,sf[s]+(1 if step>=1 and prng.random()<.72 else 0)))
                    # coarse attrition
                    if step:
                        s_loss += max(.1,(ga/(sd+1))*.25)
                        g_loss += max(.08,(sd/(ga+1))*.18)
                    else:
                        g_loss += max(.06,(sd/(ga+1))*.12)
                    # late Soviet mobile counterattack can claw one column from exposed sectors, no special combat bonus
                    if tt>=10:
                        counter=1.0 if side=='G' else plan.get('counter',1)
                        if prng.random() < .10*counter*(1.15-projected_gsup):
                            gf[s]=max(3,gf[s]-1)
                    gsup[s]=projected_gsup

            # Common board value, signed from requested side.
            core_pressure=sum(max(0,30-gf[s]) for s in range(3))
            central=gf[1]
            progress=sum(gf)
            cohesion=-2.0*(max(gf)-min(gf))
            if side=='G':
                val=2.2*progress + 3.4*central + cohesion - 13*sum(max(0,.60-x) for x in gsup) + 3.0*s_loss-3.6*g_loss
                if self.turn>=10: val += 5.5*central - 1.0*core_pressure
                if plan['name']=='主城冲刺' and self.turn<9: val-=18
                if plan['name']=='整顿补给' and max(self._sector_front('G',s)-self._rail_front_by_line(s) for s in range(3))<3: val-=8
            else:
                # Soviet utility rewards keeping German robust front west, preserving force and capital depth.
                val= -2.1*progress -4.1*central - .7*cohesion + 4.0*g_loss-3.0*s_loss
                if self.turn>=10: val += -5.2*central
                if plan['name']=='首都防御' and self.turn<9: val-=12
                if plan['name']=='机动预备队' and self.turn<8: val-=7
            vals.append(val)
        return statistics.mean(vals)

    def _select_operational_plan(self,side):
        if not self._is_v4(side):
            self.op_plan[side]=None;return None
        plans=self.G_PLANS if side=='G' else self.S_PLANS
        scored=[]
        for p in plans:
            # prune obviously premature late-game plans
            if side=='G' and p['name']=='主城冲刺' and self.turn<8:continue
            if side=='S' and p['name']=='首都防御' and self.turn<8:continue
            sc=self._macro_rollout(side,p)
            scored.append((sc,p))
        scored.sort(reverse=True,key=lambda x:x[0])
        # tiny controlled exploration among near-equal top plans to avoid scripted replays
        bestsc,best=scored[0]
        near=[x for x in scored if bestsc-x[0]<1.25]
        if len(near)>1 and self._planning_rng.random()<.16:
            bestsc,best=self._planning_rng.choice(near[:3])
        self.op_plan[side]=dict(best)
        self.plan_history[side][best['name']]+=1
        self.plan_scores[side]={p['name']:round(sc,2) for sc,p in scored}
        self.events.append({'type':'operational_plan','side':side,'plan':best['name'],'score':round(bestsc,2),'top':[(p['name'],round(sc,1)) for sc,p in scored[:3]]})
        return best

    # ---------- HQ: preserve CP for decisive moments ----------
    def _prepare_hq_turn(self,side):
        if not self._is_v4(side):
            return super()._prepare_hq_turn(side)
        self.cp[side]=min(3,self.cp[side]+1);self.staff_plan[side]=None
        self._select_operational_plan(side)
        plan=self.op_plan[side] or {}
        # Extra Supplies only on genuinely valuable stranded groups.
        if self.cp[side]>=2:
            best=None
            for h in self.hqs(side,True):
                us=[u for u in self.us(side) if not u.supplied and hdist(u.pos,h.pos)<=3 and u.typ!='hq']
                us.sort(key=lambda u:(TYPE_VALUE.get(u.typ,4)+(5 if u.typ in ARMOR_TYPES else 0)+(2 if u.typ=='arty' else 0)),reverse=True)
                chosen=us[:3]; value=sum(TYPE_VALUE.get(u.typ,4)+(3 if u.typ in ARMOR_TYPES else 0) for u in chosen)
                # German logistics doctrine is willing to spend; otherwise save CP unless a high-value group is stranded.
                threshold=13 if plan.get('name')=='整顿补给' else 17
                if chosen and value>=threshold and (best is None or value>best[0]):best=(value,h,chosen)
            if best:
                _,h,chosen=best
                if self.use_hq(side,h,'Extra Supplies',2,extra=[u.id for u in chosen]):
                    for u in chosen:u.temp_supply=True
        # Staff Plan only if an actual high-value attack is likely and spending 1 CP won't block critical Last Stand/Force Attack.
        if self.cp[side]>=1:
            enemy=self.enemy(side);best=None
            for p in {u.pos for u in self.us(enemy)}:
                hs=self.hq_in_range(side,p,True)
                if not hs:continue
                adj=[u for u in self.us(side) if u.typ not in ('arty','hq') and u.pos in NBR[p] and self.is_effectively_supplied(u)]
                if len(adj)<2:continue
                tv=self.target_value(side,p)
                raw=sum(u.A for u in adj)
                urgency=(10 if p in CORE else 4 if TERR[p] in ('city','outercity') else 0)
                val=tv+.18*raw+urgency
                if best is None or val>best[0]:best=(val,p,hs)
            # Save 2CP on Soviet side if capital is under immediate threat; save German CP before late capital assault unless target is good.
            save=(side=='S' and self.turn>=11 and any(hdist(g.pos,c)<=4 for g in self.us('G') for c in CORE))
            threshold=18 if save else 14.5
            if best and best[0]>=threshold and (self.cp[side]>=3 or not save):
                _,p,hs=best;h=min(hs,key=lambda x:hdist(x.pos,p))
                if self.use_hq(side,h,'Staff Office Plan',1,target=p):self.staff_plan[side]=(p,h.id)

    # ---------- Rail allocation follows the chosen operational plan ----------
    def repair_rail(self):
        if not self._is_v4('G'):
            return super().repair_rail()
        conn=self._connected_repaired();engs=self._engineer_bonus_available();bonus=bool(engs);total=5 if bonus else 4
        focus=(self.op_plan.get('G') or {}).get('focus')
        planname=(self.op_plan.get('G') or {}).get('name','')
        line_cap=[2,2,2]
        if engs:
            # Put the 3-hex privilege on focus if possible; otherwise on greatest lag.
            lags=[self._sector_front('G',s)-self._rail_front_by_line(s) for s in range(3)]
            preferred=focus if focus is not None else max(range(3),key=lambda s:lags[s])
            eligible=[e for e in engs if (0 if e.pos[1]<=7 else 1 if e.pos[1]<=13 else 2)==preferred]
            e=(eligible[0] if eligible else max(engs,key=lambda x:lags[0 if x.pos[1]<=7 else 1 if x.pos[1]<=13 else 2]))
            e.dedicated_repair=True
            line=0 if e.pos[1]<=7 else 1 if e.pos[1]<=13 else 2
            line_cap[line]=3
        used=[0,0,0];added=[]
        for _ in range(total):
            conn=self._connected_repaired();cands=[];occS={u.pos for u in self.us('S')}
            for a in conn:
                for v in RAIL_G.get(a,[]):
                    if v in self.repaired or v in occS:continue
                    ln=RAIL_LINE.get(v,1)
                    if used[ln]>=line_cap[ln]:continue
                    if v in CITY_NODES and self.city_control.get(v)=='S':continue
                    friendly=[x for x in self.us('G') if x.sector==ln]
                    demand=sum(max(0,6-hdist(v,x.pos)) for x in friendly)
                    lag=max(0,self._sector_front('G',ln)-self._rail_front_by_line(ln))
                    zpen=7 if v in self.enemy_zoc('G') else 0
                    focus_bonus=(7.5 if focus==ln else 0)
                    # logistics doctrine repairs the greatest lag; capital rush favors center.
                    doctrine=(3.2*lag if planname=='整顿补给' else 4.0 if planname=='主城冲刺' and ln==1 else 0)
                    sc=2.0*v[0]+.72*demand+1.05*lag+focus_bonus+doctrine-zpen+self._planning_rng.random()*.12
                    cands.append((sc,v,ln))
            if not cands:break
            _,v,ln=max(cands);self.repaired.add(v);used[ln]+=1;added.append(v)
        self._choose_railheads();self.metrics['rail_repaired_per_turn'].append(len(added))
        if added:self.events.append({'type':'rail_repair','hexes':[hexname(x) for x in added],'count':len(added),'engineer_bonus':bonus,'allocation':used})
        return added

    # ---------- Plan-aware movement ----------
    def _strategic_score(self,u,p):
        score=super()._strategic_score(u,p)
        if not self._is_v4(u.side):return score
        plan=self.op_plan.get(u.side) or {}
        focus=plan.get('focus')
        sec=u.sector
        enemy=self.enemy(u.side)
        if u.side=='G':
            # Operational concentration: combat formations in focus sector are rewarded for useful eastward pressure.
            if focus is not None:
                if sec==focus:
                    score += .75*max(0,p[0]-u.pos[0])
                    if u.typ in ('panzer','mot','inf','jager'):score+=1.8
                elif u.typ in ('panzer','mot') and self.turn<11:
                    score-=1.3*max(0,p[0]-self._sector_front('G',sec))
            if plan.get('name')=='整顿补给':
                score += 7.0 if self._supply_if_at(u,p) else -10.0
                if u.typ in ('panzer','mot'):score-=.45*max(0,p[0]-self._rail_front_by_line(sec)-5)
            elif plan.get('name')=='主城冲刺':
                score-=1.00*min(hdist(p,c) for c in CORE)
                if u.typ in ('panzer','mot','inf','jager'):score+=.70*max(0,p[0]-u.pos[0])
            # Hard logistics discipline: operational concentration must never override supply.
            psup=self._supply_if_at(u,p) or u.temp_supply
            if not psup:
                score-=14.0 if u.typ in ('panzer','mot','arty') else 8.5
                if u.supplied: score-=4.0  # do not voluntarily step out of the umbrella
            elif u.typ in ('panzer','mot'):
                score+=2.2
            # Counterfactual exposure penalty: avoid ending next to several enemies without friendly support.
            en=sum(1 for e in self.us(enemy) if hdist(p,e.pos)<=1)
            fr=sum(1 for f in self.us('G') if f.id!=u.id and f.typ not in ('arty','hq') and hdist(p,f.pos)<=1)
            if en>=2 and fr==0:score-=5.0 if u.typ in ('panzer','mot') else 2.5
        else:
            name=plan.get('name','')
            if focus is not None and sec==focus:score+=2.4
            if name=='首都防御':score-=1.2*min(hdist(p,c) for c in CORE)
            if name=='机动预备队' and u.typ in ('tank','mot','heavy'):
                # Hold one layer behind threatened Germans, but move toward OOS/armor targets from T10.
                vulnerable=[g for g in self.us('G') if (not g.supplied or g.typ in ('panzer','mot'))]
                if vulnerable:
                    d=min(hdist(p,g.pos) for g in vulnerable);score-=.85*d
                if any(hdist(p,g.pos)<=1 for g in self.us('G')) and self.turn<10:score-=2.5
            # Preserve critical rail connectivity / junctions.
            if p in RAIL_NODES and len(RAIL_G.get(p,[]))>=3:score+=2.2
        return score

    def movement_phase(self,side):
        if not self._is_v4(side):return super().movement_phase(side)
        if side=='G':order={'inf':1,'jager':1,'mot':2,'panzer':2,'recon':3,'eng':4,'arty':5,'hq':6}
        else:order={'inf':1,'elite':1,'at':1,'eng':2,'tank':3,'heavy':3,'mot':3,'arty':5,'hq':6}
        focus=(self.op_plan.get(side) or {}).get('focus')
        us=sorted(self.us(side),key=lambda u:(0 if focus is not None and u.sector==focus else 1,order.get(u.typ,4),u.sector,self._planning_rng.random()))
        for u in us:self.move_unit(u)
        self._update_controls()

    # ---------- Tactical rollout value ----------
    def _battle_rollout_bonus(self,side,target,xs,calc):
        pret=pbreak=edloss=aloss=0.0
        for roll,w in DICE_PROB.items():
            res=CRT[roll][calc['final_idx']];al,dl,ar,dr=RES_LOSS[res]
            pret+=w/36*(1 if dr else 0);pbreak+=w/36*(1 if res in ('D1R','D2R','D3R') else 0)
            edloss+=w/36*dl;aloss+=w/36*al
        tv=self.target_value(side,target);bonus=pret*tv*.12+pbreak*tv*.08
        # Future position / exposure, a cheap one-ply counterfactual.
        if side=='G':
            if pbreak and any(u.typ=='panzer' and self.is_effectively_supplied(u) for u in xs):
                bonus+=pbreak*2.3
            if not any(self._supply_if_at(u,target) or u.temp_supply for u in xs):bonus-=2.2*pret
            en=sum(1 for e in self.us('S') if hdist(target,e.pos)<=1)
            bonus-=.35*en*pret
            plan=self.op_plan.get('G') or {}
            if plan.get('focus') is not None and xs and xs[0].sector==plan['focus']:bonus+=1.0
            if target in CORE:bonus+=4.0+1.5*self.turn/16
        else:
            # Late Soviet attacks prefer exposed German spearheads / railheads rather than low-value attrition.
            if self.turn>=10:
                for g in self.at(target,'G'):
                    if not g.supplied:bonus+=2.5
                    if g.typ in ('panzer','mot'):bonus+=1.3
                if target in self.railheads:bonus+=3.2
            # preserve Soviet mobile units in bad attacks
            if calc['final_idx']<=3 and any(u.typ in ('tank','mot','heavy') for u in xs):bonus-=1.6
        # Opportunity cost for throwing too many formations into one mediocre attack.
        bonus-=.10*max(0,len(xs)-4)
        return bonus

    def plan_battles(self,side):
        if not self._is_v4(side):return super().plan_battles(side)
        enemy=self.enemy(side);plans=[]
        raw_targets=list({u.pos for u in self.us(enemy)})
        # Beam-search pruning: examine only the most consequential local battles.
        ranked=[]
        for target in raw_targets:
            adj0=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj0: continue
            atk=sum(u.A if self.is_effectively_supplied(u) else math.ceil(u.A/2) for u in adj0)
            dfn=sum(u.D for u in self.at(target,enemy)) or 1
            tactical=atk/dfn
            priority=self.target_value(side,target)*.32 + tactical*3.0
            if target in CORE: priority+=20
            ranked.append((priority,target))
        targets=[t for _,t in sorted(ranked,reverse=True)[:12]]
        for target in targets:
            adj=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj:continue
            best=None
            for xs in self._candidate_subsets(adj):
                calc=self.combat_calc(side,target,xs)
                if not calc:continue
                util=self._expected_utility(side,target,xs,calc)
                util+=self._battle_rollout_bonus(side,target,xs,calc)
                util+=self.target_value(side,target)*(.045 if side=='G' else .022)
                if side=='G' and self.turn>=12:util+=.25*self.target_value(side,target)
                if side=='S' and self.turn<8:util-=1.45
                if best is None or util>best[0]:best=(util,xs,calc)
            if best:
                name=(self.op_plan.get(side) or {}).get('name','')
                if side=='G':
                    threshold=1.55
                    if name in ('中央突破','北线主攻','南线主攻'):threshold=1.55
                    if name=='整顿补给':threshold=2.35
                    if target in CORE:threshold=-4.0
                else:
                    threshold=2.35 if self.turn<10 else (.45 if name=='机动预备队' else .75)
                xs,calc=best[1],best[2]
                armor_heavy=any(u.typ=='panzer' for u in xs) and not any(u.typ in ('inf','jager','mot') for u in xs)
                if side=='G' and armor_heavy and calc['final_idx']<=3 and target not in CORE and self.turn<15:continue
                if best[0]>=threshold:plans.append((best[0],target,xs,calc))
        plans.sort(reverse=True,key=lambda x:x[0]);return plans

    def combat_phase(self,side):
        if not self._is_v4(side): return super().combat_phase(side)
        # Focused iterative planning: fewer global rescans, but recalculate after each real result.
        for _ in range(12):
            plans=self.plan_battles(side)
            if not plans: break
            done=False
            for val,target,xs,_ in plans:
                xs=[u for u in xs if u.alive and not u.fought and u.pos in NBR[target]]
                if xs and self.at(target,self.enemy(side)):
                    self.resolve_battle(side,target,xs);done=True;break
            if not done: break

    def choose_attacker_command(self,side,target,attackers,basecalc):
        if not self._is_v4(side):return super().choose_attacker_command(side,target,attackers,basecalc)
        sp=self.staff_plan.get(side)
        if sp and sp[0]==target:
            h=self.units.get(sp[1])
            if h and h.alive and h.supplied and sum(1 for u in attackers if hdist(u.pos,h.pos)<=3)>=2:return 'Staff Office Plan',sp[1]
        hqs=self.hq_in_range(side,target,True)
        if not hqs:return None,None
        options=[]
        if self.cp[side]>=2:options.append(('Force Attack',2))
        if self.cp[side]>=1 and basecalc['river_pen']>0:options.append(('Makeshift Bridges',1))
        if self.cp[side]>=1 and basecalc['a_art'] and (TERR[target] in ('city','maincity','outercity') or basecalc['ent']):options.append(('Siege Artillery',1))
        if not options:return None,None
        baseU=self._expected_utility(side,target,attackers,basecalc)+self._battle_rollout_bonus(side,target,attackers,basecalc)
        best=(0,None,None)
        for cmd,cost in options:
            calc=self.combat_calc(side,target,attackers,att_cmd=cmd)
            u=self._expected_utility(side,target,attackers,calc,att_cmd=cmd)+self._battle_rollout_bonus(side,target,attackers,calc)
            reserve_cost=.55*cost
            if side=='G' and self.turn>=13 and target not in CORE:reserve_cost+=.7*cost
            if side=='S' and self.turn>=11 and target not in CORE:reserve_cost+=.55*cost
            urgency=2.2 if target in CORE else .7 if TERR[target] in ('city','outercity') else 0
            gain=u-baseU-reserve_cost+urgency
            if gain>best[0]:best=(gain,cmd,cost)
        if best[1] and best[0]>.28:
            h=min(hqs,key=lambda x:hdist(x.pos,target));return best[1],h.id
        return None,None

    def choose_defender_command(self,defside,target,attackers,calc):
        if not self._is_v4(defside):return super().choose_defender_command(defside,target,attackers,calc)
        if self.cp[defside]<2:return None,None
        hs=self.hq_in_range(defside,target,True)
        if not hs:return None,None
        pret=ploss=0
        for roll,w in DICE_PROB.items():
            res=CRT[roll][calc['final_idx']];al,dl,ar,dr=RES_LOSS[res]
            pret+=w/36*(1 if dr else 0);ploss+=w/36*dl
        strategic=self.target_value(defside,target)
        critical=(target in CORE or len(RAIL_G.get(target,[]))>=3 or TERR[target] in ('city','outercity'))
        threshold=.10 if target in CORE else .28 if critical else .60
        # Last Stand is intentionally rare on disposable open-ground positions.
        if pret>=threshold and (strategic>=9 or target in CORE):
            h=min(hs,key=lambda x:hdist(x.pos,target));return 'Last Stand',h.id
        return None,None

    def plan_battles(self,side):
        if not self._is_v5(side): return super().plan_battles(side)
        enemy=self.enemy(side); plans=[]
        raw_targets=list({u.pos for u in self.us(enemy)})
        ranked=[]
        op=self.op_plan.get(side) or {}; focus=op.get('focus')
        for target in raw_targets:
            adj0=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj0: continue
            atk=sum(u.A if self.is_effectively_supplied(u) else math.ceil(u.A/2) for u in adj0)
            dfn=sum(u.D for u in self.at(target,enemy)) or 1
            tactical=atk/dfn
            sec=self._pos_sector(target)
            priority=self.target_value(side,target)*.34+tactical*3.15
            if target in CORE: priority+=24
            if focus==sec: priority+=2.5
            # Sequence-awareness: targets that open a road/rail/city corridor get examined first.
            if target in RAIL_NODES: priority+=1.2
            if TERR[target] in ('city','outercity'): priority+=1.0
            ranked.append((priority,target))
        targets=[t for _,t in sorted(ranked,reverse=True)[:14]]
        for target in targets:
            adj=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj: continue
            best=None
            for xs in self._candidate_subsets(adj):
                calc=self.combat_calc(side,target,xs)
                if not calc: continue
                util=self._expected_utility(side,target,xs,calc)
                util+=self._battle_rollout_bonus(side,target,xs,calc)
                util+=self.target_value(side,target)*(.050 if side=='G' else .024)
                if side=='G' and self.turn>=12: util+=.30*self.target_value(side,target)
                if side=='S' and self.turn<8: util-=1.35
                if best is None or util>best[0]: best=(util,xs,calc)
            if not best: continue
            sec=self._pos_sector(target); name=op.get('name','')
            if side=='G':
                supplied_ratio=sum(self.is_effectively_supplied(u) for u in best[1])/max(1,len(best[1]))
                threshold=1.45
                if focus==sec: threshold=1.00
                if self.turn<=8 and supplied_ratio>=.75: threshold-=.20
                if self.turn>=12: threshold-=.35
                if name=='整顿补给': threshold+=.65
                if target in CORE: threshold=-4.5
            else:
                threshold=2.25 if self.turn<10 else (.35 if name=='机动预备队' else .65)
                if focus==sec: threshold-=.25
                if target in CORE: threshold-=.55
            xs,calc=best[1],best[2]
            armor_heavy=any(u.typ=='panzer' for u in xs) and not any(u.typ in ('inf','jager','mot') for u in xs)
            if side=='G' and armor_heavy and calc['final_idx']<=3 and target not in CORE and self.turn<15: continue
            # V5 will accept more good, supplied attacks in its focus sector, but still rejects bad armor-only assaults.
            if best[0]>=threshold: plans.append((best[0],target,xs,calc))
        plans.sort(reverse=True,key=lambda x:x[0]); return plans

    def summary(self):
        d=super().summary()
        d['ai_G']=self.ai_by_side.get('G','v4');d['ai_S']=self.ai_by_side.get('S','v4')
        d['plans_G']=dict(self.plan_history['G']);d['plans_S']=dict(self.plan_history['S'])
        return d


def run_v4_batch(n=32,seed0=7000,aiG='v4',aiS='v4'):
    rows=[]
    for i in range(n):
        g=V4Game(seed0+i,record=False,ai_by_side={'G':aiG,'S':aiS});rows.append(g.play())
    return rows



# ============================================================
# V5 Adaptive Staff AI
# Persistent cross-turn memory + doctrine commitment + opponent
# modelling + physical-sector redeployment + deeper macro rollouts.
# Rules engine remains identical to V4/current tabletop rules.
# ============================================================
class V5Game(V4Game):
    """Adaptive operational AI with memory across turns.

    V4 asks "what is best this turn?". V5 additionally remembers whether a
    plan has worked, how long it has been pursued, which sector is gaining or
    stalling, and where the opponent is concentrating.  This introduces
    doctrine persistence without hard scripting.
    """
    def __init__(self, seed=1, record=False, ai_by_side=None):
        super().__init__(seed=seed,record=record,ai_by_side=ai_by_side or {'G':'v5','S':'v5'})
        self.ai_level='v5'
        self.memory={}
        for side in ('G','S'):
            self.memory[side]={
                'last_plan':None,'plan_age':0,'success_streak':0,'failure_streak':0,
                'sector_reward':[0.0,0.0,0.0],'threat':[0.0,0.0,0.0],
                'last_state':None,'switches':0,'last_eval':0.0,
                'plan_results':Counter()
            }

    def _is_v4(self,side):
        return self.ai_by_side.get(side,'v5') in ('v4','v5','v6')
    def _is_v5(self,side):
        return self.ai_by_side.get(side,'v5') in ('v5','v6')

    @staticmethod
    def _pos_sector(p):
        # Physical operational sectors. Unlike V4, a transferred formation
        # is evaluated where it actually is, not where it started the game.
        return 0 if p[1] <= 7 else 1 if p[1] <= 13 else 2

    def _sector_units(self,side,sec,include_support=False):
        if not self._is_v5(side):
            return super()._sector_units(side,sec,include_support)
        return [u for u in self.us(side)
                if self._pos_sector(u.pos)==sec and (include_support or u.typ not in ('arty','hq'))]

    def _strength_pool(self,side):
        v=0.0
        for u in self.us(side):
            if u.typ=='hq': continue
            if u.typ=='arty': v += 2.0 if u.step<2 else .5; continue
            base=max(u.A,u.D)
            q=max(.35,1-.22*u.step)
            v += base*q + (.8 if u.typ in ARMOR_TYPES else 0)
        return v

    def _memory_state(self,side):
        return {
            'gf':[self._sector_front('G',s) for s in range(3)],
            'sf':[self._sector_front('S',s) for s in range(3)],
            'gs':[self._sector_supply_ratio('G',s) for s in range(3)],
            'ss':[self._sector_supply_ratio('S',s) for s in range(3)],
            'rail':[self._rail_front_by_line(s) for s in range(3)],
            'gpow':self._strength_pool('G'),'spow':self._strength_pool('S'),
            'goos':sum(not self.is_effectively_supplied(u) for u in self.us('G') if u.typ!='hq'),
            'soos':sum(not self.is_effectively_supplied(u) for u in self.us('S') if u.typ!='hq'),
        }

    def _update_memory(self,side):
        m=self.memory[side]; cur=self._memory_state(side); prev=m['last_state']
        if prev is not None and m['last_plan']:
            if side=='G':
                d=[cur['gf'][s]-prev['gf'][s] for s in range(3)]
                enemy_loss=max(0,prev['spow']-cur['spow'])
                own_loss=max(0,prev['gpow']-cur['gpow'])
                oos_delta=cur['goos']-prev['goos']
                val=sum(d)*1.25 + .11*enemy_loss - .09*own_loss - .75*max(0,oos_delta)
                for s in range(3):
                    lag=max(0,cur['gf'][s]-cur['rail'][s])
                    local=1.7*d[s] + .8*(cur['gs'][s]-.72) - .11*lag
                    m['sector_reward'][s]=.68*m['sector_reward'][s]+.32*local
                    # threat = Soviet defensive density relative to German power
                    gp=self._sector_power('G',s,True); sp=self._sector_power('S',s,False)
                    th=(sp+2)/(gp+2)
                    m['threat'][s]=.72*m['threat'][s]+.28*th
            else:
                # At the start of a Soviet turn, change in German robust front
                # measures how much territory was conceded over the full cycle.
                dg=[cur['gf'][s]-prev['gf'][s] for s in range(3)]
                german_loss=max(0,prev['gpow']-cur['gpow'])
                own_loss=max(0,prev['spow']-cur['spow'])
                val=-sum(dg)*1.15 + .12*german_loss - .08*own_loss
                for s in range(3):
                    gp=self._sector_power('G',s,True); sp=self._sector_power('S',s,False)
                    pressure=.16*cur['gf'][s] + .75*max(0,gp-sp) + .9*dg[s]
                    m['threat'][s]=.65*m['threat'][s]+.35*pressure
                    local=-1.6*dg[s] + .2*(gp-sp)
                    m['sector_reward'][s]=.70*m['sector_reward'][s]+.30*local
            m['last_eval']=round(val,3)
            if val>.55:
                m['success_streak']+=1; m['failure_streak']=0; m['plan_results'][m['last_plan']+'_成功']+=1
            elif val<-.55:
                m['failure_streak']+=1; m['success_streak']=0; m['plan_results'][m['last_plan']+'_失败']+=1
            else:
                m['success_streak']=max(0,m['success_streak']-1)
                m['failure_streak']=max(0,m['failure_streak']-1)
                m['plan_results'][m['last_plan']+'_持平']+=1
        m['last_state']=cur

    def _macro_rollout(self,side,plan,rollouts=14,horizon=3):
        # V5 looks one additional operational turn ahead with more samples.
        # The inherited model already contains logistics, attrition and late
        # Soviet counterpressure, so deeper sampling is enough to improve the
        # look-ahead without cloning the whole hex engine.
        if not self._is_v5(side):
            return super()._macro_rollout(side,plan,rollouts=rollouts,horizon=horizon)
        return super()._macro_rollout(side,plan,rollouts=rollouts,horizon=horizon)

    def _select_operational_plan(self,side):
        if not self._is_v5(side):
            return super()._select_operational_plan(side)
        self._update_memory(side)
        m=self.memory[side]
        plans=self.G_PLANS if side=='G' else self.S_PLANS
        scored=[]
        for p in plans:
            if side=='G' and p['name']=='主城冲刺' and self.turn<8: continue
            if side=='S' and p['name']=='首都防御' and self.turn<8: continue
            sc=self._macro_rollout(side,p,rollouts=14,horizon=3)
            last=m['last_plan']; same=(last==p['name'])
            # Doctrine persistence: don't thrash between near-equal plans.
            if same:
                sc += min(3.2,.65*m['plan_age']) + 1.15*m['success_streak'] - 2.1*m['failure_streak']
                if m['failure_streak']>=2: sc-=3.8
            elif last:
                # Switching is expensive during a successful operation, cheap after repeated failure.
                switch_cost=max(0,3.1-1.05*m['failure_streak']) + .80*min(3,m['success_streak'])
                if m['plan_age']<=1: switch_cost+=2.0
                sc-=switch_cost

            focus=p.get('focus')
            if focus is not None:
                if side=='G':
                    sc += 2.2*m['sector_reward'][focus] - .55*m['threat'][focus]
                    # Prefer a focus that can actually be sustained by rail.
                    lag=max(0,self._sector_front('G',focus)-self._rail_front_by_line(focus))
                    sc -= .30*max(0,lag-5)
                else:
                    # Soviet sector plans react to learned German pressure.
                    mx=max(m['threat']) if m['threat'] else 0
                    sc += 1.0*(m['threat'][focus]-.55*mx)

            if side=='G':
                lags=[self._sector_front('G',s)-self._rail_front_by_line(s) for s in range(3)]
                avg_sup=sum(self._sector_supply_ratio('G',s) for s in range(3))/3
                if p['name']=='整顿补给':
                    sc += 4.2 if max(lags)>=6 else -3.5
                    sc += 4.5*max(0,.78-avg_sup)
                if p['name']=='主城冲刺':
                    central=self._sector_front('G',1)
                    if self.turn>=12 and central>=26: sc+=7.0
                    if avg_sup<.62: sc-=6.0
            else:
                near_core=min((hdist(g.pos,c) for g in self.us('G') for c in CORE),default=99)
                mobile_exposed=sum(1 for g in self.us('G') if g.typ in ('panzer','mot') and (not g.supplied or sum(hdist(g.pos,s.pos)<=1 for s in self.us('S'))>=2))
                if p['name']=='首都防御' and near_core<=5: sc+=8.5
                if p['name']=='机动预备队' and self.turn>=10: sc+=1.25*min(5,mobile_exposed)

            scored.append((sc,p))
        scored.sort(reverse=True,key=lambda x:x[0])
        bestsc,best=scored[0]
        # Command continuity: an operational plan normally gets at least two own turns
        # before being abandoned, unless a clearly superior/emergency alternative appears.
        last=m['last_plan']
        if last and m['plan_age']<2:
            prev_entry=next(((sc,p) for sc,p in scored if p['name']==last),None)
            if prev_entry is not None:
                prevsc,prevp=prev_entry
                emergency=False
                if side=='G':
                    emergency=(self.turn>=14 and best['name']=='主城冲刺') or max(self._sector_front('G',s)-self._rail_front_by_line(s) for s in range(3))>=9
                else:
                    near_core=min((hdist(g.pos,c) for g in self.us('G') for c in CORE),default=99)
                    emergency=near_core<=3 and best['name']=='首都防御'
                if not emergency and bestsc-prevsc<5.0:
                    bestsc,best=prevsc,prevp
        # V5 explores less than V4 after it has evidence a doctrine works.
        near=[x for x in scored if bestsc-x[0]<.85]
        explore=.10 if m['success_streak']==0 else .035
        if len(near)>1 and self._planning_rng.random()<explore and m['plan_age']>=2:
            bestsc,best=self._planning_rng.choice(near[:2])

        old=m['last_plan']
        if old==best['name']: m['plan_age']+=1
        else:
            if old is not None: m['switches']+=1
            m['plan_age']=1
        m['last_plan']=best['name']
        self.op_plan[side]=dict(best)
        self.plan_history[side][best['name']]+=1
        self.plan_scores[side]={p['name']:round(sc,2) for sc,p in scored}
        # Explainable memory event for replay.
        reason=[]
        if old==best['name'] and m['success_streak']>0: reason.append(f'连续成功{m["success_streak"]}回合，继续执行')
        if old==best['name'] and m['failure_streak']>0: reason.append(f'已有失败记忆{m["failure_streak"]}回合，但仍是最佳方案')
        if old and old!=best['name']: reason.append(f'从“{old}”切换；上一方案评估 {m["last_eval"]:+.2f}')
        if best.get('focus') is not None:
            sec='北中南'[best['focus']]; reason.append(f'{sec}线记忆值 {m["sector_reward"][best["focus"]]:+.2f}')
        if not reason: reason.append('根据3回合运营推演选择')
        self.events.append({'type':'operational_plan','side':side,'plan':best['name'],'score':round(bestsc,2),
                            'top':[(p['name'],round(sc,1)) for sc,p in scored[:3]],'v':'V5'})
        self.events.append({'type':'strategic_memory','side':side,'plan':best['name'],'age':m['plan_age'],
                            'eval':m['last_eval'],'success':m['success_streak'],'failure':m['failure_streak'],
                            'switches':m['switches'],'sector_reward':[round(x,2) for x in m['sector_reward']],
                            'threat':[round(x,2) for x in m['threat']], 'reason':'；'.join(reason)})
        return best

    def _strategic_score(self,u,p):
        score=super()._strategic_score(u,p)
        if not self._is_v5(u.side): return score
        m=self.memory[u.side]; plan=self.op_plan.get(u.side) or {}; focus=plan.get('focus')
        psec=self._pos_sector(p); cursec=self._pos_sector(u.pos)
        if focus is not None and u.typ in ('panzer','mot','tank','heavy','elite','jager'):
            # Real cross-sector reserve transfer. Reward movement toward the focus row band.
            centers=(4,10,16); before=abs(u.pos[1]-centers[focus]); after=abs(p[1]-centers[focus])
            if after<before: score += .55*(before-after)
            if psec==focus: score += .75
            # Don't strip a successful secondary sector of its last mobile force too casually.
            if cursec!=focus and m['sector_reward'][cursec]>.8 and u.typ in ARMOR_TYPES: score-=.6
        if u.side=='G':
            # Learned sector value acts as a mild long-term preference, never stronger than supply discipline.
            score += .35*m['sector_reward'][psec]
            if u.typ in ('panzer','mot') and m['failure_streak']>=2 and plan.get('name')!='主城冲刺':
                # After repeated failure, preserve mobile forces rather than feeding the same salient.
                en=sum(1 for e in self.us('S') if hdist(p,e.pos)<=1)
                if en>=2: score-=2.0
        else:
            # Mobile reserve gravitates toward the sector that memory says is most threatened.
            if self.turn>=9 and u.typ in ('tank','mot','heavy'):
                mx=max(range(3),key=lambda s:m['threat'][s])
                if psec==mx: score+=1.2
                if cursec!=mx and abs(p[1]-(4,10,16)[mx])<abs(u.pos[1]-(4,10,16)[mx]): score+=.8
        return score

    def _battle_rollout_bonus(self,side,target,xs,calc):
        b=super()._battle_rollout_bonus(side,target,xs,calc)
        if not self._is_v5(side): return b
        m=self.memory[side]; sec=self._pos_sector(target); plan=self.op_plan.get(side) or {}
        if plan.get('focus')==sec: b+=.55
        if side=='G':
            # Reward a breach that opens high-value space on the next hex layer.
            beyond=[q for q in NBR[target] if q[0]>target[0] and not self.at(q,'G')]
            strategic=max([self.target_value('G',q) for q in beyond]+[0])
            if strategic>=8: b+=.45
            # Persistent failure memory makes V5 demand a little more from costly armor attacks.
            if m['failure_streak']>=2 and any(u.typ=='panzer' for u in xs): b-=.45
        else:
            # Counterattack logic values cutting the operational corridor, not just killing a unit.
            if target in self.repaired or target in self.railheads: b+=1.0
            if self.turn>=10 and any(g.typ in ('panzer','mot') for g in self.at(target,'G')): b+=.65
        return b

    def plan_battles(self,side):
        if not self._is_v5(side): return super().plan_battles(side)
        enemy=self.enemy(side); plans=[]
        raw_targets=list({u.pos for u in self.us(enemy)})
        ranked=[]
        op=self.op_plan.get(side) or {}; focus=op.get('focus')
        for target in raw_targets:
            adj0=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj0: continue
            atk=sum(u.A if self.is_effectively_supplied(u) else math.ceil(u.A/2) for u in adj0)
            dfn=sum(u.D for u in self.at(target,enemy)) or 1
            tactical=atk/dfn
            sec=self._pos_sector(target)
            priority=self.target_value(side,target)*.34+tactical*3.15
            if target in CORE: priority+=24
            if focus==sec: priority+=2.5
            # Sequence-awareness: targets that open a road/rail/city corridor get examined first.
            if target in RAIL_NODES: priority+=1.2
            if TERR[target] in ('city','outercity'): priority+=1.0
            ranked.append((priority,target))
        targets=[t for _,t in sorted(ranked,reverse=True)[:14]]
        for target in targets:
            adj=[u for u in self.us(side) if u.pos in NBR[target] and not u.fought and u.typ not in ('arty','hq') and u.A>0]
            if not adj: continue
            best=None
            for xs in self._candidate_subsets(adj):
                calc=self.combat_calc(side,target,xs)
                if not calc: continue
                util=self._expected_utility(side,target,xs,calc)
                util+=self._battle_rollout_bonus(side,target,xs,calc)
                util+=self.target_value(side,target)*(.050 if side=='G' else .024)
                if side=='G' and self.turn>=12: util+=.30*self.target_value(side,target)
                if side=='S' and self.turn<8: util-=1.35
                if best is None or util>best[0]: best=(util,xs,calc)
            if not best: continue
            sec=self._pos_sector(target); name=op.get('name','')
            if side=='G':
                supplied_ratio=sum(self.is_effectively_supplied(u) for u in best[1])/max(1,len(best[1]))
                threshold=1.45
                if focus==sec: threshold=1.00
                if self.turn<=8 and supplied_ratio>=.75: threshold-=.20
                if self.turn>=12: threshold-=.35
                if name=='整顿补给': threshold+=.65
                if target in CORE: threshold=-4.5
            else:
                threshold=2.25 if self.turn<10 else (.35 if name=='机动预备队' else .65)
                if focus==sec: threshold-=.25
                if target in CORE: threshold-=.55
            xs,calc=best[1],best[2]
            armor_heavy=any(u.typ=='panzer' for u in xs) and not any(u.typ in ('inf','jager','mot') for u in xs)
            if side=='G' and armor_heavy and calc['final_idx']<=3 and target not in CORE and self.turn<15: continue
            # V5 will accept more good, supplied attacks in its focus sector, but still rejects bad armor-only assaults.
            if best[0]>=threshold: plans.append((best[0],target,xs,calc))
        plans.sort(reverse=True,key=lambda x:x[0]); return plans

    def summary(self):
        d=super().summary()
        d['ai_G']=self.ai_by_side.get('G','v5'); d['ai_S']=self.ai_by_side.get('S','v5')
        d['v5_switches_G']=self.memory['G']['switches']; d['v5_switches_S']=self.memory['S']['switches']
        d['v5_eval_G']=round(self.memory['G']['last_eval'],3); d['v5_eval_S']=round(self.memory['S']['last_eval'],3)
        d['v5_memory_G']=dict(self.memory['G']['plan_results']); d['v5_memory_S']=dict(self.memory['S']['plan_results'])
        return d



# ============================================================
# V6 Operational-Graph AI
# Map-aware route planning for Strategic Reset F.
# Adds objective-distance fields, junction/bridge value, force-concentration
# maps, congestion awareness, and route-aware rail repair while retaining
# V5 cross-turn memory and HQ/CRT decision logic.
# ============================================================
class V6Game(V5Game):
    G_PLANS=(
        {'name':'平衡推进','focus':1,'aggr':1.00,'logi':1.00,'reserve':1.00,'objective':'mid'},
        {'name':'北线主攻','focus':0,'aggr':1.13,'logi':1.08,'reserve':.90,'objective':'north'},
        {'name':'中央突破','focus':1,'aggr':1.20,'logi':1.08,'reserve':.82,'objective':'mid'},
        {'name':'南线主攻','focus':2,'aggr':1.13,'logi':1.08,'reserve':.90,'objective':'south'},
        {'name':'整顿补给','focus':None,'aggr':.78,'logi':1.48,'reserve':1.20,'objective':'mid'},
        {'name':'主城冲刺','focus':1,'aggr':1.44,'logi':1.10,'reserve':.58,'objective':'capital'},
    )
    S_PLANS=(
        {'name':'纵深迟滞','focus':None,'defense':1.06,'counter':.75,'reserve':1.10,'objective':'mid'},
        {'name':'北线加固','focus':0,'defense':1.18,'counter':.75,'reserve':1.02,'objective':'north'},
        {'name':'中央加固','focus':1,'defense':1.22,'counter':.72,'reserve':1.02,'objective':'mid'},
        {'name':'南线加固','focus':2,'defense':1.18,'counter':.75,'reserve':1.02,'objective':'south'},
        {'name':'机动预备队','focus':None,'defense':.96,'counter':1.36,'reserve':1.45,'objective':'dynamic'},
        {'name':'首都防御','focus':1,'defense':1.40,'counter':.88,'reserve':1.20,'objective':'capital'},
    )

    HUB={'front':(4,10),'north_gate':(10,6),'south_gate':(13,15),
         'mid':(18,10),'north':(22,5),'south':(24,14),
         'cap_n':(29,10),'cap_s':(29,11)}

    def __init__(self, seed=1, record=False, ai_by_side=None):
        super().__init__(seed=seed,record=record,ai_by_side=ai_by_side or {'G':'v6','S':'v6'})
        self.ai_level='v6'
        self._op_cost_cache={}
        self._transport_degree={p:len(ROAD_G.get(p,[]))+len(RAIL_G.get(p,[])) for p in NBR}
        self._junctions={p for p,d in self._transport_degree.items() if d>=4}
        self._bridges={p for e in RIVER for p in e if e in ROADS or e in RAILS}
        self.metrics['v6_plan_objective_G']=Counter(); self.metrics['v6_plan_objective_S']=Counter()
        self.metrics['v6_lateral_moves_G']=0; self.metrics['v6_lateral_moves_S']=0

    def _is_v6(self,side):
        return self.ai_by_side.get(side,'v6')=='v6'

    def _is_v4(self,side):
        return self.ai_by_side.get(side,'v6') in ('v4','v5','v6')

    def _is_v5(self,side):
        return self.ai_by_side.get(side,'v6') in ('v5','v6')

    def _generic_edge_cost(self,a,b):
        e=frozenset((a,b))
        if e in ROADS: return 1.0
        t=TERR[b]
        if t=='lake': return 999.0
        v=1.0 if t in ('plain','city','maincity','outercity') else 2.0
        kind=RIVER.get(e)
        if kind=='small': v+=1
        elif kind=='main': v+=2
        return v

    def _op_distances(self,obj):
        if obj in self._op_cost_cache: return self._op_cost_cache[obj]
        dist={obj:0.0}; pq=[(0.0,obj)]
        while pq:
            d,u=heapq.heappop(pq)
            if d!=dist[u]: continue
            for v in NBR[u]:
                # reverse-cost approximation: average the two directional entry costs
                c=min(8.0,self._generic_edge_cost(v,u))
                nd=d+c
                if nd<dist.get(v,1e9):
                    dist[v]=nd; heapq.heappush(pq,(nd,v))
        self._op_cost_cache[obj]=dist
        return dist

    def _hub_power(self,side,p,radius=3,attack=True):
        val=0.0
        for u in self.us(side):
            if u.typ=='hq': continue
            d=hdist(u.pos,p)
            if d>radius: continue
            base=(u.A if attack else u.D)
            if u.typ=='arty': base=2.2 if u.step<2 else .6
            q=max(.35,1-.22*u.step)
            val += base*q*(1.0-.12*d)
        return val

    def _dynamic_soviet_objective(self):
        hubs=[self.HUB['north'],self.HUB['mid'],self.HUB['south'],self.HUB['cap_n'],self.HUB['cap_s']]
        best=None
        for h in hubs:
            gp=self._hub_power('G',h,4,True); sp=self._hub_power('S',h,4,False)
            urgency=(gp-sp) + (8 if h in CORE else 0) + (3 if h in CITY_NODES else 0)
            if best is None or urgency>best[0]: best=(urgency,h)
        return best[1]

    def _plan_objective(self,side,plan=None):
        plan=plan or self.op_plan.get(side) or {}
        key=plan.get('objective')
        if key=='north': return self.HUB['north']
        if key=='south': return self.HUB['south']
        if key=='mid':
            # Once MID is securely passed, a central plan naturally rolls toward the capital.
            if side=='G' and self.turn>=11 and max((u.pos[0] for u in self.us('G') if u.typ not in ('hq','arty')),default=3)>=21:
                return self.HUB['cap_n']
            return self.HUB['mid']
        if key=='capital': return self.HUB['cap_n'] if side=='G' else min(CORE,key=lambda c:min((hdist(g.pos,c) for g in self.us('G')),default=99))
        if key=='dynamic': return self._dynamic_soviet_objective()
        return self.HUB['mid']

    def _supply_depth(self,side,p):
        if p not in self._supply_hex[side]: return -3
        # Hexes with several supplied neighbors are safer staging areas than the very edge of the umbrella.
        return sum(q in self._supply_hex[side] for q in NBR[p])

    def _local_ratio(self,side,p,radius=2):
        enemy=self.enemy(side); f=e=0.0
        for u in self.us(side):
            if hdist(u.pos,p)<=radius and u.typ!='hq': f += max(u.A,u.D)*max(.35,1-.2*u.step)
        for u in self.us(enemy):
            if hdist(u.pos,p)<=radius and u.typ!='hq': e += max(u.A,u.D)*max(.35,1-.2*u.step)
        return (f+2)/(e+2)

    def _rail_security_targets(self):
        # Repaired German rail hexes vulnerable to Soviet interdiction.
        # Cache by turn + rail state + Soviet positions: strategic scoring calls this many times.
        key=(self.turn,len(self.repaired),tuple(sorted((u.id,u.pos) for u in self.us('S') if u.typ not in ('arty','hq'))))
        if getattr(self,'_rail_sec_cache_key',None)==key:
            return self._rail_sec_cache
        conn=self._connected_repaired(); out=[]
        sov=[u for u in self.us('S') if u.typ not in ('arty','hq')]
        for p in conn:
            danger=sum(1 for e in sov if hdist(e.pos,p)<=2)
            if not danger: continue
            val=2.0*danger + .8*len(RAIL_G.get(p,[])) + (2.5 if p in self.railheads else 0)
            out.append((val,p))
        out.sort(reverse=True)
        self._rail_sec_cache_key=key; self._rail_sec_cache=out[:5]
        return self._rail_sec_cache

    def _select_operational_plan(self,side):
        if not self._is_v6(side): return super()._select_operational_plan(side)
        # Let V5 perform memory/rollout selection, then add a map-aware counterfactual check.
        chosen=super()._select_operational_plan(side)
        scored=[]
        for p in (self.G_PLANS if side=='G' else self.S_PLANS):
            if side=='G' and p['name']=='主城冲刺' and self.turn<8: continue
            if side=='S' and p['name']=='首都防御' and self.turn<8: continue
            obj=self._plan_objective(side,p); dm=self._op_distances(obj)
            mobile=[u for u in self.us(side) if u.typ in ('panzer','mot','tank','heavy','jager','elite')]
            avgd=statistics.mean(dm.get(u.pos,40) for u in mobile) if mobile else 40
            ep=self._hub_power(self.enemy(side),obj,4,False)
            fp=self._hub_power(side,obj,4,True)
            route=-(.34*avgd) + .16*(fp-ep)
            # Junctions/cities matter more on this map than raw north/center/south row labels.
            if obj in CITY_NODES: route+=1.0
            if p['name']=='整顿补给':
                ratio=sum(u.supplied for u in self.us('G'))/max(1,len(self.us('G')))
                route += 4.0*max(0,.72-ratio)
            if p['name']=='主城冲刺' and self.turn>=13: route+=3.5
            scored.append((self.plan_scores[side].get(p['name'],-999)+route,p))
        scored.sort(reverse=True,key=lambda x:x[0])
        if scored:
            bestsc,best=scored[0]
            cur_entry=next((x for x in scored if x[1]['name']==chosen['name']),None)
            # Override V5 only for a materially better route-aware choice; prevents plan thrashing.
            if cur_entry is None or bestsc-cur_entry[0]>2.4:
                old=self.op_plan[side]
                self.op_plan[side]=dict(best)
                self.events.append({'type':'v6_route_override','side':side,'from':old['name'] if old else None,
                                    'to':best['name'],'objective':hexname(self._plan_objective(side,best)),
                                    'margin':round(bestsc-(cur_entry[0] if cur_entry else 0),2)})
                chosen=best
        # Emergency logistics reaction: a smart German staff should notice when the enemy is
        # cutting the repaired rail network instead of blindly continuing the offensive.
        if side=='G' and self.turn<15:
            goos=sum(not u.supplied for u in self.us('G') if u.typ!='hq')
            threats=self._rail_security_targets()
            severe=(goos>=4) or (threats and threats[0][0]>=7.0)
            if severe and chosen['name']!='整顿补给':
                repl=next(p for p in self.G_PLANS if p['name']=='整顿补给')
                self.events.append({'type':'v6_logistics_alarm','oos':goos,
                                    'rail_target':hexname(threats[0][1]) if threats else None,
                                    'from':chosen['name'],'to':'整顿补给'})
                self.op_plan[side]=dict(repl); chosen=repl
        obj=self._plan_objective(side,chosen)
        self.metrics['v6_plan_objective_'+side][hexname(obj)]+=1
        return chosen

    def _strategic_score(self,u,p):
        score=super()._strategic_score(u,p)
        if not self._is_v6(u.side): return score
        obj=self._plan_objective(u.side)
        dm=self._op_distances(obj)
        before=dm.get(u.pos,50); after=dm.get(p,50)
        progress=before-after
        mobile=u.typ in ('panzer','mot','tank','heavy','recon','jager','elite')
        if mobile: score += .90*progress
        else: score += .42*progress
        # Roads are operational assets now, not supply abstractions.
        road_here=bool(ROAD_G.get(p))
        if road_here:
            score += 1.10 if mobile else .35
        # Strong transport junctions / cities are useful staging and interdiction points.
        score += .20*min(5,self._transport_degree.get(p,0))
        if p in self._junctions: score += .65
        if p in CITY_NODES: score += .75
        # Two-unit stacking means congestion is a real cost. Avoid forming blobs around a single hex.
        crowd=sum(len(self.at(q,u.side)) for q in NBR[p])
        if crowd>=8: score-=1.7
        elif crowd>=6: score-=.8
        # Prefer robust local concentration, but not suicidal spearheads.
        ratio=self._local_ratio(u.side,p,2)
        if u.typ in ('panzer','mot','tank','heavy'):
            if ratio<.72: score-=3.0
            elif ratio>1.45: score+=1.1
        # German mobile units should remain inside a reasonably deep rail supply umbrella unless late-game assault.
        if u.side=='G' and u.typ in ('panzer','mot','arty'):
            depth=self._supply_depth('G',p)
            if depth>=4: score+=.9
            elif depth<=1 and depth>=0: score-=1.2
            elif depth<0:
                score-=6.0
                if self.turn<13 and (self.op_plan.get('G') or {}).get('name')!='主城冲刺': score-=3.0
        # If Soviet units threaten the repaired rail net, nearby German infantry/engineers
        # act as a security force. This prevents smart Soviet raiders from creating absurdly large OOS pockets unchecked.
        if u.side=='G':
            threats=self._rail_security_targets()
            if threats:
                _,rt=threats[0]
                before_rt=hdist(u.pos,rt); after_rt=hdist(p,rt)
                urgent=sum(not x.supplied for x in self.us('G') if x.typ!='hq')>=3
                if u.typ in ('inf','jager','eng') and after_rt<before_rt:
                    score += (1.45 if urgent else .65)*(before_rt-after_rt)
                elif urgent and u.typ in ('mot','panzer') and after_rt<before_rt and before_rt<=5:
                    score += .45*(before_rt-after_rt)
        # Soviet defensive geometry: static troops anchor a chain of operational strongpoints,
        # while mobile formations stay as a reserve behind whichever hub is under pressure.
        if u.side=='S':
            if self.turn<=5:
                anchors=[self.HUB['front'],self.HUB['north_gate'],self.HUB['south_gate']]
            elif self.turn<=10:
                anchors=[self.HUB['mid'],self.HUB['north'],self.HUB['south']]
            else:
                anchors=[self.HUB['north'],self.HUB['south'],self.HUB['cap_n'],self.HUB['cap_s']]
            if u.typ in ('inf','elite','at','eng'):
                d=min(hdist(p,a) for a in anchors)
                score += 2.2 if d==0 else 1.25 if d==1 else .45 if d==2 else 0
                # Cohesive two-unit positions are useful, but a whole carpet around one hex is not.
                friend_adj=sum(1 for x in self.us('S') if x.id!=u.id and hdist(p,x.pos)==1 and x.typ!='hq')
                score += .35*min(2,friend_adj)
                if u.typ=='at':
                    armor_near=sum(1 for g in self.us('G') if g.typ=='panzer' and hdist(p,g.pos)<=2)
                    score += 1.15*armor_near
            elif u.typ in ('tank','mot','heavy'):
                th=self._dynamic_soviet_objective()
                d=hdist(p,th)
                if self.turn<9:
                    score += 1.4 if d in (3,4) else .7 if d==2 else -.8 if d<=1 else 0
                else:
                    score += 1.4 if d in (1,2,3) else 0
                # Don't let the reserve sit directly on top of static defenders unless the position is critical.
                if len(self.at(p,'S'))>=1 and p not in CORE: score-=.55
        # HQ seeks useful coverage rather than a fixed row sector.
        if u.typ=='hq':
            covered=sum(1 for x in self.us(u.side) if x.typ not in ('hq','arty') and hdist(p,x.pos)<=3)
            score += .45*covered - .12*dm.get(p,30)
            if any(hdist(p,e.pos)<=1 for e in self.us(self.enemy(u.side))): score-=5
        return score

    def _battle_rollout_bonus(self,side,target,xs,calc):
        b=super()._battle_rollout_bonus(side,target,xs,calc)
        if not self._is_v6(side): return b
        obj=self._plan_objective(side); dm=self._op_distances(obj)
        # Battle has operational value if capturing the target shortens the route to the current objective.
        before=min((dm.get(u.pos,50) for u in xs),default=50)
        after=dm.get(target,50)
        b += .25*max(-2,min(6,before-after))
        if target in self._junctions: b+=.8
        if target in CITY_NODES: b+=.55
        if target in self._bridges: b+=.45
        if side=='S' and self.turn>=10:
            # Counterattacks that hit road/rail junctions can disrupt German lateral rotation.
            if target in ROAD_NODES and target in RAIL_NODES: b+=.65
        if side=='G':
            # Clearing an enemy formation off the repaired logistics spine can restore supply to an entire component.
            if target in self.repaired: b+=2.2
            if target in self.railheads: b+=1.5
        return b

    def repair_rail(self):
        if not self._is_v6('G'): return super().repair_rail()
        conn=self._connected_repaired(); engs=self._engineer_bonus_available(); bonus=bool(engs)
        total=5 if bonus else 4
        # Preserve tabletop branch caps; engineer lets one nearest-entry branch receive 3.
        line_cap=[2,2,2]
        obj=self._plan_objective('G'); dm=self._op_distances(obj)
        focus=(self.op_plan.get('G') or {}).get('focus')
        if engs:
            # Engineer commits to the branch whose next repairs best shorten the operational route.
            line_values=[]
            for ln in range(3):
                vals=[-dm.get(p,50) for p in conn if RAIL_LINE.get(p)==ln]
                line_values.append(max(vals) if vals else -99)
            line_cap[max(range(3),key=lambda i:line_values[i]+(1.5 if focus==i else 0))]=3
        used=[0,0,0];added=[]
        for _ in range(total):
            conn=self._connected_repaired(); cands=[]; occS={u.pos for u in self.us('S')}
            for u0 in conn:
                for v in RAIL_G.get(u0,[]):
                    if v in self.repaired or v in occS: continue
                    ln=RAIL_LINE.get(v,1)
                    if used[ln]>=line_cap[ln]: continue
                    if v in CITY_NODES and self.city_control.get(v)=='S': continue
                    demand=sum(max(0,6-hdist(v,x.pos)) for x in self.us('G') if x.typ!='hq')
                    route_gain=max(0,dm.get(u0,50)-dm.get(v,50))
                    junction=.8*min(5,self._transport_degree.get(v,0))
                    zpen=7 if v in self.enemy_zoc('G') else 0
                    focusb=2.2 if focus==ln else 0
                    sc=1.15*demand+3.0*route_gain+junction+focusb-zpen+self._planning_rng.random()*.08
                    cands.append((sc,v,ln))
            if not cands: break
            _,v,ln=max(cands); self.repaired.add(v);used[ln]+=1;added.append(v)
        self._choose_railheads(); self.metrics['rail_repaired_per_turn'].append(len(added))
        if added:self.events.append({'type':'rail_repair','hexes':[hexname(x) for x in added],'count':len(added),
                                     'engineer_bonus':bonus,'allocation':used,'v':'V6','objective':hexname(obj)})
        return added

    def movement_phase(self,side):
        if not self._is_v6(side): return super().movement_phase(side)
        before={u.id:self._pos_sector(u.pos) for u in self.us(side)}
        # With a hard 2-unit stack cap, move combat maneuver elements before support pieces.
        # Germans open routes with recon/mobile formations; Soviets establish the line first and then place reserves.
        if side=='G':
            order={'recon':0,'panzer':1,'mot':1,'jager':2,'inf':2,'eng':3,'arty':4,'hq':5}
        else:
            order={'inf':0,'elite':0,'at':0,'eng':1,'tank':2,'heavy':2,'mot':2,'arty':4,'hq':5}
        obj=self._plan_objective(side); dm=self._op_distances(obj)
        us=sorted(self.us(side),key=lambda u:(order.get(u.typ,3),dm.get(u.pos,50),self._planning_rng.random()))
        for u in us: self.move_unit(u)
        self._update_controls()
        self.metrics['v6_lateral_moves_'+side]+=sum(self._pos_sector(u.pos)!=before.get(u.id,self._pos_sector(u.pos))
                                                   for u in self.us(side))

    def summary(self):
        d=super().summary()
        d['ai_G']=self.ai_by_side.get('G','v6'); d['ai_S']=self.ai_by_side.get('S','v6')
        d['v6_objectives_G']=dict(self.metrics['v6_plan_objective_G'])
        d['v6_objectives_S']=dict(self.metrics['v6_plan_objective_S'])
        d['v6_lateral_moves_G']=self.metrics['v6_lateral_moves_G']
        d['v6_lateral_moves_S']=self.metrics['v6_lateral_moves_S']
        return d


def run_v6_batch(n=8,seed0=12000,aiG='v6',aiS='v6'):
    rows=[]
    for i in range(n):
        g=V6Game(seed0+i,record=False,ai_by_side={'G':aiG,'S':aiS}); rows.append(g.play())
    return rows

def run_v5_batch(n=16,seed0=9500,aiG='v5',aiS='v5'):
    rows=[]
    for i in range(n):
        g=V5Game(seed0+i,record=False,ai_by_side={'G':aiG,'S':aiS}); rows.append(g.play())
    return rows


if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument('--games',type=int,default=8); ap.add_argument('--seed',type=int,default=12000)
    ap.add_argument('--aiG',choices=['v3','v4','v5','v6'],default='v6')
    ap.add_argument('--aiS',choices=['v3','v4','v5','v6'],default='v6')
    ap.add_argument('--out',default='/mnt/data/eastfront_v6_test.csv')
    args=ap.parse_args(); rows=run_v6_batch(args.games,args.seed,args.aiG,args.aiS)
    dict_cols=('hq_G','hq_S','plans_G','plans_S','v5_memory_G','v5_memory_S','v6_objectives_G','v6_objectives_S')
    keys=[k for k in rows[0] if k not in dict_cols]
    fields=keys+[k for k in dict_cols if k in rows[0]]
    with open(args.out,'w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    c=Counter(r['winner'] for r in rows)
    print('games',len(rows),'AI',args.aiG,'vs',args.aiS,'wins',c,'German%',round(100*c['German']/len(rows),1))
    print('avg max col',round(statistics.mean(r['g_max_col'] for r in rows),2),'avg cap battles',round(statistics.mean(r['capital_battles'] for r in rows),2))
    print('avg late Soviet attacks',round(statistics.mean(r['soviet_attacks_t10plus'] for r in rows),2),'avg rail repair',round(statistics.mean(r['avg_rail_repair'] for r in rows),2))
    print('avg German OOS',round(statistics.mean(r['avg_g_oos'] for r in rows),2),
          'plan switches G/S',round(statistics.mean(r.get('v5_switches_G',0) for r in rows),2),round(statistics.mean(r.get('v5_switches_S',0) for r in rows),2))
    if 'v6_lateral_moves_G' in rows[0]:
        print('avg lateral moves G/S',round(statistics.mean(r['v6_lateral_moves_G'] for r in rows),2),round(statistics.mean(r['v6_lateral_moves_S'] for r in rows),2))
