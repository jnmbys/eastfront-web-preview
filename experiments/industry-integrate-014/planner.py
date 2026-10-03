"""Read-only planning on pinned full T8 root. Every projected game is uncommitted."""
import os,sys,json,time,subprocess,threading
from copy import deepcopy
from config import HERE,OUT,LIVE,START_SHA,BASE,digest,serialized,load_root,verify_inputs
from capacity import run as solve_capacity
LOCK=threading.RLock()
CARGO={'rail:A10~B10':8,'rail:B10~C10':8,'T':16,'W:GH2':8}

def core_query(bundle,unitId='G-I-01',controllerId='G-HUMAN-1'):
    before=digest(bundle)
    r=subprocess.run(['node',str(HERE/'query.mjs')],input=serialized(dict(bundle=bundle,unitId=unitId,controllerId=controllerId)),
        text=True,encoding='utf8',capture_output=True,timeout=3)
    assert digest(bundle)==before
    if r.returncode:raise ValueError('CORE_QUERY_FAILED:'+r.stderr)
    return json.loads(r.stdout)

def material_facts(root):
    errors=[];p=root['personnel'];i=root['industry'];package=p['package'];batch=i['batch'];ids=p['ids']
    if not package or package['quantityP']<1:errors.append('INSUFFICIENT_P')
    if not batch or batch['quantityE2']<2 or i['warehouse']['resident']<2:errors.append('INSUFFICIENT_E2')
    if package and package['custody']!='REAR_AVAILABLE':errors.append('PERSONNEL_EXPIRED_OR_UNAVAILABLE')
    if batch and batch['custody']!='REAR_AVAILABLE':errors.append('EQUIPMENT_UNAVAILABLE')
    if any(x and x['owner']!='RC007-REAR-G-A10' for x in [package,batch]):errors.append('OWNER_NOT_A10')
    if package and root['bundle']['core']['turn']>package['receivedEpoch']+1:errors.append('PERSONNEL_CARE_EXPIRED')
    try:
        assert package['id']==ids['packageId'] and batch['id']==i['order']['batchId']
        assert p['application']['fingerprintHash']==digest(p['application']['fingerprint'])
        assert i['order']['fingerprintHash']==digest(i['order']['fingerprint'])
        assert p['importReceipt']['ids']==ids and p['importReceipt']['actualTrainingReceipt'] is None
        assert root['grantRegistry'][ids['sourceGrantId']]['receipt']==p['importReceipt']
        assert root['grantRegistry'][ids['budgetGrantId']]['receipt']==p['importReceipt']
        assert p['account']['grantedI']==2 and p['account']['availableI']==p['account']['escrowI']==0
        assert p['account']['acceptanceCareSpentI']==p['account']['carriageSpentI']==1
        assert p['quota']['used']=={ids['shipmentId']:4} and not p['quota']['holds']
        assert not p['incomingP'] and len(root['warehouseRegistry'])==1
        assert i['warehouse']['resident']==batch['quantityE2'] and i['warehouse']['P']==0
        assert i['events'][batch['productionReceiptId']]['kind']=='E12_INDUSTRIAL_OUTPUT'
        assert i['events'][i['order']['paidProductionReceiptId']]['kind']=='ORDER_ACCEPTED_AND_PAID'
        received=[e for e in p['journal'] if e['kind']=='E15_RECEIVED'];assert len(received)==1
        assert received[0]['details']['receiptId']==ids['receiptId'] and received[0]['details']['quantityP']==1
        for k,v in p['events'].items():assert v['id']==k and v in p['journal']
        for k,v in i['events'].items():assert v['id']==k
        for k,v in i['grants'].items():assert root['grantRegistry'][k]==v
        assert i['budget']==dict(granted=10,freeI=5,productionSpent=3,handoffSpent=2,escrow=0)
        assert len(root['receipts'])==37
        for rid,rec in root['receipts'].items():
            originalRequest=rec['request'] if 'request' in rec else dict(id=rid,action=rec['action'],**rec['before'])
            assert rec['status']=='COMMITTED' and rec['fingerprint']==digest(originalRequest)
    except (AssertionError,KeyError,TypeError):errors.append('MATERIAL_PROVENANCE_OR_PERMANENT_RECEIPT_INVALID')
    return dict(errors=sorted(set(errors)),personnelPackage=deepcopy(package),equipmentBatch=deepcopy(batch),
        personnelSource='APPROVED_SCENARIO_TRAINED_RESERVE_ASSUMPTION_NO_ACTUAL_TRAINING_RECEIPT',equipmentSource='012_PAID_PRODUCTION_UNIQUE_BATCH',
        canonicalWarehouse='RC007-REAR-G-A10',personnelAuthority='personnel.package',equipmentAuthority='industry.batch plus reconciled industry.warehouse.resident',
        equipmentBudget=deepcopy(i['budget']),personnelBudget=deepcopy(p['account']),
        historicalOffmap=dict(personnelUsedLQ=sum(p['quota']['used'].values()),remainingLQ=0,renewable=False,equipment012=deepcopy(i['external']),usableForThisPlan=False),
        careDeadlineEndEpoch=package['receivedEpoch']+1 if package else None,permanentReceipts=len(root['receipts']))

def route_facts(bundle,query):
    # Use the exact SP graph eligibility, not a hand-drawn map path.
    if str(LIVE) not in sys.path:sys.path.insert(0,str(LIVE))
    import model
    s=bundle['logistics'];adj=model.adjacency(s,'rail','G');issues=[];segments=[]
    for n in query['map']['nodes']:
        issues.extend(n['issues'])
        if not n['exists']:issues.append('MAP_NODE_MISSING')
    for seg in query['map']['edges']:
        eid=seg['from']+'~'+seg['to'];edge=next((e for e in s['edges'] if e['id']==eid),None);ce=seg['coreEdge']
        valid=bool(edge and ce and seg['distance']==1 and ce.get('railway',{}).get('present') and not ce['railway']['destroyed'] and ce['railway']['repairedBy']=='GERMAN'
            and edge['core_railway']==ce['railway'] and any(n==seg['to'] and e['id']==eid for n,e in adj[seg['from']]))
        if not valid:issues.append('PATH_NOT_LEGAL:'+eid)
        segments.append(dict(**seg,spEdge=deepcopy(edge),existingSPRailEligible=valid,plannedLoadLQ=8,plannedTWork=8*edge['rail_cost'] if edge else None))
    if query['map']['targetHex']!={'q':2,'r':8} or query['common']['target'] is None or query['common']['target']['id']!='G-I-01':issues.append('TARGET_NOT_AT_C10_NO_RETARGETED_SERVICE')
    hub=next((h for h in s['hubs'] if h['id']=='GH2'),None)
    if not hub or hub['node']!='C10' or hub['side']!='G' or hub.get('inactive'):issues.append('GH2_SERVICE_NOT_AT_TARGET')
    if query['map']['integrity']:issues.append('CORE_INTEGRITY_INVALID')
    return dict(errors=sorted(set(issues)),nodes=query['map']['nodes'],segments=segments,target='G-I-01',receiver='C10',hub=deepcopy(hub),
        terminalOnly=dict(proposedW=8,sourceRule006=True,notLinehaul=True,newTargetBoundReceiptRequired=True,receiptPresent=False),
        materialReceiverCapacity={'P':None,'E2:L':None},SPWarehouseCapacityIsNotMaterialCapacity=True,
        mappingHash=query['map']['correctedMappingHash'],materialTransportAuthorized=False)

def project(root):
    """Original live.execute on copies; tap its single original SP call, never replace its result."""
    os.environ['OPENBLAS_NUM_THREADS']='1'
    if str(LIVE) not in sys.path:sys.path.insert(0,str(LIVE))
    import live,bounded
    bounded.warm_start();bundle=deepcopy(root['bundle']);commands=[];captured={};original=live.logistics_transaction
    def tap(s,op,seconds):
        assert op=='settle' and not captured,'ONLY_ONE_PROJECTED_E8_BOUNDARY'
        captured['input']=deepcopy(s);captured['inputHash']=digest(s)
        result=original(s,op,seconds);assert digest(s)==captured['inputHash']
        if result['ok']:captured.update(reference=deepcopy(result['result']),settledLogistics=deepcopy(result['state']),profile=result['profile'])
        return result
    try:
        live.logistics_transaction=tap
        for _ in range(32):
            c=bundle['core']
            if (c['turn'],c['phase'])==(9,'GERMAN_RECOVERY'):break
            a=core_query(bundle)['nextAction'];assert a is not None,'PENDING_EXPLICIT_RESOLUTION_REQUIRED'
            assert a['type'] in ['END_PHASE','DEPLOY_REINFORCEMENT']
            command=dict(id='014-uncommitted-'+str(bundle['revision']),revision=bundle['revision'],action=a)
            result=live.execute(bundle,command,seconds=3)
            if not result['ok']:raise RuntimeError('PROJECTION_UNRESOLVED:'+str(result.get('error')))
            bundle=result['state'];commands.append(dict(command=command,afterHash=digest(bundle),seconds=result['seconds']))
        else:raise RuntimeError('PROJECTION_GUARD')
    finally:live.logistics_transaction=original
    assert captured['input']['epoch']=='L7' and captured['input']['core_turn']==9 and len(captured['reference'])==2
    assert bundle['core']['random']==root['bundle']['core']['random']
    return dict(origin='PRIVATE_UNCOMMITTED_NO_ACTIONS_OR_TRANSPORT_PUBLISHED',scenario='only legal phase continuation and mandatory scenario reinforcement if needed; no movement/combat/recovery',
        startRootHash=digest(root),commands=commands,boundaryEpoch=8,**captured,futureBundle=bundle,
        futureCommon=core_query(bundle)['common'],materialTreatment='not moved; existing P would quarantine at end E8. No carry extension assumed.')

class Planner:
    def __init__(self):
        verify_inputs();self._root=load_root();self._cache=None
    def snapshot(self):return deepcopy(self._root)
    def query(self,expectedRootHash=START_SHA,unitId='G-I-01',controllerId='G-HUMAN-1'):
        with LOCK:
            before=serialized(self._root)
            try:
                if expectedRootHash!=digest(self._root):return dict(status='STALE_START',executable=False,published=False)
                key=(expectedRootHash,unitId,controllerId)
                if self._cache and self._cache[0]==key:return deepcopy(self._cache[1])
                result=self._plan(unitId,controllerId);self._cache=(key,deepcopy(result));return result
            finally:assert serialized(self._root)==before,'PLANNER_MUTATED_AUTHORITY'
    def _plan(self,unitId,controllerId):
        root=self._root;facts=material_facts(root);q=core_query(root['bundle'],unitId,controllerId);route=route_facts(root['bundle'],q)
        blockers=list(facts['errors'])+list(route['errors'])
        if not q['common']['commonEligible']:blockers.append('CURRENT_CORE_COMMON_INELIGIBLE')
        result=dict(schema='industry-014-forward-plan.v1',origin='REAL_PINNED_T8_WITH_UNCOMMITTED_PROJECTION',base013=BASE,startRootHash=digest(root),
            gameRevision=142,rootRevision=37,materials=facts,route=route,currentRecovery=q['common'],currentRPQuote=q['rpQuote'],
            payment=dict(exclusiveModes=['RP','PE'],automaticFallback=False,doubleCharge=False,sharedRecoveryCount=True,
                proposedPE={'P':1,'E2:L':2},actualDebits=[],rpQuoteIsSeparateCurrentAlternative=True),
            timing=dict(earliestConditionalDispatchEpoch=8,latencyAssumptionFromEarlierSlice=1,earliestConditionalArrivalEpoch=8,
                earliestConditionalAvailableTurn=9,earliestConditionalRecovery='T9 GERMAN_RECOVERY',personnelCareEndsAt='END_E8',
                committedSchedule=None,warning='Candidate timing only. Transfer does not extend P care; new transit/front care and dispatch/receipt scope required.'),
            rulesNeeded=['NEW_E8_MAP_TRANSPORT_GRANT_FOR_EXISTING_LOTS_AND_NULL_CONTROL_ROUTE',
                'NEW_TRANSIT_AND_FRONT_PERSONNEL_CARE_THROUGH_T9_NO_AUTOMATIC_EXTENSION',
                'NEW_C10_CAPACITY_CUSTODY_AND_TARGET_BOUND_TERMINAL_SERVICE',
                'NEW_T9_PE_RECOVERY_SCOPE_USING_ORIGINAL_SHARED_CORE_LIMIT'],
            executable=False,published=False,actualMaterialDebits=0,actualCapacityReservation=0,globalBlockersRetained=35,globalBlockersClosed=0)
        if blockers:result.update(status='BLOCKED_INPUT_OR_QUALIFICATION',blockers=blockers);return result
        try:
            projection=project(root);futureRoute=route_facts(projection['futureBundle'],core_query(projection['futureBundle']))
            if futureRoute['errors']:result.update(status='BLOCKED_PROJECTED_ROUTE',projection=projection,blockers=futureRoute['errors']);return result
            capacity=solve_capacity(projection['input'],projection['reference'],CARGO)
            result.update(projection=projection,projectedRoute=futureRoute,capacity=capacity,proposedResourceLoad=CARGO)
            rule=json.loads((OUT/'rule006.json').read_bytes());assert {x['id']:x['perKit'] for x in rule['charges']['rows']}==CARGO
            assert rule['charges']['ratesLQ']=={'P':4,'E2:L':2}
            g=next(x for x in projection['reference'] if x['side']=='G')
            result['maintenanceCost']=dict(referenceGermanDue=sum(u['due'] for u in g['units']),
                referenceGermanPaid=sum(u['maintenance'] for u in g['units']),
                alternativePaid=None if capacity['status']!='FEASIBLE' else sum(u['alternative']['maintenance'] for u in capacity['unitComparison'] if u['side']=='G'),
                selectedMaintenanceReduction=0,priorityTradeoffEvaluated=False,
                note='No acceptable unchanged-maintenance plan if infeasible; 8 W shortfall is not 8 SP, casualties or VP. No reduced-maintenance policy evaluated.')
            result['resourceLedger']=dict(materials=[dict(resource='P',owner='RC007-REAR-G-A10',available=1,proposedForward=1,actualDebited=0),
                dict(resource='E2:L',owner='RC007-REAR-G-A10',available=2,proposedForward=2,actualDebited=0)],
                personnelI=dict(alreadySpent=2,newDebit=0,escrow=0),equipmentI=dict(freeI=5,newDebit=0),
                newTransportIQuote=None,newTransportIQuoteStatus='NO_NEW_SERVICE_PRICE_OR_GRANT_ASSUMED',
                oldOffmapLQ=dict(cap=4,used=4,remaining=0,eligibleForLinehaul=False),
                newLinehaulAndTerminal=dict(proposed=CARGO,actualReserved=0,actualUsed=0))
            result['resourceLedger']['referenceSPSourceRows']=[deepcopy(x) for x in g['constraints'] if x['id'].startswith('source:')]
            result['resourceLedger']['referenceSPHubClosing']=deepcopy(g['hubs'])
            if capacity['status']!='FEASIBLE':blockers.append('NO_MAINTENANCE_PRESERVING_CAPACITY_PROOF:'+capacity['status'])
            if not projection['futureCommon']['commonEligible']:blockers.append('PROJECTED_T9_COMMON_INELIGIBLE')
            blockers.extend(result['rulesNeeded']);result.update(status='BLOCKED_READ_ONLY_PLAN',blockers=blockers)
        except (TimeoutError,subprocess.TimeoutExpired) as e:result.update(status='TIMEOUT_UNPROVEN',blockers=['QUERY_TIMEOUT'],detail=str(e))
        except Exception as e:result.update(status='UNRESOLVED_PROJECTION',blockers=['PROJECTION_OR_AUDIT_UNRESOLVED'],detail=str(e))
        return result

def main():
    import argparse,gzip
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');a=p.parse_args();planner=Planner();before=digest(planner.snapshot());plan=planner.query()
    assert before==digest(planner.snapshot())==START_SHA
    if a.write:
        (HERE/'PLAN.json.gz').write_bytes(gzip.compress(serialized(plan).encode(),mtime=0))
        concise={k:v for k,v in plan.items() if k not in ['projection','capacity']}
        if 'capacity' in plan:concise['capacity']={k:v for k,v in plan['capacity'].items() if k in ['status','rows','seconds','budgetSeconds','infeasibilityProof','maintenanceDelta','sourceComparison','hubComparison']}
        if 'projection' in plan:concise['projectedRecovery']=plan['projection']['futureCommon']
        (HERE/'PLAN.json').write_bytes((json.dumps(concise,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps({k:plan[k] for k in ['status','blockers','detail'] if k in plan},ensure_ascii=False))
if __name__=='__main__':main()
