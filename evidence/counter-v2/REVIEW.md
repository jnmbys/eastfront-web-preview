# Counter V2

Parent: 47eddbef5f868fad2486c08ad6e857379563dcf3.

Muted blue-grey German and red-brown Soviet faces, DE/SU identity labels, ivory symbols, inset enamel border and dark numerical band. Engineer is represented by a bridge-like symbol, AT by a barred triangle; infantry cross, armor oval, artillery dot and reconnaissance diamond remain recognizable abstract military symbols. Long IDs compress within the header allocation. Symbols dominate; numerical attack-defense-movement values are passed through unchanged.

Damage levels use the existing step value: full, one slash, two slashes with a broken edge and faded level-2 symbol. Existing eliminated-unit filtering is untouched; no destroyed unit is reintroduced on-map. Supply and entrenchment markers use existing projected state only. Top stacked unit shows the exact same-hex count. Placement, offsets, touch hit areas, IDs, tab focus and selection handlers are unchanged, including B1.1 deployment-counter targeting. Selected gold border/glow, keyboard focus border and pressed inset are cosmetic.

No echelon/formation-size field is exposed by CounterModel; no battalion/regiment/division indicator is fabricated. Stack count indicates units in a hex, not formation size.

Validation: typecheck PASS; build PASS; 60/60 targeted tests PASS (counter V2, Core integration, geometry, interaction and loader). Tests exercise identity, anchors, immutable values, damage markers, stack badge, supply and entrenchment projections. No Core, Geometry, Scenario, Combat, Unit rules, Supply, VS2 or Terrain changes. Production edits confined to Counter functions in coreSvg.ts and Counter CSS.

COUNTER-V2.svg/PNG are enlarged 2x presentation fixtures rendered by the production Counter function and production stylesheet. Fixture values are illustrative and not scenario modifications. Rows: German full, Soviet full, German selected level-1 damage, Soviet level-2 damage/out-of-supply; bottom shows a stack. PNG rendered with Sharp/librsvg, not a browser screenshot. Export source is included. Visual inspection led to separation of entrenched/damage symbols and header compression.

Known issues: real map zoom, touch device legibility and browser filter rendering remain unverified. At far zoom small IDs/stats will remain hard to read; no zoom-based counter behavior was introduced. Existing multi-unit stack positioning is preserved. Formation scale unavailable as noted above. No one-second recognition or final device acceptance claim.
