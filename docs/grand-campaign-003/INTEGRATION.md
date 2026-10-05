# 整合改动清单

新场景ID `grand-campaign-003-terrain-naturalization`，HTTP选择值 `terrain`。120单位ID、25节点/目标ID、归属、仓储ID、Action与授权视图、账目格式稳定。没有军官调度/接管算法修改。

|文件|作用|
|---|---|
|experiments/grand-campaign-003/terrain.json|唯一地形配置：具名主体、开口、脊线、谷地、低地、高岸，集中几何参数及覆盖顺序。|
|experiments/grand-campaign-003/scenario.mjs|变化宽度的连续轴线产生主地形；湿地验证河岸邻接，保护城镇/总部/湖泊，同步raw与Core地形。|
|experiments/grand-campaign-003/check.mjs|9组短验证，输出逐格差异及受影响线路。|
|experiments/grand-campaign-002/scenario.mjs|仅抽出createScenarioFromGeography合法初始化接缝及可禁用缓存选项。002默认输出精确等于原最终证据；003用临时002几何，不建立第二套地图缓存。|
|experiments/grand-campaign-001/server.mjs|追加terrain工厂与独立证据日志路径；权威经济事务不改。|
|src/playable/grand.ts、src/main.ts|增加003入口，保留002/001/旧模式；沿用GrandPort。|
|package.json|本机4193的grand:terrain脚本，无新依赖。|

533格主地形变更，见evidence/terrain-diff.json的paper/Core key/before/after。道路0、铁路0、河边0、桥0、部署0、设施0调整。理由：新地貌开口允许合法行动，没有必须搬桥改线挪兵的合法性问题；不让地貌调整触发002的作者侧加权路径重生成。

实际运输仍读取同一Core边。当前001末端规则按格数、控制、敌阻、主河/桥约束，未实现林丘差别吨公里收费。本任务不暗加该类费用，不把地形变化宣传成新增后勤成本。

复跑：根目录node ai/local/build.mjs，然后node experiments/grand-campaign-003/check.mjs。npm run grand:terrain启动4193。从配置合法T1开始，无T5/T8检查点、GIS依赖或新随机算法。整合时携带配置/工厂/入口接缝，不只复制截图或统计；002旧证据完全保留。
