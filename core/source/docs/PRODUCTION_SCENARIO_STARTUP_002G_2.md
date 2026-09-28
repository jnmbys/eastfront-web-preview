# Production Scenario Startup — 002G-2

`defaultScenario` now uses FA-003 free deployment with the authoritative production roster:

- Germany: 26 units — 11 Infantry, 2 Jäger, 4 Panzer, 3 Motorized, 2 Artillery, 2 Engineer, 2 Recon.
- Soviet: 32 units — 16 Infantry, 2 Elite Infantry, 3 Tank, 2 Motorized, 1 Heavy Tank, 3 Anti-Tank, 3 Artillery, 2 Engineer.
- No HQ units are part of the MVP initial roster.

Deployment remains scenario-driven:

```text
reference/strategic-reset-f-map.json
        ↓ importLegacyMap()
defaultScenario.deployment
        ↓
SOVIET_DEPLOYMENT
        ↓ hidden side views
GERMAN_DEPLOYMENT
        ↓ hidden side views
German final Ready
        ↓
Turn 1 initialization
        ↓
GERMAN_SUPPLY_RAIL
```

Germany uses `WESTERNMOST_COLUMNS` with `columnCount: 3`, derived from actual map q-columns. The Soviet zone is `COMPLEMENT_OF_SIDE_ZONE` excluding the German zone. LAKE hexes remain illegal. Stacking remains the Digital Core rule `rules.stackingLimit` (currently 2 total living units per hex).

The production smoke imports the real Strategic Reset F map, audits the exact 26/32 roster and template mapping, proves real-map capacity, mechanically places units with canonical Actions, checks hidden deployment views and integrity, enters German Turn 1, and exact-replays the canonical setup Actions. The mechanical placement is test-only and is not AI policy or a fixed historical setup.

`initialUnits` remains empty: production setup is free deployment, not fixed placement. Existing combat, supply, recovery, reinforcement, victory, headless replay, and FA-003 secrecy semantics are unchanged.
