# Task 002D-1 — Soviet Reinforcement Availability

## Availability derivation

Soviet reinforcement availability is derived, never stored as a runtime queue:

`Scenario schedule -> deterministic slots -> scheduledTurn <= current turn -> minus accepted DEPLOY_REINFORCEMENT actions -> Available Reinforcements`.

A scheduled slot remains available on later turns until an accepted deployment action consumes it. Rejected deployment attempts do not consume it, and a deployed unit's later destruction does not return the slot to the pool.

Canonical slot ids use `S-R-T{TURN}-G{GROUP}-U{UNIT}` with two-digit minimum padding. Group and unit ordinals are 1-based positions in canonical Scenario rule data.

## Legal East Exit derivation

A legal entry is derived only from the east-exit-only Soviet rail graph:

`Scenario Soviet East Exit -> active East-only rail seed -> no live German occupation -> not in canonical German ZOC -> living stack below rules.stackingLimit -> Legal Entry`.

Independent Soviet supply sources do not become reinforcement entries unless a Scenario also explicitly lists the same hex in `sovietEastRailExits`. German ZOC uses unit-template `exertsZoc`; adjacent non-ZOC support units therefore do not block entry. Dead units do not occupy or consume stacking capacity.

`hasDeployableSovietReinforcement()` is a pure board/schedule query: at least one available slot **and** at least one legal entry. It deliberately does not enforce phase legality.

## Deferred to Task 002D-2

Task 002D-1 does not create `UnitState`, assign controller ownership, modify stacking, refresh Soviet supply, alter the Ready barrier, block phase completion, or execute deployment. `DEPLOY_REINFORCEMENT` remains an explicitly recognized but `RULE_NOT_IMPLEMENTED` RulesEngine transition until Task 002D-2.
