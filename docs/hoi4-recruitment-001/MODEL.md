# HOI4-RECRUITMENT-001-1

Base: be902c68f9b20e3dd075f8ef1819f356e6fc0e6d; factory-conversion candidate remains pending independent review. No rotation candidate imported. Independent new saves only; old/new authorities reject each other's save versions.

## Reference and adaptation

Reference actually viewed: Paradox **Hearts of Iron IV Strategy Guide**, printed page 50, release-era UI (2016; not claimed to be 1.19.3 UI). Source: https://forumcontent.paradoxplaza.com/public/paradox/banners/HoI_IV_Strategy_Guide.pdf . Local original already under `docs/hoi4-construction-001/references/official-guide.pdf`; rendered reference `reference-guide-50.png` here. Its recruit/deploy queue is left, templates right, equipment/training progress and priority controls; these are implemented with existing project icons, not copied commercial artwork. Reference screenshot is partly covered by its own tooltip. No claim of pixel-perfect reconstruction.

The guide describes recruitment competing with reinforcements for production. This candidate explicitly keeps **field supply and field reinforcement first**, then recruitment queue priority. It does not implement HOI4's global three-way equipment priority sliders. Local 1.19.3 data contains infantry training_time=90, but that national-scale time is **not** used as if it matched this campaign. Recruitment uses the existing project training rate below; this is a stated adaptation, not an inferred HOI4 engine formula.

| Item | Implemented rule / provenance |
|---|---|
| Formal template | Own-side formal template/version frozen at enqueue. Subsequent editing cannot silently change its demand. Drafts not accepted. |
| Quantity | 1–4 each order; maximum 12 active rows per side. Repeated orders allow ongoing recruitment; no infinite auto-repeat. Project bounded queue. |
| Reception | Existing BLACKICE-RECEPTION-1: 300 persons/day; infantry50, support10, artillery/AT/trucks4, tanks2 pieces/day. No new rate bonus. |
| Goods/manpower | Existing integer inventory and province reserve reconciliation. Recruitment holds counted in the SAME conservation totals. National reserve is not a second province pool. |
| Transportation | Existing transportProgress allocator: train/rail/source/hub/shared spare capacity, real work reservation, 15min loading and existing weather/infrastructure-weighted physical segments. No transport cost refunds. |
| Training | Fully arrived establishment, safe connected city, and paid daily-supply transport required. Existing 0.02 XP/day, 0.5% held equipment wear/day; reach0.1 (five effective training days, shortages can prolong). No national XP. Project recruitment threshold, not veteran status. |
| Benefit/readiness | Existing training-experience recovery effect:0.1 yields +10% resting organization recovery; no added combat multiplier. Deploy with actual men/equipment, XP0.1 and organization0; recover normally. No free fuel/carried supply. |
| Deploy | Own original province's existing city, actually controlled, adjacent known land controlled, no visible enemy within2, rear network connected, below existing3-unit stack cap. Server auto-deploys once fully ready. No early deploy. |
| Capture/disconnection | Freeze recruitment and physical transit; no progress during blocked interval. Assets remain original-side escrow, inaccessible to occupier and not transferred by flag changes. Can resume on recapture. This is project abstraction, not literal prisoners/loot simulation. |
| Cancel | Stop outgoing requisition. Undeparted source reservation releases item only; spent work is lost. Outbound shipment keeps travelling; received goods/personnel require paid reverse transport before national return. Interrupted reverse transport stays escrowed. Permanently lost city can therefore keep cancellation pending. |

Recruitment is stored inside `divisionLedger.recruitment`, never as phantom map units. Only deployment registers the permanent unit, equipment template, supply/clock records, placement and province origin. It starts independently under HOLD; player may assign it to an existing corps. Existing movement loop now safely handles a unit without a corps instead of dereferencing a nonexistent officer. Existing corps behavior is unchanged.

New command types share economy generation protection and authoritative transaction/idempotency handling. Queue IDs are side-local, and only own-side queue/transit/history are projected. Recruitment arrivals and returns use existing provincial reserve reconciliation; provincial source allocation retains the inherited deterministic pool allocation rather than an individual recruit home-address ledger.

## Known boundaries

- Player recruitment only; no AI expansion, conscription law, forced deployment or nationwide training cap.
- City capture freezes escrow rather than simulating capture/destruction of recruits; no instant return or loot.
- Heavy templates available but normal completion demonstrated for infantry only. Tank fuel arrives through existing field logistics after deployment.
- Existing field wear and recruitment wear differ only by the inherited training mode; no battle damage or construction parameter changed.
