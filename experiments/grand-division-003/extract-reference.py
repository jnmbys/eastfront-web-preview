"""Read factual numeric definitions only; never launches or modifies the reference game."""
import argparse, hashlib, json, re
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('installation', type=Path)
p.add_argument('output', type=Path)
a = p.parse_args()
old = Path(__file__).resolve().parents[1] / 'grand-division-001/extract-demands.py'
text = old.read_text(encoding='utf-8')
ns = {'re': re}
exec(text[text.index('def parse('):text.index('\nversion=json.loads')], ns)
parse = ns['parse']
sources = {}
def read(relative):
    raw = (a.installation / relative).read_bytes()
    sources[relative] = hashlib.sha256(raw).hexdigest()
    return parse(raw.decode('utf-8-sig'))

fields = set('build_cost_ic maximum_speed defense breakthrough soft_attack hard_attack ap_attack armor_value hardness reliability fuel_consumption max_strength max_organisation combat_width supply_consumption reconnaissance entrenchment weight'.split())
def numeric(d, allowed=None):
    result = {}
    for k, values in d.items():
        if allowed is not None and k not in allowed:
            continue
        if len(values) == 1 and isinstance(values[0], str):
            try: result[k] = float(values[0])
            except ValueError: pass
    return result
def stats(d):
    return {'scalar': numeric(d, fields), **{k: numeric(d[k][0]) for k in ['add_stats', 'multiply_stats', 'resources', 'add_resources'] if k in d}}

facts = {'environment': 'HOI4 1.19.3 user existing environment; recorded enabled DLC; no clean-install claim',
         'evidenceKind': 'file definitions, not observed engine aggregation or unlock verification',
         'models': {}, 'units': {}, 'tank': {}, 'sources': sources}
for file, archetype, model in [('artillery', 'artillery_equipment', 'artillery_equipment_1'), ('motorized', 'motorized_equipment', 'motorized_equipment_1')]:
    relative = f'common/units/equipment/{file}.txt'
    defs = read(relative)['equipments'][0]
    facts['models'][model] = {'source': relative, 'archetype': archetype, 'base': stats(defs[archetype][0]), 'concrete': stats(defs[model][0]), 'parent': defs[model][0].get('parent', []), 'parentInheritance': 'not inferred'}
for key, file, name in [('ARTILLERY','artillery_brigade','artillery_brigade'), ('SUPPORT_ARTILLERY','artillery','artillery'), ('MOTORIZED','infantry','motorized'), ('LIGHT_ARMOR','light_armor','light_armor')]:
    relative = f'common/units/{file}.txt'
    d = read(relative)['sub_units'][0][name][0]
    terrain = {k: numeric(v[0]) for k,v in d.items() if isinstance(v[0],dict) and any(x in v[0] for x in ['attack','defence','movement'])}
    facts['units'][key] = {'source': relative, 'originalId': name, 'group': d['group'][0], 'manpower': int(d['manpower'][0]), 'need': numeric(d['need'][0]), 'stats': stats(d), 'terrain': terrain, 'active': d.get('active', ['unspecified'])[0], 'unlockVerified': False}

# An actual complete, non-MIO starting variant, not a bare chassis renamed as a tank.
history = read('history/countries/GER - Germany.txt')
def walk(d):
    if isinstance(d,dict):
        for values in d.values():
            for v in values: yield from walk(v)
        yield d
variant = next(d for d in walk(history) if d.get('name') == ['"Leichttraktor"'] and d.get('type') == ['light_tank_chassis_0'])
tank = facts['tank']
tank['name'] = 'Leichttraktor'
tank['source'] = 'history/countries/GER - Germany.txt'
tank['requiredDLC'] = 'No Step Back (recorded in prior user-environment evidence)'
tank['chassisId'] = variant['type'][0]
tank['moduleSlots'] = {k:v[0] for k,v in variant['modules'][0].items()}
tank['upgradeLevels'] = numeric(variant['upgrades'][0])
chassis = read('common/units/equipment/tank_chassis.txt')['equipments'][0]
tank['chassisBase'] = stats(chassis['light_tank_chassis'][0])
tank['chassisConcrete'] = stats(chassis[tank['chassisId']][0])
modules = read('common/units/equipment/modules/00_tank_modules.txt')['equipment_modules'][0]
tank['modules'] = {k: stats(modules[k][0]) for k in tank['moduleSlots'].values()}
upgrades = read('common/units/equipment/upgrades/land_upgrades.txt')['upgrades'][0]
tank['upgrades'] = {k: stats(upgrades[k][0]) for k in tank['upgradeLevels']}
tank['aggregationStatus'] = 'pending project policy; these components alone do not prove runtime totals'
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Read-only factual export: {len(sources)} source hashes, 4 units, 2 models, complete tank component manifest.')
