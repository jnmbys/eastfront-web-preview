"""Read-only projection checks against a hash-pinned original-Core import receipt."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
AUTHORITY_SHA256 = '51e277ea2383477ca48fbd7c7a857e561ca6681684c94b668775cf234f3aa7e4'


def authority():
    raw = (ROOT / 'r1/CORE_AUTHORITY.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != AUTHORITY_SHA256:
        raise ValueError('CORE_AUTHORITY_HASH_MISMATCH')
    return json.loads(raw)


def column_label(n):
    result = ''
    while n:
        n, digit = divmod(n - 1, 26)
        result = chr(65 + digit) + result
    return result


def paper_key(label):
    # Independently checked inverse arithmetic; generator executes original TS.
    m = re.fullmatch(r'([A-Z]+)([1-9][0-9]*)', label)
    if not m:
        raise ValueError('INVALID_PAPER_LABEL')
    col = 0
    for letter in m[1]:
        col = col * 26 + ord(letter) - 64
    q = col - 1
    return f'{q},{int(m[2]) - 1 - q // 2}'


def key_paper(key):
    if not re.fullmatch(r'(0|[1-9][0-9]*),(-?[1-9][0-9]*|0)', key):
        raise ValueError('INVALID_CORE_KEY')
    q, r = map(int, key.split(','))
    return column_label(q + 1) + str(r + q // 2 + 1)


def validate_map(data):
    ref = authority()['hexes']
    expected = {column_label(c) + str(r) for c in range(1, 33) for r in range(1, 21)}
    errors = []
    nodes = data.get('nodes', [])
    labels = [n.get('nodeId') for n in nodes]
    keys = [n.get('key') for n in nodes]
    def need(ok, reason):
        if not ok:
            errors.append(reason)
    need(len(nodes) == 640, 'MAP_NODE_COUNT')
    need(len(set(labels)) == len(labels), 'MAP_DUPLICATE_LABEL')
    need(len(set(keys)) == len(keys), 'MAP_DUPLICATE_KEY')
    need(set(labels) == expected, 'MAP_LABEL_COVERAGE')
    need(set(keys) == set(ref), 'MAP_CORE_KEY_COVERAGE')
    for n in nodes:
        label, key = n.get('nodeId'), n.get('key')
        if label not in expected:
            errors.append('MAP_UNKNOWN_LABEL:' + str(label))
            continue
        correct = paper_key(label)
        need(key == correct, f'MAP_LABEL_TO_KEY:{label}:expected={correct}:actual={key}')
        try:
            need(key_paper(key) == label, f'MAP_KEY_TO_LABEL:{key}:actualLabel={label}')
        except (ValueError, TypeError):
            errors.append('MAP_INVALID_KEY:' + str(key))
        cell = ref[correct]  # Not ref[key]: a different valid key must never pass.
        need(n.get('terrain') == cell['terrain'], 'MAP_TERRAIN_MISMATCH:' + label)
        need('control' in n and n['control'] == cell['control'], 'MAP_CONTROL_MISMATCH:' + label)
    return errors


def validate_bindings(config, data):
    """Static endpoint/rail membership only; NOT current legal entry or usable transport."""
    ref = authority()
    nodes = {n['nodeId']: n for n in data['nodes']}
    sources = {s['id']: s for s in config['sources']}
    errors, services, routes = [], [], []
    for kind in ('sources', 'depots', 'receivers', 'entries'):
        for obj in config[kind]:
            label = obj.get('node', obj.get('anchorNode'))
            n = nodes.get(label)
            if not n or n['key'] != paper_key(label):
                errors.append('SERVICE_CORE_BINDING:' + obj['id'])
                continue
            services.append({'kind': kind, 'id': obj['id'], 'side': obj['side'], **n})
    for receiver in config['receivers']:
        witness = receiver['routeWitness']
        source = sources.get(witness['sourceId'])
        if not source or source['side'] != receiver['side']:
            errors.append('PATH_SOURCE_SIDE:' + receiver['id'])
            continue
        cursor = source['node']
        steps = []
        for edge in witness['edges']:
            endpoints = edge.split('~')
            if len(endpoints) != 2 or cursor not in endpoints or endpoints[0] == endpoints[1]:
                errors.append('PATH_DISCONNECTED:' + receiver['id'] + ':' + edge)
                break
            target = endpoints[1] if endpoints[0] == cursor else endpoints[0]
            if cursor not in nodes or target not in nodes:
                errors.append('PATH_UNKNOWN_ENDPOINT:' + edge)
                break
            a, b = nodes[cursor]['key'], nodes[target]['key']
            correct_a, correct_b = paper_key(cursor), paper_key(target)
            if (a, b) != (correct_a, correct_b):
                errors.append('PATH_CORE_ENDPOINT_MISMATCH:' + edge)
            aq, ar = map(int, correct_a.split(',')); bq, br = map(int, correct_b.split(','))
            distance = max(abs(aq-bq), abs(ar-br), abs(aq+ar-bq-br))
            core_edge = '|'.join(sorted((a, b)))
            rail = ref['edges'].get(core_edge, {}).get('railway')
            if distance != 1 or not rail or rail.get('present') is not True:
                errors.append('PATH_NOT_CORE_RAIL_NEIGHBORS:' + edge)
            steps.append({'from':cursor,'to':target,'fromKey':a,'toKey':b,'coreEdge':core_edge})
            cursor = target
        if cursor != receiver['node']:
            errors.append('PATH_RECEIVER_ENDPOINT:' + receiver['id'])
        routes.append({'receiverId':receiver['id'],'sourceId':source['id'],
                       'sourceNode':source['node'],'receiverNode':receiver['node'],'steps':steps})
    return {'errors':errors, 'services':services, 'routes':routes,
            'scope':'Pinned initial terrain/control and rail geometry only; checkpoint usability/industrial grants NOT inferred.'}
