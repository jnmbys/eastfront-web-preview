"""INDUSTRY-DESIGN-001: offline arithmetic only; imports no game/runtime code.

All numbers except the 15 settlement / German T16 horizon and infantry 1 SP
maintenance are design assumptions. Aggregate SP is an optimistic capacity
bound, NOT the supply optimizer, a legal Core replay, or combat simulation.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(route, source_cap=22, expanded_from=4, cargo_base=21, old_units=8):
    rear = depot = 0
    personnel = 60
    new_units = repaired = attacks = maintenance = injected = 0
    initial_supply = 3 * old_units
    reserve = initial_supply  # new formations receive zero
    missing = 2
    produced = purchased = spent_equipment = 0
    new_unit_turns = 0
    rows = []
    for turn in range(1, 17):
        units = old_units + new_units
        new_unit_turns += new_units
        if 3 <= turn <= 15:
            missing += 1  # identical exogenous old-unit damage, before actions
        repair_planned = int(turn < 16 and missing > 0 and depot > 0 and personnel > 0)
        # The reserved recovery unit must rest; no target/CRT prediction.
        attack = min(units - repair_planned, reserve)
        reserve -= attack
        attacks += attack
        repair = formed = output = requisition = shipped = supplied = paid = 0
        if turn < 16:
            if missing and depot and personnel:
                repair = 1
                missing -= 1
                depot -= 1
                personnel -= 1
                repaired += 1
                spent_equipment += 1
            # One assembly slot, 3 equipment + 3 trained personnel. Ready T+1.
            # Fixed 17-unit ceiling reserves maintenance under 4 equipment loads.
            if depot >= 3 and personnel >= 3 and units < 17:
                formed = 1
                depot -= 3
                personnel -= 3
                spent_equipment += 3
        # No E16: the real campaign ends at German T16 end.
        if turn < 16:
            output = 2 + (2 if route == "industry" and turn >= expanded_from else 0)
            requisition = 12 if route == "army" and turn == 1 else 0
            produced += output
            purchased += requisition
            rear += output + requisition
            cargo = cargo_base + (6 if route == "logistics" and turn >= 3 else 0)
            new_units += formed
            next_units = old_units + new_units
            shipped = min(4, rear, max(0, cargo - next_units))
            rear -= shipped
            depot += shipped
            supplied = min(source_cap, cargo - shipped, max(0, 4 * next_units - reserve))
            reserve += supplied
            paid = min(next_units, reserve)
            reserve -= paid
            injected += supplied
            maintenance += paid
            assert shipped + supplied <= cargo
            assert paid == next_units, "This case needs per-unit debt; don't fake it."
        assert produced + purchased == rear + depot + spent_equipment
        assert 60 == personnel + repaired + 3 * new_units
        assert initial_supply + injected == reserve + attacks + maintenance
        assert min(rear, depot, personnel, reserve) >= 0
        rows.append(dict(route=route, turn=turn, investment_spent=12 if turn == 1 and route != "control" else 0,
                         production=output, requisition=requisition, equipment_delivered=shipped,
                         repaired_this_turn=repair, assembly_orders=formed,
                         new_units_at_action=units-old_units, new_units_next_turn=new_units,
                         rear_equipment=rear, depot_equipment=depot, personnel=personnel,
                         missing_old_steps=missing, supply_received=supplied,
                         maintenance_paid=paid, attack_packages=attack, end_supply=reserve))
    return rows, dict(route=route, investment=0 if route == "control" else 12, equipment_produced=produced,
                      equipment_requisitioned=purchased, equipment_used=spent_equipment,
                      equipment_remaining=rear+depot, repaired_steps=repaired,
                      new_units=new_units, new_unit_turns=new_unit_turns,
                      attack_packages_upper_bound=attacks, supply_received=injected,
                      maintenance_paid=maintenance, supply_remaining=reserve,
                      personnel_remaining=personnel)


def main():
    all_rows, summaries = [], []
    for route in ("army", "industry", "logistics"):
        rows, summary = run(route)
        assert sum(row["investment_spent"] for row in rows) == 12
        all_rows += rows
        summaries.append(summary)
    with (ROOT / "ledger.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(all_rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(all_rows)
    sensitivity = []
    for label, options in [("same_setting_control", {}), ("higher_demand_10_old_units", {"old_units":10}), ("source_limited", {"source_cap":18}),
                           ("transport_already_ample", {"cargo_base":30})]:
        _, control = run("control", **options)
        _, logistics = run("logistics", **options)
        sensitivity.append(dict(case=label, control=control, logistics=logistics,
                                extra_attack_packages=logistics["attack_packages_upper_bound"]-control["attack_packages_upper_bound"],
                                extra_supply_received=logistics["supply_received"]-control["supply_received"]))
    _, late = run("industry", expanded_from=10)
    sensitivity.append(dict(case="late_first_extra_output_E10", industry=late))
    payload = dict(status="arithmetic checked; not balanced; not runtime simulation",
                   assumptions=dict(initial_investment=12, initial_personnel=60,
                                    old_infantry=8, initial_old_missing_steps=2,
                                    initial_supply_SP=24, base_equipment_per_settlement=2,
                                    source_SP_cap=22, base_shared_cargo=21,
                                    equipment_shipping_cap=4, personnel_income=0,
                                    investment_income=0, equipment_equals_SP=False),
                   routes=summaries, sensitivity=sensitivity)
    (ROOT / "ledger-summary.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n", encoding="utf-8", newline="\n")
    headers = ["T", "产/急拨", "运达E", "补旧/新编", "行动时新增师", "后方/前线E", "P余", "收SP/维护", "攻击包上界", "SP余"]
    text = ["# 三条短账本（全部为设计假设）", "", "生成：`python docs/industry-design-001/ledger.py`。解释、时序及限制见 DESIGN.md 第 5 节。E 是装备包，P 是已训练人员包；E 不等于 SP。T16 无结算。", ""]
    for route, name in [("army", "立即扩军"), ("industry", "投资工业"), ("logistics", "优先后勤")]:
        text += ["## " + name, "", "|"+"|".join(headers)+"|", "|"+"|".join(["---"]*len(headers))+"|"]
        for r in [x for x in all_rows if x["route"] == route]:
            cells = [r["turn"], f'{r["production"]}/{r["requisition"]}', r["equipment_delivered"],
                     f'{r["repaired_this_turn"]}/{r["assembly_orders"]}', r["new_units_at_action"],
                     f'{r["rear_equipment"]}/{r["depot_equipment"]}', r["personnel"],
                     f'{r["supply_received"]}/{r["maintenance_paid"]}', r["attack_packages"], r["end_supply"]]
            text.append("|"+"|".join(map(str,cells))+"|")
        text += [""]
    (ROOT / "LEDGERS.md").write_text("\n".join(text), encoding="utf-8", newline="\n")
    print(json.dumps(summaries, ensure_ascii=False, indent=2))
    print("PASS: equipment, personnel, supply, cargo and equal budget invariants for all 48 rows.")


if __name__ == "__main__":
    main()
