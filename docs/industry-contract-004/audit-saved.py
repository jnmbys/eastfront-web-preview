"""Independent checks of saved outputs; no recalculation of decisions or simulation."""
from pathlib import Path
import json, hashlib
p = Path(__file__).resolve().parent
j = json.loads((p / 'RESULTS.json').read_text(encoding='utf-8'))
checks = 0
def ck(test, description):
    global checks
    checks += 1
    if not test:
        raise AssertionError(description)
for run in j['results']:
    rows = run['prefixRows'] + run['rows']
    ck([r['turn'] for r in rows] == list(range(1, 25)), 'exactly 24 E boundaries')
    production = purchase = salvage = repair = front_in = front_maintenance = actions = rear_paid = 0
    traces = {t['turn']: t for t in run['trace']}
    for r in rows:
        production += r['productionE']; purchase += r.get('purchaseE', 0)
        salvage += r['reconditionE']; repair += r['recovered']
        front_in += r.get('frontIssuedSP', r.get('spReceived', 0))
        front_maintenance += r['maintenancePaid']; actions += r['spActionCost']
        rear_paid += r.get('rearPaidSP', 0)
        orders = r.get('totalOrders', r.get('newTotal', 0))
        ck(production + purchase + salvage == r['rearE'] + r['depotE'] + r['inTransitE'] + repair + orders*3, 'equipment reserve/commitment flow')
        ck(60 == r['personnel'] + repair + orders*3, 'personnel unique payment')
        # All selected runs have zero destruction; the final check below requires this observation.
        ck(24 + front_in + rear_paid == r['spStock'] + actions + front_maintenance + rear_paid, 'SP including rear consumption')
        if r['turn'] not in traces:
            continue
        tr = traces[r['turn']]
        ck(r['sourceCapSP'] in (0,22), 'no boosted source')
        ck(r['rearPaidSP'] + r['frontSourceAvailableSP'] == r['sourceCapSP'], 'source after rear')
        ck(r['sourceCapSP'] == r['rearPaidSP'] + r['frontIssuedSP'] + r['sourceUnusedSP'], 'source not stock')
        ck(r['cargoUsed'] == r['shippedE'] + r['frontIssuedSP'] <= r['cargoCapacity'], 'rear has no corridor charge; equipment not free')
        ck(r['maintenanceDemand'] == r['maintenancePaid'] + r['maintenanceShort'], 'actual maintenance shortfall')
        ck(sum(u['stock'] for u in tr['units'])/4 == r['spStock'], 'unit stock totals')
        ck(sum(a['paidQ'] for a in tr['unitActions'])/4 == r['spActionCost'], 'action payment')
        ck(sum(a['factor']==1 for a in tr['unitActions']) == r['fullAttack'], 'full opportunity count')
        owners = {m['unit']:m['owner'] for m in tr['maintenanceOwners']}
        ck(len(owners) == len(tr['maintenanceOwners']), 'no double rear/front ownership')
        for o in tr['orders']:
            if o['status'] in ('ASSEMBLING','WAITING_ENTRY'):
                ck(owners[o['unitId']] == 'REAR', 'undeployed owner')
                ck(not any(u['id']==o['unitId'] for u in tr['units']), 'no undeployed front shadow')
            if o['enteredTurn'] == r['turn']:
                ck(o['enteredTurn'] >= o['entryEligibleFromTurn'], 'entry after completion')
                ck(owners[o['unitId']] == 'FRONT', 'entry transition unique')
                action = next(a for a in tr['unitActions'] if a['unit']==o['unitId'])
                ck(action['stockBeforeQ']==0 and action['paidQ']==0 and action['factor']==0.5, 'no rear stock transfer')
        for m in tr['rearRows']:
            ck(m['arrearsBeforeQ']+m['currentDueQ']==m['paidArrearsQ']+m['paidCurrentQ']+m['arrearsAfterQ'], 'arrears flow')
        for b in tr['batches']:
            ck(b['due']==b['dispatch'], 'fixed original L1')
            ck(b['availableFromTurn']==b['receivedEpoch']+1, 'not retroactive use')
    ck(run['summary']['destroyedSP']==0 and run['summary']['deaths']==0, 'zero destruction observed in these samples, not a survival guarantee')
    ck(run['summary']['rearPaidSP']==rear_paid and run['summary']['frontIssuedSP']==front_in, 'summary sources')
for route in 'ABCD':
    a=next(r for r in j['results'] if r['summary']['route']==route and r['summary']['scenario']=='arrears')
    b=next(r for r in j['results'] if r['summary']['route']==route and r['summary']['scenario']=='uncommitted')
    ck(a['fork']['state']==b['fork']['state'], 'same actual state before new commitment')
    old={o['id'] for o in b['fork']['state']['orders']}
    ck(old <= {o['id'] for o in b['finalOrders']}, 'no free cancellation')
    ck(all(o['acceptedTurn']<13 for o in b['finalOrders']), 'decline only future orders')
out={'status':'PASS_SAVED_DATA_AUDIT','runs':16,'epochRows':384,'checks':checks,
     'resultFileSHA256':hashlib.sha256((p/'RESULTS.json').read_bytes()).hexdigest(),
     'limitation':'Checks saved conditional accounts only. No Core legality, real entry, geographic routing, VP or survival validation.'}
(p/'INDEPENDENT_AUDIT.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(out,indent=2))
