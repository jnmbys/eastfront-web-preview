# P5 Manifest compatibility report

结果：manifest 与权威 P4R3 **逐字节一致**。SHA-256：`5e2ac4521b889e92d9b77a75b47c87075c8aeab9f43acd112ef91de7e6b82936`。

- 117 条 manifest entry；含 6 个 Hill companion，共 123 张生产栅格。
- asset ID、family、路径、sourceSize、anchor、alpha/mask 语义、rotation、mirror、scaleJitter、cost、LOD，以及 entry 顺序全部保留。
- 原 `docs/P4_UI_Worker_Handoff.md` 原字节保留，确定性规则 `hash(scenarioSeed, q, r, terrainType) % variantCount` 与无序相邻边种子规则不变；没有新增随机运行逻辑。
- 各家族 variantCount 不变；跨家族原有相同短 ID（例如 Marsh 和 City 的 M01）原样保留。比对使用 family + file，不重命名原 ID。
- 清林 4 张遮罩、Hill 6 张 height mask 原字节保留；Hill 仅改 6 张 material companion。
- Core、Geometry、Renderer 未提供于此包，未创建、改写或替换任何此类实现。没有改动地图坐标、拓扑、道路/铁路/河流路径或桥位。
- 图像内部的叶片、屋面及水岸细节属于资产外观修订，并非逐像素 silhouette 冻结。既有 anchor 与放置合同不变；实际 Renderer 合成效果仍须集成检查。

为遵守“不改 manifest”要求，其 pack/revision/visualRevision 等历史身份字段也没有更新；P5 的交付身份以 `P5_REVISION.json` 和本次 ZIP 名称为准。包内所有原文档、历史审计与旧 demo 原字节保留，仅代表 P4R3 及此前状态。P5 审计和预算以 `P5_*` 为准。

审计边界：包级兼容性与文件完整性；不把它解释成正式视觉验收或 UI-006R1 运行结果。
