# 001 → 002 场景差异

所有变化限定独立场景作者配置和主入口选择；无战斗/经济参数变更。

|地形格数|001|002|
|---|---:|---:|
|CITY|25|28|
|FOREST|157|512|
|HILL|21|208|
|LAKE|0|2|
|MAIN_CITY|2|2|
|MARSH|44|117|
|PLAIN|1031|411|

共767格主地形改变；1280格尺寸与Core转换不变。林地由零散模式改为北部/谷地连片区域，湿地依低地布局，增加两格概化湖泊。这里的地形面积不是历史测量。

|交通边|001|002|
|---|---:|---:|
|roads|307|277|
|rails|307|239|
|rivers|30|323|
|bridges|1|18|

原五条横向线路改成工区—站场支线、双方后方和前沿纵向联络，以及六条跨线走廊（3铁路、3道路支路）。退路和预备队侧向调动依旧检查控制、ZOC、桥梁和移动点；静态有路不保证战时畅通。18桥是路轨实际跨河的结果，不另赠工兵或铁路修复。

## 设施搬迁（纸面格）

永久ID、角色、VP、每E收入与补给量保持001数值；25节点全部搬迁，5普通聚落不入账。

|ID|001|002|
|---|---|---|
|GERMAN-industry-1|C5|F5|
|GERMAN-industry-2|C11|H11|
|GERMAN-industry-3|C17|J17|
|GERMAN-industry-4|C23|K23|
|GERMAN-industry-5|C29|O29|
|GERMAN-depot-1|P5|V5|
|GERMAN-depot-2|P11|V11|
|GERMAN-depot-3|P17|W17|
|GERMAN-depot-4|P23|V23|
|GERMAN-depot-5|P29|V29|
|WEST-CAPITAL|E17|H16|
|SOVIET-industry-1|AL5|AJ4|
|SOVIET-industry-2|AL11|AL10|
|SOVIET-industry-3|AL17|AJ18|
|SOVIET-industry-4|AL23|AL24|
|SOVIET-industry-5|AL29|AI30|
|SOVIET-depot-1|X5|AC5|
|SOVIET-depot-2|X11|AC11|
|SOVIET-depot-3|X17|AC17|
|SOVIET-depot-4|X23|AC23|
|SOVIET-depot-5|X29|AB29|
|EAST-CAPITAL|AJ17|AM6|
|OBJECTIVE-5|T5|Z6|
|OBJECTIVE-17|T17|Z17|
|OBJECTIVE-29|T29|Y26|

## 部署与功能

120单位全部移动到新场景位置；ID、模板、阵营、初始损伤和数量不变。每侧5个12单位标签编组围绕各站场部署，前沿步兵能首回合接敌；后方/支援仍留在三格末端服务范围内，避开未架桥的大河、湖泊与敌ZOC。部署由120次Core DEPLOY与双方READY生成，未加载旧存档。逐单位旧/新轴坐标见[map-diff.json](evidence/map-diff.json)，新纸面格可按Core转换复核。

工区后移而不凭空增加工业；城市功能分为工区、站场、交通目标、总部与普通城镇。总部称谓不再冒充实际国家首都。北部宜选择通路，中央宜集中/绕行，南部需防守河谷运输交会；这些是设计意图，不是单位风格或军官加成，也不是平衡结论。

后期修正：最初浏览器链使用318河边/17桥版，发现Drut被过滤的湖心线造成断河。最终保留官方该段几何，改为323河边/18桥；道路277、铁路239、所有设施/部署不变。旧页面证据保留并标记，不把旧水系截图冒充最终河系。最终版再次执行全部9组地图检查，并补浏览器定向复验。
