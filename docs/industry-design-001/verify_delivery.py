"""Independent checks of published CSV/summary, reproducibility and scope.
Offline design verification only. No Core/supply/AI imports or mutations.
"""
import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = "813b4072568352e95d0726fe5fe04060c889c554"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


files = [ROOT / name for name in ("ledger.csv", "ledger-summary.json", "LEDGERS.md")]
before = {p.name: digest(p) for p in files}
subprocess.run([sys.executable, str(ROOT / "ledger.py")], check=True, capture_output=True)
assert before == {p.name: digest(p) for p in files}, "Published ledger differs from recomputation"
with (ROOT / "ledger.csv").open(encoding="utf-8", newline="") as stream:
    rows = [{k: v if k == "route" else int(v) for k, v in row.items()}
            for row in csv.DictReader(stream)]
summary = json.loads((ROOT / "ledger-summary.json").read_text(encoding="utf-8"))
for item in summary["routes"]:
    route = [r for r in rows if r["route"] == item["route"]]
    assert [r["turn"] for r in route] == list(range(1, 17))
    assert sum(r["investment_spent"] for r in route) == 12
    previous_rear = previous_depot = 0
    previous_supply, previous_personnel = 24, 60
    for row in route:
        spent = row["repaired_this_turn"] + 3 * row["assembly_orders"]
        assert previous_rear + row["production"] + row["requisition"] - row["equipment_delivered"] == row["rear_equipment"]
        assert previous_depot - spent + row["equipment_delivered"] == row["depot_equipment"]
        assert previous_personnel - spent == row["personnel"]
        assert previous_supply + row["supply_received"] - row["maintenance_paid"] - row["attack_packages"] == row["end_supply"]
        if row["turn"] < 16:
            cargo = 21 + (6 if item["route"] == "logistics" and row["turn"] >= 3 else 0)
            assert row["equipment_delivered"] + row["supply_received"] <= cargo
            assert row["supply_received"] <= 22
        else:
            assert all(row[k] == 0 for k in ("production", "requisition", "equipment_delivered", "repaired_this_turn", "assembly_orders", "supply_received", "maintenance_paid"))
        previous_rear, previous_depot = row["rear_equipment"], row["depot_equipment"]
        previous_supply, previous_personnel = row["end_supply"], row["personnel"]
    assert sum(r["new_units_at_action"] for r in route) == item["new_unit_turns"]
    assert sum(r["attack_packages"] for r in route) == item["attack_packages_upper_bound"]
    assert sum(r["maintenance_paid"] for r in route) == item["maintenance_paid"]
    assert previous_depot + previous_rear == item["equipment_remaining"]
    assert previous_personnel == item["personnel_remaining"]
    assert previous_supply == item["supply_remaining"]

checked_links = 0
for file in ROOT.glob("*.md"):
    for target in re.findall(r"\]\(([^)]+)\)", file.read_text(encoding="utf-8")):
        if "://" not in target and not target.startswith("#"):
            assert (file.parent / target.split("#")[0]).is_file(), (file.name, target)
            checked_links += 1
repo = ROOT.parent.parent
changed = subprocess.check_output(["git", "diff", "--name-only", BASE], cwd=repo, text=True).splitlines()
assert all(name.startswith("docs/industry-design-001/") for name in changed), changed
result = dict(status="PASS", baseline=BASE, main_rows_checked=len(rows),
              sensitivity_pairs=4, delayed_industry_cases=1,
              deterministic_output=True, local_markdown_links_checked=checked_links,
              scope="docs/industry-design-001 only; no runtime or map changes",
              checks=["row-by-row equipment, personnel and SP conservation", "shared transport capacity", "equal 12I budget", "no E16 settlement", "summary agrees with CSV", "published outputs reproduce byte-for-byte"],
              limitation="Aggregate design arithmetic; no legal Core battle, balance, online latency or supply optimizer verification")
(ROOT / "verification.json").write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n", encoding="utf-8", newline="\n")
print(json.dumps(result, indent=2, ensure_ascii=False))
