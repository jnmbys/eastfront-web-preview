# BLACKICE-001 frozen first candidate

Baseline da2126d1170b65b83651c279413da36576c819c8. Independent rules/save profile; no old-save import. No public deployment.

Reference frozen at BlackIce-HOI4/blackice_v4.0 commit 649a5410d9ea527a4f1618b58060f7cb9033f781 (2026-10-06), read 2026-10-11. Its descriptor is 12.3.0 / HOI4 1.19.2.0; the Steam page advertises 12.1.0. We use the fixed source, not an invented common version. Official guide 2366487639 warns it is outdated. No general redistribution license found; no BICE code or art is copied. Scalar facts and concepts are referenced, algorithms here are original project adaptations.

| Area | Previous combined campaign | First candidate | Basis / intended consequence |
|---|---|---|---|
| Time / space | 5 min; layered march multipliers | 5 min; 10 km/hex divided by actual km/h | Project physical scale; no deadline, territorial surrender retained |
| Infantry | 1000 people / 100 rifle sets | 1250 / 125 | BICE infantry.txt; uniforms folded into a rifle set, no independent uniform production |
| Artillery | 24 guns | 700 people / 12 guns | BICE artillery_brigade; horses abstracted, no extra horse inventory |
| AT | unavailable | 600 people / 24 AT-1941; support 300 / 12 | BICE anti_tank_brigade, anti_tank and equipment/anti_tank model 2 |
| Weapons | vanilla rifle, gun, truck; complete LT-0 | BICE rifle1 (.48), gun1 (6), truck1 (5), AT2 (4.5); existing complete LT-0 retained | Costs are work per piece, not money; tank is explicitly NOT a verified BICE design |
| Fire | .1/.4 hit, .06/.053 loss, hidden 24x tempo | .15/.37 hit, .10/.05 loss, 6 fire cycles/hour | Hit/loss scalar facts from 00_defines; continuous time factor 6 is project adaptation, not BICE engine reproduction |
| Armor | .4 max + .6 mean; four brackets | .225 max + .775 mean armor; piercing remains .4/.6; 7 partial-piercing brackets | Armor and piercing brackets from BICE definitions; aggregation and continuous resolution are declared adaptations |
| Terrain / works | mostly unit terrain adjustments | explicit terrain attack/width; river crossing penalty; time-built entrenchment and effective engineers | BICE terrain relationships; bounded project implementation, not new weather generator |
| Organization | unweighted slot average | manpower-weighted positive org values | Project adaptation: do not blindly average BICE negative artillery org modifiers as absolute maxima |
| Daily supply | abstract need occupies hourly freight | tonnes/day / 24, activity factor; shared tonnes/hour | Fix dimensional mismatch. Infantry 8, gun 18, AT 6, motor 12, tank 32 t/day are explicit project ration/ammunition bundles |
| Cargo | 25 guns/trucks or 10 tanks per work | people .1, rifle .01, support .05, gun1.5, AT1.2, truck3, tank8 tonnes | Planning gross weights, not measured exact vehicle masses; cross-hour reservation retained |
| Fuel | abstract units, .5 work/unit | unit=100L; .5 work/unit retained; .08 tonnes/unit | Existing model consumption becomes hundreds of litres/hour; no new oil/refinery system |
| Industry | 12 work/group/day; efficiency +.08/day | 120 work/group/day; +.015/day, cap .8; switch retains .25 | One map military facility represents 10 workshop equivalents; resource values are concurrent capacity, not daily inventory |
| Construction | 6 work/day, factory30 | 30 work/day; MIL1800, CIV2100, hub300, railway36/10km, rail repair60 | Project weeks-long investment; operations/repair can matter in days |
| Reception | 300 people and 10 pieces/model/day | same 300 people; 50 rifle, 10 support, 4 gun/AT, 4 trucks, 2 tanks/day | Separate reception, production and physical transport caps |
| Wear | combat-only equipment loss | deterministic fractional reliability wear during movement/combat, integer losses | Project formula .004/.008 exposure/day × (1-reliability), no wear while resting; conserved losses |

Initial manifest: same permanent units/positions/cities. Two infantry battalions per ordinary formation, visible repeating specialist slots (infantry+gun, infantry+AT, motor, motor+LT-0). Both sides get the same role cycle, no hidden faction bonus and no historical OOB claim. Per-side explicitly finite depot reserve: rifles600, support60, guns24, AT24, trucks100, tanks12, trains8, fuel400 (40,000L), personnel 4,800. Existing industry count and resource geography remain; no recurring free replenishment. The side differences in this first candidate remain geography and city/transport/control distribution, not a validated German/Soviet doctrine model.

Training experience remains saved but no unverified training combat multiplier. Existing formation fees/XP and pro-rata personnel allocation retained. Recon does not invent hidden intelligence. Diplomacy, air/naval warfare, research, detailed uniform/horse/ammunition factories, BICE tank modules, historical national doctrines and dynamic weather remain outside this candidate. Existing observed weather is only applied if actually present; no claim of a weather system otherwise.

## Dispatch, arrival and recovery

Personnel and equipment dispatch reserve actual stock and pay the existing shared transport work. They are not usable until arrival: 15 minutes loading + 20 minutes per 10 km rail edge + terrain/road-weighted last-mile distance at 10 km/h motorized or 5 km/h basic delivery. Saved escrow is included in conservation totals. Broken/captured route, target movement, replacement or death cancels to the original national pool; spent capacity is not refunded. This is a project abstraction: returns are accounting returns, not a separately simulated return journey. Daily supply and fuel remain capacity-limited same-period flow, not individual delayed parcels.

Movement additionally costs .1 normalized organization per 5 minutes, retaining the prior 2-point arrival fatigue. Rest restores .25 normalized organization per step times supply availability. A fully supplied idle formation therefore needs about 33h20m to recover from 0 to 100; from 30 to 80 takes 16h40m. These are rates, not guarantees during movement/combat. Foot speed is 4km/h before terrain/roads/supply, so 96km/day is the uninterrupted theoretical ceiling, not sustainable operational advance.

Fortification accrues while stationary and out of contact, reaches its effect after 24h, persists during combat, and resets on movement/withdrawal: up to 10% defense plus 5% times actual engineer satisfaction. No free engineer effect when support equipment is missing.

See `evidence/blackice-001/time-audit.json` for final-code production, reception and transport lower bounds. They are separate constraints, not additive promised arrival times. A fully missing infantry battalion needs at least 4.17 days personnel reception and 2.5 days rifle reception; one dedicated factory at initial efficiency .3 needs about 1.60 days for 125 rifles with full resources. Shared capacity and travel can extend all of these.

## R1 diagnosis and version boundary

`BLACKICE-001-LAND-1-R1` changes only tactical recovery persistence across automatic order/risk replanning. RECOVER retains its existing cooldown and personnel/organization/supply release checks. Explicit player changes still use existing authority invalidation. LAND-1 remains available with its original behavior and save namespace. Neither class imports the other version; no user save conversion.

The original forced-contact harness neither withdraws nor applies replenishment/rest. Its raw org<5 cutoff is not the campaign's normalized org<18 check. Forty-eight hours is a test budget, never a battle deadline. All48 first-version cases reproduce exactly: six infantry budget stops,42 personnel eliminations. No in-combat resting recovery was observed in the traced campaign contacts; the existing25% organization floor applies only on completed physical withdrawal, not during combat. Its possible upward jump is explicitly tested and retained, not a new R1 feature.

Current mean raw org loss / HP loss is (.05×2.5)/(.10×1.5)=5/6. A25HP/35org infantry battalion consequently has about14.17org remaining after25HP-equivalent expected damage; its18% retreat threshold is6.3org. This is an approximate ratio diagnostic (random rolls, changing strength and damage allocation remain relevant), not a future outcome predictor. It exposes a genuine strength/org pacing concern, not a unit-conversion error. Infantry's weak breakthrough and declining equipped strength also prolong symmetric forced contact. No new coefficients or BICE claims were introduced. Damage-ratio calibration remains pending review.

Directed actual-authority controls permit ordinary supply, fuel, AI, timed retreat and replenishment; they share original initial templates/equipment/seed but are not a controlled comparison varying retreat alone. The normal48h campaign script is separately retained. R1 does not make retreat safe: artillery still causes severe casualties during travel; manual contact can eliminate personnel before collapse. Recovery preservation fixes one repeat-withdrawal case, not the entire loss model. See DELIVERY and R1-DIAGNOSIS for adverse results, held-out seeds and reproducible commands. No changes to source-derived stats, project rates, inventory or transport.
