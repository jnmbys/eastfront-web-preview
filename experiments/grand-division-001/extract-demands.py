"""Read a supplied installation's base unit definitions; never executes or edits game files.
Exports factual requirements only, not copyrighted game scripts or artwork.
Mod overlays, technology, doctrines and engine conversion behavior are NOT inferred.
"""
import argparse, re, json, hashlib
from pathlib import Path
parser=argparse.ArgumentParser(); parser.add_argument('game'); parser.add_argument('output'); a=parser.parse_args()
root=Path(a.game)
source_map={
 'INFANTRY':('infantry','infantry'), 'MOTORIZED':('infantry','motorized'),
 'ARTILLERY':('artillery_brigade','artillery_brigade'), 'ANTI_TANK':('anti_tank_brigade','anti_tank_brigade'),
 'MEDIUM_ARMOR':('medium_armor','medium_armor'),'HEAVY_ARMOR':('heavy_armor','heavy_armor'),
 'ENGINEER':('engineer','engineer'),'RECON':('recon','recon'), 'SUPPORT_ARTILLERY':('artillery','artillery'),
 'SUPPORT_AT':('anti_tank','anti_tank'),'SIGNAL':('signal','signal_company'),
 'LOGISTICS':('logistics','logistics_company'),'MAINTENANCE':('maintenance','maintenance_company'),
 'HOSPITAL':('field_hospital','field_hospital')}
def parse(text):
    tokens=re.findall(r'"(?:[^"\\]|\\.)*"|[{}=]|[^\s{}=]+', re.sub(r'#[^\n]*','',text)); pos=0
    def block():
        nonlocal pos
        out={}
        while pos<len(tokens) and tokens[pos]!='}':
            if tokens[pos]=='{':
                pos+=1; out.setdefault('$blocks',[]).append(block()); continue
            key=tokens[pos]; pos+=1
            if pos<len(tokens) and tokens[pos]=='=':
                pos+=1
                if tokens[pos]=='{': pos+=1; value=block()
                else: value=tokens[pos]; pos+=1
                out.setdefault(key,[]).append(value)
            else: out.setdefault('$items',[]).append(key)
        if pos<len(tokens): pos+=1
        return out
    return block()
version=json.loads((root/'launcher-settings.json').read_text(encoding='utf-8-sig'))['version']
result={'sourceVersion':version,'scope':'Installed base files only; no mod overlays, technology or DLC activation inferred. Demand preview only, not engine behavior verification.','units':{}}
for key,(file,unit) in source_map.items():
    path=root/'common'/'units'/(file+'.txt'); raw=path.read_bytes(); tree=parse(raw.decode('utf-8-sig'))
    data=tree['sub_units'][0][unit][0]; need=data['need'][0]
    assert all(len(v)==1 for v in need.values())
    result['units'][key]={'originalId':unit,'source':'common/units/'+file+'.txt','sha256':hashlib.sha256(raw).hexdigest(),'manpower':int(data['manpower'][0]),'equipment':{k:int(v[0]) for k,v in need.items()},'group':data['group'][0]}
# Retain source scalars separately: these are NOT final division/combat attributes.
    fields=['max_strength','max_organisation','default_morale','combat_width','supply_consumption','maximum_speed','training_time','suppression','weight']
    result['units'][key]['baseAttributes']={k:float(data[k][0]) for k in fields if k in data}
    result['units'][key]['activeByDefault']=data.get('active',['UNSPECIFIED'])[0]
    result['units'][key]['unlockSources']=[]
    result['units'][key]['uninterpretedEligibilityFields']=[k for k in ['allow','available','can_be_parachuted','regimental','regimental_support'] if k in data]
# Every enable_subunits occurrence is inspected, including conditional DLC blocks.
by_original={u['originalId']:u for u in result['units'].values()}
for path in sorted((root/'common'/'technologies').glob('*.txt')):
    raw=path.read_bytes(); tree=parse(raw.decode('utf-8-sig')); technologies=tree.get('technologies',[{}])[0]
    for tech,definitions in technologies.items():
        for definition in definitions:
            if not isinstance(definition,dict): continue
            for enabled in definition.get('enable_subunits',[]):
                if not isinstance(enabled,dict): continue
                for unit in enabled.get('$items',[]):
                    if unit in by_original:
                        by_original[unit]['unlockSources'].append({'technology':tech,'source':path.relative_to(root).as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),'conditional':any(k!='$items' for k in enabled) or any(k in definition for k in ['allow','allow_branch','allow_research','visible']),'conditions':{k:v for k,v in enabled.items() if k!='$items'},'technologyConditions':{k:definition[k] for k in ['allow','allow_branch','allow_research','visible'] if k in definition},'qualificationVerified':False})
path=root/'common/doctrines/grand_doctrines/land_grand_doctrines.txt';raw=path.read_bytes();tree=parse(raw.decode('utf-8-sig'))
result['columnSizeEffects']=[]
for doctrine,definitions in tree.items():
    for definition in definitions:
        if not isinstance(definition,dict): continue
        for index,milestone in enumerate(definition.get('milestones',[{}])[0].get('$blocks',[])):
            if 'additional_brigade_column_size' in milestone:
                result['columnSizeEffects'].append({'doctrine':doctrine,'milestoneIndex':index,'additionalRows':int(milestone['additional_brigade_column_size'][0]),'source':path.relative_to(root).as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),'runtimeActivationVerified':False})
Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(version, len(result['units']), 'definitions extracted; no game file changed')
