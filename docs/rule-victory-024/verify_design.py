"""Arithmetic examples for a DESIGN, not a game engine or runtime acceptance test.

No Core, supply, industry or AI imports. All constants are unbalanced hypotheses.
"""
from fractions import Fraction as Q
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
cases = []


def check(name, actual, expected):
    assert actual == expected, (name, actual, expected)
    cases.append(dict(name=name, actual=str(actual), expected=str(expected), passed=True))


def will(p, f, s):
    return max(Q(0), min(Q(100), 100-Q(p)-Q(f)-Q(s)))


def chronic_step(previous, fraction):
    target = 30*Q(fraction)
    return min(target, previous+5) if target > previous else max(target, previous-5)


def collapse_count(previous, p, f, s):
    eligible = will(p, f, s) <= 20 and sum([p >= 8, f >= 20, s >= 15]) >= 2
    return previous+1 if eligible else 0


def score(history):
    assert len(history) == 24
    return Q(56*history[-1]+sum(history), 80)


def outcome(delta):
    if delta >= 30:
        return 'G decisive'
    if delta >= 10:
        return 'G limited'
    if delta <= -30:
        return 'S decisive'
    if delta <= -10:
        return 'S limited'
    return 'draw'


check('design_objective_budget', 20+2*10+2*10+2*10+2*10, 100)
check('capital_loss_alone', will(8, 0, 0), 92)
check('capital_loss_no_collapse', collapse_count(0, 8, 0, 0), 0)
check('capital_plus_three_sites_and_60pct_loss', will(20, 40*Q(3, 5), 10), 46)
check('pressure_warning', will(24, 32, 25), 19)
check('first_warning_not_terminal', collapse_count(0, 24, 32, 25), 1)
check('second_warning_terminal', collapse_count(1, 24, 32, 25), 2)
check('recovery_resets_warning', collapse_count(1, 24, 32, 20), 0)
check('recovery_will', will(24, 32, 20), 24)
check('stock_empty_alone_not_surrender', will(0, 0, 30), 70)
check('logistics_rise_cap', chronic_step(0, Q(1)), 5)
check('logistics_no_overshoot', chronic_step(14, Q(1, 2)), 15)
check('logistics_recovery_cap', chronic_step(25, Q(0)), 20)
check('logistics_never_negative', chronic_step(3, Q(0)), 0)
check('site_reacquisition_no_bonus', will(0, 0, 0), 100)
check('repeated_loss_same_pressure', [will(p, 0, 0) for p in [8, 0, 8, 0]], [Q(92), Q(100), Q(92), Q(100)])
check('net_step_repair', 40*(4*Q(1, 3))/4, Q(40, 3))
check('destroyed_ids_not_removed_from_reference', 40*Q(4, 8), 20)
check('reinforcement_not_erase_destroyed_loss', 40*Q(4, 12), Q(40, 3))
check('whole_campaign_100pt_cap', score([100]*24), 100)
check('late_counteroffensive_G', score([20]*8+[40]*8+[70]*8), 62)
check('late_counteroffensive_S', score([80]*8+[60]*8+[30]*8), 38)
check('late_counteroffensive_result', outcome(Q(62)-38), 'G limited')
check('full_symmetry_draw', outcome(score([50]*24)-score([50]*24)), 'draw')
for delta, result in [(10, 'G limited'), (30, 'G decisive'), (-10, 'S limited'), (-30, 'S decisive'), (Q(999, 100), 'draw')]:
    check('exact_threshold_'+str(delta), outcome(delta), result)
# E24 first capture removes the old owner's points, but has not confirmed the new owner.
check('last_round_unconfirmed_capture_no_attacker_points', score([0]*24), 0)
check('last_round_unconfirmed_capture_denies_old_owner', score([10]*23+[0]), Q(23, 8))
check('simultaneous_second_collapse', (collapse_count(1, 24, 32, 25), collapse_count(1, 24, 32, 25)), (2, 2))

result = {
    'task': 'RULE-VICTORY-024',
    'date': '2026-10-02',
    'status': 'offline arithmetic only; design hypotheses; not runtime or balance acceptance',
    'parent': 'b8b2c50a48eb12f570151a632bf5bf9907dfbbf0',
    'report_sha256': hashlib.sha256((HERE/'REPORT.md').read_bytes()).hexdigest(),
    'passed': len(cases),
    'cases': cases,
    'not_tested': [
        'legal Core gameplay and supply settlement',
        'map objective placement, initial owners and role deduplication',
        'occupation and industrial confirmation state machines',
        'no-army exception and promised reinforcement authority integration',
        'loss/chronic history collection and information authorization',
        'T24 complete-round terminal transaction, idempotency and rollback',
        'scenario fairness, industrial return, AI and performance'
    ]
}
(HERE/'validation.json').write_bytes((json.dumps(result, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))
print(json.dumps({'passed': len(cases), 'status': result['status']}, ensure_ascii=False))
