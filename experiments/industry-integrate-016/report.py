"""Derive delivery ledger from actual saved execution, never from a projected final save."""
import gzip,json
from config import *
from view import export_view
def main():
    raw=gzip.decompress((HERE/'TRACE.json.gz').read_bytes());t=json.loads(raw)
    assert sha(raw)==json.loads((HERE/'RUN.json').read_bytes())['traceSha256']
    e8=next(x for x in t['records'] if x['result'].get('boundary'))
    w=e8['result']['boundary'];after=e8['afterBoundary']['bundle'];pre=t['preRecovery'];end=t['recovered']
    rows=[]
    for name,r in [('T8_START',t['start']),('T8_CARE_PAID',t['care']),('E8_ARRIVED_T9_BEGIN',e8['afterBoundary']),('T9_RECOVERY_BEFORE',pre),('T9_RECOVERY_AFTER',end),('NO_OPERATION_END_E8',t['control']['root']),('UNUSED_END_E9',t['unusedEndE9']['root'])]:
        v=export_view(r);rows.append(dict(checkpoint=name,rootHash=digest(r),rootRevision=r['revision'],gameRevision=r['bundle']['revision'],
            materialRevision=v['materialRevision'],legacyEquipmentRevision=r['industry']['revision'],legacyPersonnelRevision=r['personnel']['revision'],
            equipmentBudget=v['equipmentBudget'],personnelBudget=v['personnelBudget'],care=v['care'],P=v['materials']['P'],E2=v['materials']['E2:L'],
            frontInventory=v['frontInventory'],availableFrontInventory=v['availableFrontInventory'],RP=r['bundle']['core']['rp'],step=r['bundle']['core']['units']['G-I-01']['step'],expired=v['expired']))
    comparison=[]
    for row in w['units']:
        actual=after['core']['units'][row['id']]
        comparison.append(dict(**row,actualCore=dict(alive=actual['alive'],step=actual['step'],supplyState=actual['supplyState'],expSupply=actual.get('expSupply'))))
    e9=next(x for x in t['unusedEndE9']['records'] if (x['result'].get('boundary') or {}).get('epoch')==9)['result']['boundary']
    output=dict(task='INDUSTRY-INTEGRATE-016',traceSha256=sha(raw),qPerSP=4,checkpoints=rows,
        capacity=e8['afterBoundary']['forward']['capacity'],unitComparison=comparison,sourceComparison=w['sourceComparison'],hubComparison=w['hubComparison'],conservation=w['conservation'],
        actualE9UnusedMaintenance=e9['results'],E9Interpretation='Actual normal E9 attrition in the unused branch. No matched E9 no-freight counterfactual; not an attribution of all losses to the material shipment.',
        recovery=dict(before=pre['forward']['materialRevision'],after=end['forward']['materialRevision'],result=end['forward']['recovery'],CoreBefore=t['commonBefore']['common'],CoreAfter=t['commonAfter']['common']),
        pendingGlobal=dict(blockersRetained=35,blockersClosed=0,sourceGapSP={'G':9,'S':14}),scope='LOCAL_SINGLE_PROCESS_CHAIN_ONLY_NO_LONG_TERM_BENEFIT_OR_BALANCE_CLAIM')
    (HERE/'LEDGER.json').write_bytes((json.dumps(output,ensure_ascii=False,indent=2)+'\n').encode())
    print('ACTUAL_LEDGER_EXPORTED')
if __name__=='__main__':main()
