"""Read-only R1 regression/impact report; no game imports, turns or approvals."""
import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from validate import inspect, read, ROOT
from map_validation import authority, validate_bindings


def main():
    config, facts, profile = read('candidate.json'), read('inputs/FACTS.json'), read('inputs/INDUSTRY_PROFILE.json')
    good, old = read('inputs/MAP_NODES.json'), read('r1/BASELINE_MAP_NODES.json')
    original = read('r1/BASELINE_VALIDATION.json')
    result = inspect(config, facts, good, profile)
    assert result['errors'] == []
    assert result['blockers'] == original['blockers'] and len(result['blockers']) == 35
    assert hashlib.sha256((ROOT/'candidate.json').read_bytes()).hexdigest() == original['configSha256']
    def node(data, label):
        return next(n for n in data['nodes'] if n['nodeId'] == label)
    checks = []
    def reject(name, description, changed, expected):
        found = inspect(config, facts, changed, profile)
        assert found['reviewStatus'] == 'INVALID', name
        assert all(any(e.startswith(prefix) for e in found['errors']) for prefix in expected), (name,found['errors'])
        assert found['blockers'] == original['blockers']
        checks.append({'case':name,'mutation':description,'result':'REJECT',
                       'expectedReasons':expected,'actualReasons':found['errors']})
    m = copy.deepcopy(good)
    node(m,'C10')['key'] = node(old,'C10')['key']
    reject('render_coordinates','C10 key replaced by original logistics x/y (2,9)', m,
           ['MAP_LABEL_TO_KEY:C10','MAP_KEY_TO_LABEL:2,9'])
    m = copy.deepcopy(good)
    a,b = node(m,'C10'),node(m,'C11'); a['key'],b['key'] = b['key'],a['key']
    assert len({x['key'] for x in m['nodes']}) == 640
    assert {x['key'] for x in m['nodes']} == set(authority()['hexes'])
    reject('other_valid_cell','Swap C10/C11 keys: membership, uniqueness and complete key set still valid',m,
           ['MAP_LABEL_TO_KEY:C10','MAP_LABEL_TO_KEY:C11','MAP_KEY_TO_LABEL:'])
    m = copy.deepcopy(good); node(m,'C10')['key'] = node(m,'C11')['key']
    reject('duplicate_key','C10 copies C11 key, C11 unchanged',m,['MAP_DUPLICATE_KEY','MAP_CORE_KEY_COVERAGE'])
    m = copy.deepcopy(good)
    a,b=node(m,'C10'),node(m,'C11'); a['nodeId'],b['nodeId']=b['nodeId'],a['nodeId']
    reject('paper_name_mismatch','Swap only C10/C11 labels; full unique label/key sets retained',m,
           ['MAP_LABEL_TO_KEY:C10','MAP_LABEL_TO_KEY:C11'])
    for field,value,reason in [('terrain','LAKE','MAP_TERRAIN_MISMATCH:C10'),('control','G','MAP_CONTROL_MISMATCH:C10')]:
        m=copy.deepcopy(good); node(m,'C10')[field]=value
        reject(field+'_mismatch',f'C10 {field} becomes {value}',m,[reason])
    m=copy.deepcopy(good); m['nodes'].pop()
    reject('missing_cell','Remove AF20',m,['MAP_NODE_COUNT','MAP_LABEL_COVERAGE','MAP_CORE_KEY_COVERAGE'])
    m=copy.deepcopy(good); node(m,'C10')['nodeId']='C11'
    reject('duplicate_label','C10 renamed C11',m,['MAP_DUPLICATE_LABEL','MAP_LABEL_COVERAGE'])
    # Exercise endpoint checks independently of FACTS witness equality.
    path_checks=[]
    for name, edges, reason in [
        ('disconnected',['B10~C10','A10~B10'],'PATH_DISCONNECTED:'),
        ('wrong_receiver',['A10~B10'],'PATH_RECEIVER_ENDPOINT:'),
        ('non_neighbor',['A10~C10'],'PATH_NOT_CORE_RAIL_NEIGHBORS:')]:
        c=copy.deepcopy(config); c['receivers'][0]['routeWitness']['edges']=edges
        errors=validate_bindings(c,good)['errors']
        assert any(e.startswith(reason) for e in errors)
        path_checks.append({'case':name,'edges':edges,'result':'REJECT','actualReasons':errors})
    new_by_id={n['nodeId']:n for n in good['nodes']}
    wrong=[{'nodeId':n['nodeId'],'beforeKey':n['key'],'afterKey':new_by_id[n['nodeId']]['key'],
            'oldKeyExistsInCore':n['key'] in authority()['hexes']} for n in old['nodes'] if n['key']!=new_by_id[n['nodeId']]['key']]
    assert len(wrong)==620 and sum(n['oldKeyExistsInCore'] for n in wrong)==180
    assert all(n['terrain']==new_by_id[n['nodeId']]['terrain'] and n['control']==new_by_id[n['nodeId']]['control'] for n in old['nodes'])
    before_by_id={n['nodeId']:n for n in old['nodes']}
    bindings=copy.deepcopy(result['mapBindings'])
    for item in bindings['services']:
        item['beforeKey']=before_by_id[item['nodeId']]['key']
        item['keyChanged']=item['beforeKey']!=item['key']
    for route in bindings['routes']:
        for step in route['steps']:
            step['beforeFromKey']=before_by_id[step['from']]['key']
            step['beforeToKey']=before_by_id[step['to']]['key']
            step['endpointsChanged']=(step['beforeFromKey'],step['beforeToKey'])!=(step['fromKey'],step['toKey'])
    old_result=inspect(config,facts,old,profile)
    assert old_result['reviewStatus']=='INVALID'
    # Verify actual CLI exit, not just a printed status.
    cli=[]
    for args,expected in [([],0),(['--runtime-gate'],2),(['--map',str(ROOT/'r1/BASELINE_MAP_NODES.json')],1)]:
        p=subprocess.run([sys.executable,str(ROOT/'validate.py'),*args],capture_output=True)
        assert p.returncode==expected, p.stderr.decode()
        output=json.loads(p.stdout)
        cli.append({'args':args if not args or args[0]!='--map' else ['--map','r1/BASELINE_MAP_NODES.json'],
                    'exit':p.returncode,'reviewStatus':output['reviewStatus'],'runtimeDecision':output['runtimeDecision']})
    proof={
      'task':'RULE-CAMPAIGN-003-R1','baseCommit':'0670565ff6491c2f5fe9b1db9b3f7f6a4e03b356',
      'result':'PASS_OFFLINE_CORRECTION_ONLY','cells':640,'correctedKeys':len(wrong),
      'wrongKeysPointingAtAnotherValidCell':sum(n['oldKeyExistsInCore'] for n in wrong),
      'terrainControlChanges':0,'blockersIdentical':True,'blockerCount':len(result['blockers']),
      'candidateSha256Unchanged':original['configSha256'],'baselineDeficit':result['baseline'],
      'negativeMapChecks':checks,'negativePathChecks':path_checks,'cliChecks':cli,
      'oldProjectionNowRejected':{'errorCount':len(old_result['errors']),'status':old_result['reviewStatus']},
      'bindings':bindings,'corrections':wrong,
      'hashes':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in [
          'inputs/MAP_NODES.json','r1/CORE_AUTHORITY.json','generate_map.mjs','validate.py','map_validation.py',
          'check_map_r1.py','r1/BASELINE_MAP_NODES.json','r1/BASELINE_VALIDATION.json','r1/BASELINE_SOURCES.json']},
      'notProven': ['current path usability','actual entry/repair legality','runtime authorization','campaign balance']}
    print(json.dumps(proof,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
