"""Read-only arithmetic replay of candidate.1 fixtures; never imports game code.

Inputs are conditional receipts, NOT a move validator, transport solver or server.
Expected deltas/after-states are consulted only after an event is recalculated.
All output goes to stdout; no network, subprocess, random numbers or file writes.
"""
import argparse
import copy
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import sys


class Invalid(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise Invalid(message)


def q(value):
    return Fraction(value)


def number(value):
    value = q(value)
    return int(value) if value.denominator == 1 else str(value)


def add(state, key, value):
    state[key] = number(q(state.get(key, 0)) + q(value))


def move(state, side, material, origin, destination, amount):
    require(isinstance(amount, int) and amount >= 0, 'invalid material quantity')
    a, b = (f'acct.{side}.{material}.{x}' for x in (origin, destination))
    require(state[a] >= amount, 'material unavailable: ' + a)
    add(state, a, -amount)
    add(state, b, amount)


def ids(state, kind):
    return sorted({k.split('.')[1] for k in state if k.startswith(kind + '.')})


def score(state, side):
    members = [u for u in ids(state, 'unit') if state[f'unit.{u}.side'] == side]
    r = sum(q(state[f'unit.{u}.weight']) for u in members)
    loss = sum(q(state[f'unit.{u}.weight']) *
               q(state[f'unit.{u}.step']) / q(state[f'unit.{u}.maxStep']) for u in members)
    return {'R': number(r), 'L': number(loss), 'F': number(40 * loss / r) if r else None}


def stock(state, side):
    return sum(state[f'unit.{u}.stock_q'] for u in ids(state, 'unit')
               if state[f'unit.{u}.side'] == side)


def invariants(state, before):
    for side in ('G', 'S'):
        for material in ('P', 'E2'):
            prefix = f'acct.{side}.{material}.'
            total = sum(v for k, v in state.items() if k.startswith(prefix))
            initial = sum(v for k, v in before.items() if k.startswith(prefix))
            require(total == initial, f'{side} {material} conservation')
        def tally(s, name):
            return s.get(f'tally.{side}.{name}_q', 0)
        issued = tally(state, 'issued') - tally(before, 'issued')
        consumed = sum(tally(state, k) - tally(before, k)
                       for k in ('rearConsumed', 'frontConsumed'))
        require(stock(before, side) + issued == stock(state, side) + consumed,
                side + ' SP conservation')
        require(state.get('R.' + side, 0) == score(state, side)['R'],
                side + ' R must equal actually deployed IDs')
    for key, value in state.items():
        if key.startswith(('acct.', 'source.', 'transport.', 'tally.')):
            require(isinstance(value, int) and value >= 0, 'invalid account: ' + key)
    for key in [k[:-6] for k in state if k.startswith('source.') and k.endswith('.cap_q')]:
        require(state[key + '.cap_q'] == state[key + '.unused_q'] +
                state[key + '.rearPaid_q'] + state[key + '.frontIssued_q'],
                'source capacity conservation: ' + key)
    for key in [k[:-6] for k in state if k.startswith('transport.') and k.endswith('.cap_q')]:
        require(state[key + '.equipmentUsed_q'] + state[key + '.frontUsed_q'] <= state[key + '.cap_q'],
                'transport capacity exceeded')
    for u in ids(state, 'unit'):
        pre = 'unit.' + u + '.'
        require(0 <= state[pre + 'step'] < state[pre + 'maxStep'],
                'fixture outside living-unit arithmetic scope')
        require(state[pre + 'stock_q'] >= 0 and 0 <= q(state[pre + 'D']) <= 3, 'unit range')


def source_pay(state, side, epoch, amount, purpose):
    require(isinstance(amount, int) and amount >= 0, 'invalid SP quantity')
    pre = f'source.{side}.E{epoch}.'
    require(state[pre + 'unused_q'] >= amount, 'source overdraw')
    add(state, pre + 'unused_q', -amount)
    add(state, pre + purpose, amount)
    add(state, f'tally.{side}.issued_q', amount)


def own(state, uid, epoch, owner, due, paid, arrears_paid=0):
    pre = f'maintenance.{uid}.E{epoch}.'
    require(pre + 'owner' not in state, 'duplicate maintenance Owner')
    state.update({pre + 'owner': owner, pre + 'due_q': due,
                  pre + 'paidCurrent_q': paid, pre + 'paidArrears_q': arrears_paid})


def event(state, e):
    """Calculate solely from state and event input; no expected values here."""
    x, kind = e['input'], e['kind']
    t = e['at'][0]
    if kind == 'open_epoch':
        for side, cap in x['caps_q'].items():
            pre = f'source.{side}.E{t}.'
            require(pre + 'cap_q' not in state, 'epoch opened twice')
            state.update({pre + 'cap_q': cap, pre + 'unused_q': cap,
                          pre + 'rearPaid_q': 0, pre + 'frontIssued_q': 0})
        for side, cap in x.get('transportCaps_q', {}).items():
            pre = f'transport.{side}.E{t}.'
            state.update({pre + 'cap_q': cap, pre + 'equipmentUsed_q': 0, pre + 'frontUsed_q': 0})
    elif kind == 'accept':
        o = 'order.' + x['orderId'] + '.'
        require(state[o + 'status'] == 'DRAFT', 'order not draft')
        require(x['legalGiven'] is True, 'order legality not given')
        for mat in ('P', 'E2'):
            move(state, state[o + 'side'], mat, 'available', 'escrow', state[o + 'recipe' + mat])
        state.update({o + 'status': 'ASSEMBLING', o + 'acceptedTurn': t})
    elif kind == 'rear':
        o = 'order.' + x['orderId'] + '.'
        require(state[o + 'status'] in ('ASSEMBLING', 'WAITING_ENTRY'), 'not a rear order')
        side, due, debt = state[o + 'side'], state[o + 'B_q'], state[o + 'arrears_q']
        cap = state[f'source.{side}.E{t}.unused_q']
        total = min(debt + due, cap)
        old = min(debt, total)
        paid = total - old
        own(state, state[o + 'plannedId'], t, 'REAR', due, paid, old)
        source_pay(state, side, t, total, 'rearPaid_q')
        add(state, f'tally.{side}.rearConsumed_q', total)
        state[o + 'arrears_q'] = debt + due - total
        state[o + 'lastPaidEpoch'] = t if state[o + 'arrears_q'] == 0 else state[o + 'lastPaidEpoch']
    elif kind == 'advance':
        o = 'order.' + x['orderId'] + '.'
        require(state[o + 'status'] == 'ASSEMBLING', 'not assembling')
        require(f'maintenance.{state[o + "plannedId"]}.E{t}.owner' in state, 'missing rear receipt')
        if state[o + 'arrears_q'] == 0 and state[o + 'lastPaidEpoch'] == t:
            add(state, o + 'workDone', 1)
            if state[o + 'workDone'] == state[o + 'workNeeded']:
                for mat in ('P', 'E2'):
                    move(state, state[o + 'side'], mat, 'escrow', 'embodied', state[o + 'recipe' + mat])
                state.update({o + 'status': 'WAITING_ENTRY', o + 'completedEpoch': t,
                              o + 'eligibleTurn': t + 1})
    elif kind == 'entry':
        o = 'order.' + x['orderId'] + '.'
        require(state[o + 'status'] == 'WAITING_ENTRY', 'not waiting')
        if not x['legalGiven']:
            return  # Conditional rejection, not a Core legality test.
        require(t >= state[o + 'eligibleTurn'] and state[o + 'arrears_q'] == 0
                and state[o + 'lastPaidEpoch'] == t - 1, 'entry timing/debt')
        uid, side = state[o + 'plannedId'], state[o + 'side']
        require(uid not in ids(state, 'unit'), 'ID already deployed')
        state.update({'unit.' + uid + '.' + k: v for k, v in
                      {'side': side, 'stock_q': 0, 'D': 0, 'step': 0, 'maxStep': state[o + 'maxStep'],
                       'weight': state[o + 'weight'], 'B_q': state[o + 'B_q']}.items()})
        state.update({o + 'status': 'DEPLOYED', o + 'enteredTurn': t, o + 'firstActionTurn': t})
        add(state, 'R.' + side, state[o + 'weight'])
    elif kind == 'front':
        u = 'unit.' + x['unitId'] + '.'
        side, due = state[u + 'side'], state[u + 'B_q']
        received = x['received_q']  # Given delivery, not solved route/allocation.
        source_pay(state, side, t, received, 'frontIssued_q')
        tr = f'transport.{side}.E{t}.'
        if tr + 'cap_q' in state:
            add(state, tr + 'frontUsed_q', received)
        paid = min(due, state[u + 'stock_q'] + received)
        own(state, x['unitId'], t, 'FRONT', due, paid)
        add(state, u + 'stock_q', received - paid)
        add(state, f'tally.{side}.frontConsumed_q', paid)
        d = q(state[u + 'D'])
        d = max(0, d - 1) if paid == due else min(3, d + Fraction(due - paid, due))
        require(d < 3, 'D>=3 attrition is outside these short fixtures; do not simulate it')
        state[u + 'D'] = number(d)
    elif kind == 'dispatch':
        side, qty = x['side'], x['quantityE2']
        tr = f'transport.{side}.E{t}.'
        net = sum(max(0, state[f'unit.{u}.B_q'] - state[f'unit.{u}.stock_q'])
                  for u in ids(state, 'unit') if state[f'unit.{u}.side'] == side)
        load = qty * x['loadPerE2_q']
        require(state[f'source.{side}.E{t}.unused_q'] >= net, 'maintenance source certificate fails')
        require(state[tr + 'cap_q'] - state[tr + 'equipmentUsed_q'] - load >= net,
                'maintenance corridor certificate fails')
        require(qty <= x['givenDestinationSpaceE2'], 'destination storage')
        move(state, side, 'E2', 'rear', 'transit', qty)
        add(state, tr + 'equipmentUsed_q', load)
        pre = 'shipment.' + x['batchId'] + '.'
        require(pre + 'status' not in state and x['L'] >= 1, 'batch identity/lag')
        state.update({pre + k: v for k, v in {'side': side, 'qtyE2': qty, 'dispatchEpoch': t,
                     'L': x['L'], 'dueEpoch': t + x['L'] - 1, 'status': 'IN_TRANSIT',
                     'availableTurn': None, 'receivedEpoch': None}.items()})
    elif kind == 'arrival':
        pre = 'shipment.' + x['batchId'] + '.'
        require(state[pre + 'status'] in ('IN_TRANSIT', 'HELD') and t >= state[pre + 'dueEpoch'],
                'early or repeated arrival')
        if x['unloadingLegalGiven']:
            move(state, state[pre + 'side'], 'E2', 'transit', 'deliveredLocked', state[pre + 'qtyE2'])
            state.update({pre + 'status': 'RECEIVED', pre + 'receivedEpoch': t, pre + 'availableTurn': t + 1})
        else:
            state[pre + 'status'] = 'HELD'
    elif kind == 'attempt_future_use':
        pre = 'shipment.' + x['batchId'] + '.'
        require(state[pre + 'status'] != 'RECEIVED' or t < state[pre + 'availableTurn'],
                'fixture no longer demonstrates future-use rejection')
        require(state[f'acct.{state[pre + "side"]}.E2.available'] < x['neededE2'],
                'fixture already has available equipment')
    elif kind == 'repair':
        u = 'unit.' + x['unitId'] + '.'
        require(x['legalGiven'] and state[u + 'step'] > 0, 'repair precondition')
        for mat in ('P', 'E2'):
            move(state, state[u + 'side'], mat, 'available', 'repairConsumed', x['cost' + mat])
        add(state, u + 'step', -1)  # No RP account is charged in this conditional PE example.
    elif kind == 'given_damage':
        require(x['externalConditionalReceipt'] is True, 'missing conditional damage input')
        add(state, 'unit.' + x['unitId'] + '.step', x['steps'])
    elif kind == 'assumed_noop':
        require(x['reason'] in ('SAME_ACTION_REPLAY', 'SAME_EPOCH_REPLAY', 'PAYLOAD_CONFLICT_REJECTED'),
                'unknown conditional no-op')
        # Specifies expected zero economic effect, does NOT implement server idempotency.
    else:
        raise Invalid('unknown event ' + kind)


def changes(before, after):
    result = {}
    for k in sorted(before.keys() | after.keys()):
        if k in before and k in after and before[k] == after[k]:
            continue
        a, b = before.get(k), after.get(k)
        delta = None
        if a is not None and b is not None:
            try:
                delta = number(q(b) - q(a))
            except ValueError:
                pass
        result[k] = {'before': a, 'delta': delta, 'after': b}
    return result


def replay(case):
    state = copy.deepcopy(case['before'])
    initial = copy.deepcopy(state)
    trace = []
    previous = (0, 0)
    invariants(state, initial)
    for e in case['events']:
        require(tuple(e['at']) >= previous, 'event order goes backwards')
        previous = tuple(e['at'])
        before = copy.deepcopy(state)
        event(state, e)
        invariants(state, initial)
        delta = changes(before, state)
        require(delta == e['expectedDelta'], 'event delta differs: ' + e['id'])
        trace.append({'id': e['id'], 'computedDelta': delta})
    require(state == case['expectedAfter'], 'final expectedAfter differs: ' + case['id'])
    metrics = {s: score(state, s) for s in ('G', 'S')}
    require(metrics == case['expectedMetrics'], 'final R/L/F differs')
    return {'id': case['id'], 'events': len(trace), 'status': 'PASS_CONDITIONAL_ARITHMETIC',
            'trace': trace, 'computedAfter': state, 'computedMetrics': metrics}


def negative_checks(cases):
    """Deliberately inconsistent inputs must fail; no game execution involved."""
    found = {c['id']: c for c in cases}
    tests = []
    def reject(name, cid, mutate):
        c = copy.deepcopy(found[cid])
        mutate(c)
        try:
            replay(c)
        except Invalid as error:
            tests.append({'name': name, 'result': 'REJECTED', 'reason': str(error)})
        else:
            raise Invalid('negative control unexpectedly passed: ' + name)
    def pick(c, kind):
        return next(e for e in c['events'] if e['kind'] == kind)
    reject('P overdraft', 'C01', lambda c: c['before'].__setitem__('acct.G.P.available', 2))
    reject('source capacity reduced', 'C08', lambda c: pick(c, 'open_epoch')['input']['caps_q'].__setitem__('G', 1))
    reject('double Owner', 'C01', lambda c: c['events'].insert(3, copy.deepcopy(c['events'][2])))
    reject('nonzero free entry stock', 'C03', lambda c: c['expectedAfter'].__setitem__('unit.G1.stock_q', 4))
    reject('blocked entry falsely counted in R', 'C02', lambda c: c['expectedAfter'].__setitem__('R.G', 8))
    reject('arrival usable on same T', 'C06', lambda c: c['expectedAfter'].__setitem__('shipment.B6.availableTurn', 24))
    reject('freight exceeds shared capacity', 'C04', lambda c: pick(c, 'dispatch')['input'].__setitem__('quantityE2', 7))
    reject('old arrears silently dropped', 'C08', lambda c: c['expectedAfter'].__setitem__('source.G.E6.rearPaid_q', 4))
    reject('C09 subsequent damage omitted', 'C09', lambda c: c['events'].remove(pick(c, 'given_damage')))
    reject('C09 combat moved before recovery', 'C09', lambda c: pick(c, 'given_damage').__setitem__('at', [24, 30]))
    reject('replay charged again', 'C03', lambda c: pick(c, 'assumed_noop')['expectedDelta'].__setitem__(
        'acct.G.P.available', {'before': 3, 'delta': -3, 'after': 0}))
    return tests


def layout_check(source, review):
    nodes = source['nodes']
    visual = {n['id']: n for n in nodes}
    require(len(visual) == len(nodes), 'duplicate visual node')
    require({n['visualNodeId'] for n in review['nodes']} == set(visual)
            and len(review['nodes']) == len(nodes), 'review/source node mismatch')
    cross, intra, occupied, reservations = {}, {}, {}, []
    for n in nodes:
        for cell in {c['paper'] for c in n['involvedCells']}:
            occupied.setdefault(cell, []).append(n['id'])
        facility = n.get('industrial')
        if facility:
            reservations.extend(facility['reservationCells'])
            shared = sorted(set(n['cityCells']) & set(facility['reservationCells']))
            intra[n['id']] = shared
    cross = {k: v for k, v in occupied.items() if len(v) > 1}
    require(not cross, 'cross-node spatial overlap needs review')
    require(set(visual['N07']['cityCells']) == {'AC10', 'AC11', 'AD10'}, 'capital group changed')
    require({n['industrial']['facilityCell'] for n in nodes if n.get('industrial')}
            == {'J7', 'M14', 'R9', 'AD9'}, 'facility candidates changed')
    require(len(reservations) == len(set(reservations)) == 12, 'facility reservation overlap/count')
    groups = []
    for n in review['nodes']:
        require(n['layoutSourceCommit'] == review['layoutSourceCommit'], 'layout ref mismatch')
        require(n['reviewGroupId'] == visual[n['visualNodeId']]['cityGroupId'], 'group reference mismatch')
        groups.append(n['reviewGroupId'])
        for k in ('objectiveId', 'initialOwner', 'homeSide', 'captureHexes', 'occupationPolicy',
                  'vpValue', 'willPressureKey', 'industrialOutput', 'supplySourceIds'):
            require(n[k] is None, 'unapproved functional/ownership assignment: ' + k)
    require(len(set(groups)) == len(groups), 'multiple visual groups assigned same review group')
    return {'status': 'PASS_SPATIAL_REFERENCE_ONLY', 'crossNodeOverlap': cross,
            'sameGroupCityAndFacilityCells': intra, 'capitalVisualCells': visual['N07']['cityCells'],
            'uniqueFacilityReservationCells': len(set(reservations)),
            'facilityTransferConditions': {n['id']: n['industrial']['facilityToLoading']
                                           for n in nodes if n.get('industrial')},
            'approvedObjectiveCount': 0, 'unresolvedHomeSideGroups': len(groups),
            'scoringRule': 'one future objectiveId per approved physical group, never per role/cell',
            'notProven': ['capture predicates', 'wartime paths', 'unit/asset visual occlusion',
                          'VP values', 'homeSide', 'industrial yields', 'new supply sources']}


def layout_negative_checks(source, review):
    tests = []
    for name in ('duplicate visual node', 'assign unapproved objective', 'infer homeSide', 'freeze industrial yield'):
        a, b = copy.deepcopy(source), copy.deepcopy(review)
        if name == 'duplicate visual node':
            a['nodes'].append(copy.deepcopy(a['nodes'][0]))
        else:
            key, value = {'assign unapproved objective': ('objectiveId', 'N07'),
                          'infer homeSide': ('homeSide', 'SOVIET'),
                          'freeze industrial yield': ('industrialOutput', 1)}[name]
            b['nodes'][0][key] = value
        try:
            layout_check(a, b)
        except Invalid as exc:
            tests.append({'name': name, 'result': 'REJECTED', 'reason': str(exc)})
        else:
            raise Invalid('layout negative control passed: ' + name)
    return tests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixtures', type=Path, default=Path(__file__).with_name('fixtures.json'))
    parser.add_argument('--layout-source', type=Path, default=Path(__file__).with_name('layout-source.json'))
    parser.add_argument('--layout-review', type=Path, default=Path(__file__).with_name('layout-review.json'))
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    raw = args.fixtures.read_bytes()
    data = json.loads(raw)
    require(data['contractVersion'] == 'CAMPAIGN-SETTLEMENT-002-candidate.1', 'wrong candidate')
    require(data['decisionRef'] == 'LEADER-RULE-CAMPAIGN-002-20261002', 'missing review decision')
    expected_ids = {f'C{i:02d}' for i in range(1, 10)} | {'C04-without-freight', 'C06-unloading-blocked'}
    require({c['id'] for c in data['cases']} == expected_ids and len(data['cases']) == len(expected_ids),
            'missing or duplicate original case/subcase')
    layout_raw = args.layout_source.read_bytes()
    layout, review = json.loads(layout_raw), json.loads(args.layout_review.read_bytes())
    require(hashlib.sha256(layout_raw).hexdigest() == review['sourceSha256'], 'layout source bytes changed')
    require(review['layoutSourceCommit'] == '2aa9a655e2906667929f3828d4dd6f58d7286ea2', 'layout commit changed')
    output = {'status': 'PASS_OFFLINE_CONDITIONAL_ARITHMETIC_ONLY', 'decisionRef': data['decisionRef'],
              'fixtureSha256': hashlib.sha256(raw).hexdigest(),
              'verifierSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'cases': [replay(c) for c in data['cases']],
              'negativeControls': negative_checks(data['cases']) if args.self_test else [],
              'layout': layout_check(layout, review),
              'layoutNegativeControls': layout_negative_checks(layout, review) if args.self_test else [],
              'notProven': ['Core legality', 'real transport routes/allocation', 'transaction idempotency/rollback',
                            'runtime integration', 'full campaign balance/survival', 'approved VP/homeSide/industrial output']}
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (Invalid, KeyError, TypeError, ValueError) as exc:
        print(json.dumps({'status': 'FAIL', 'error': str(exc)}, ensure_ascii=False))
        sys.exit(1)
