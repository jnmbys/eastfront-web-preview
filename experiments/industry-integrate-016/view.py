"""Detached JSON projection only. Quantities always read from original authoritative lots."""
from copy import deepcopy
from config import digest,REAR,FRONT
def export_view(root):
    before=digest(root);p=root['personnel']['package'];e=root['industry']['batch'];f=root.get('forward',{})
    owner=p['owner'];expired=f.get('closed',False) or 'QUARANTINED' in p['custody']
    front={'P':p['quantityP'] if owner==FRONT else 0,'E2:L':e['quantityE2'] if e['owner']==FRONT else 0}
    v=dict(schema='industry-016-view.v1',readOnly=True,rootRevision=root['revision'],gameRevision=root['bundle']['revision'],
        turn=root['bundle']['core']['turn'],phase=root['bundle']['core']['phase'],materialRevision=f.get('materialRevision',0),
        equipmentBudget=deepcopy(root['industry']['budget']),personnelBudget=deepcopy(root['personnel']['account']),care=deepcopy(f.get('care')),
        transport=deepcopy(f.get('capacity')),shipment=deepcopy(f.get('shipment')),terminal=deepcopy(f.get('terminal')),
        materials={'P':deepcopy(p),'E2:L':deepcopy(e)},frontInventory=front,
        availableFrontInventory={k:v if not f.get('closed') and p['custody']=='FRONT_AVAILABLE' else 0 for k,v in front.items()},
        rearInventory={'P':p['quantityP'] if owner==REAR else 0,'E2:L':e['quantityE2'] if e['owner']==REAR else 0},
        receiver=deepcopy(f.get('receiver')),recovery=deepcopy(f.get('recovery')),expired=expired,
        historicalOffmapPersonnelLQ={'used':4,'remaining':0,'reusable':False},
        blockers=[] if f.get('recovery') else ['SCOPE_EXPIRED'] if expired else ['CARE_NOT_PAID'] if not f.get('care') else ['AWAIT_E8_SHIPMENT'] if not f.get('shipment') else ['MATERIAL_HELD'] if f['shipment']['status']=='HELD' else ['AWAIT_T9_CORE_QUALIFICATION'],
        globalBlockersRetained=35,globalBlockersClosed=0,sourceGapSP={'G':9,'S':14},runtimeDefaultEnabled=False)
    assert digest(root)==before
    return v
