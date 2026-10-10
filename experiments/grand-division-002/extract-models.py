"""Read-only, factual export. No game launch, DLC/config or save mutation."""
import argparse, hashlib, json, re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('installation', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
# Reuse the already reviewed data parser, without running its command-line entry.
previous = Path(__file__).resolve().parents[1] / 'grand-division-001/extract-demands.py'
source = previous.read_text(encoding='utf-8')
namespace = {'re': re}
exec(source[source.index('def parse('):source.index('\nversion=json.loads')], namespace)
parse = namespace['parse']
facts = {'environment': 'User existing 1.19.3; file definitions, not clean-install or runtime formula verification', 'models': {}, 'units': {}}
for filename, model, archetype in [('infantry', 'infantry_equipment_1', 'infantry_equipment'), ('support', 'support_equipment_1', 'support_equipment')]:
    relative = f'common/units/equipment/{filename}.txt'
    raw = (args.installation / relative).read_bytes()
    definitions = parse(raw.decode('utf-8-sig'))['equipments'][0]
    # Parent entries are not recursively merged: the chosen concrete definitions
    # override their archetype. Record both facts instead of guessing inheritance.
    fields = ['build_cost_ic', 'maximum_speed', 'defense', 'breakthrough', 'soft_attack', 'hard_attack', 'ap_attack', 'armor_value', 'hardness', 'reliability']
    read = lambda d: {k: float(d[k][0]) for k in fields if k in d}
    resource = lambda d: {k: float(v[0]) for k, v in d.get('resources', [{}])[0].items()}
    base, concrete = definitions[archetype][0], definitions[model][0]
    facts['models'][model] = {'archetype': archetype, 'source': relative, 'sha256': hashlib.sha256(raw).hexdigest(), 'archetypeFields': read(base), 'modelFields': read(concrete), 'archetypeResources': resource(base), 'modelResources': resource(concrete), 'cost': float(concrete.get('build_cost_ic', base['build_cost_ic'])[0]), 'unit': 'piece'}
for name, filename, original in [('INFANTRY', 'infantry', 'infantry'), ('ENGINEER', 'engineer', 'engineer'), ('RECON', 'recon', 'recon')]:
    relative = f'common/units/{filename}.txt'
    raw = (args.installation / relative).read_bytes()
    definition = parse(raw.decode('utf-8-sig'))['sub_units'][0][original][0]
    scalar = ['max_strength', 'max_organisation', 'combat_width', 'supply_consumption', 'maximum_speed', 'soft_attack', 'hard_attack', 'defense', 'breakthrough', 'recon', 'entrenchment']
    facts['units'][name] = {'source': relative, 'sha256': hashlib.sha256(raw).hexdigest(), 'manpower': int(definition['manpower'][0]), 'need': {k: int(v[0]) for k, v in definition['need'][0].items()}, 'scalarDefinitions': {k: float(definition[k][0]) for k in scalar if k in definition}, 'essential': definition.get('essential', [{}])[0].get('$items', []), 'note': 'Scalar modifiers are not final attributes or an approved aggregation formula.'}
args.output.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Read-only export: 2 explicit equipment models, 3 unit definitions.')
