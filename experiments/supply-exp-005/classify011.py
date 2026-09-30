"""Classify existing 75 refusals; no simulation or new requests."""
import gzip,json,collections
from pathlib import Path
root=Path(__file__).parent;d=json.loads(gzip.decompress((root/'evidence/campaign011/run.json.gz').read_bytes()))
seen={};rows=[];byturn={}
for index,f in enumerate(d['failures'],1):
 issues=json.loads(f['error'].removeprefix('Error: '));assert len(issues)==1 and issues[0]['code']=='STACKING_LIMIT'
 occupants=issues[0]['details']['currentLivingUnits'];assert len(occupants)==2 and all(u.startswith('S-') for u in occupants)
 for uid in occupants:
  deployments=[r for r in d['records'] if r['command']['action'].get('reinforcementId')==uid and r['command']['action']['type']=='DEPLOY_REINFORCEMENT']
  assert len(deployments)==1 and deployments[0]['turn_before']<=f['turn'] and deployments[0]['command']['action']['entryHex']==f['action']['entryHex']
 key=json.dumps(f['action'],sort_keys=True);previous=seen.get(key);kind='script_repeat_intent_later_turn' if previous else 'script_first_full_entry'
 if previous:assert previous['turn']<f['turn']
 row=dict(index=index,turn=f['turn'],action=f['action'],category=kind,primary_cause='script tests known-full own entry instead of skipping it',previous_failure_index=previous and previous['index'],known_own_occupants=occupants,unchanged=f['unchanged'])
 rows.append(row);seen[key]=row
 byturn.setdefault(str(f['turn']),collections.Counter())[kind]+=1
out=dict(total=len(rows),categories=dict(collections.Counter(r['category'] for r in rows)),intentional_negative_cases=0,same_turn_same_action_repetition=0,failed_request_id_available=False,transport_duplicate_status='Not established: failure log has no request ID; 48 repetitions are identical intents in later turns, not proved same-request retransmissions.',rule_defect=False,by_turn=byturn,rows=rows)
assert out['total']==75 and out['categories']=={'script_first_full_entry':27,'script_repeat_intent_later_turn':48}
(root/'evidence/campaign011-close/refusal-classification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(out['categories'])
