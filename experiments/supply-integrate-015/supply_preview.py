"""Read-only own-unit action quote; no solver, execute, Core apply or RNG calls.

Factors come from the frozen executor. The small payment projection mirrors its
min(4, stock) charge and ARMOR allowlist; parity is tested against execute.
"""
from fractions import Fraction
from live import effects, ARMOR


def debt_inventory(debt, maintenance):
    # Debt is a dimensionless maintenance ratio, NOT an inventory integer.
    amount = Fraction(debt) * maintenance
    assert amount.denominator == 1
    return int(amount)


def action_preview(b, viewer, actions, draft):
    own = {u['id']: u for u in b['logistics']['units']
           if u['side'] == ('G' if viewer == 'GERMAN' else 'S')}
    out = dict(revision=b['revision'], draft=draft, rows=[])
    if b['mode'] != 'new':
        return out
    debt = effects(b['logistics'])
    for action in actions:
        attack = action['type'] in ('ATTACK', 'SCHWERPUNKT_ATTACK')
        ids = action['attackerUnitIds'] if action['type'] == 'ATTACK' else [action['unitId']]
        if len(set(ids)) != len(ids) or any(uid not in own for uid in ids):
            continue
        fx = effects(b['logistics'], action)
        for uid in ids:
            unit = own[uid]
            charged = attack or (action['type'] == 'MOVE' and b['core']['units'][uid]['type'] in ARMOR)
            cost = min(4, unit['stock']) if charged else 0
            out['rows'].append(dict(id=uid, type=action['type'], stock=unit['stock'],
                cost=cost, after=unit['stock']-cost, debt=unit['debt'],
                debtInventory=debt_inventory(unit['debt'], unit['B']),
                debtFactor=debt[uid]['factor'], attackFactor=fx[uid]['factor'] if attack else None))
    return out
