# GRAND-UNIT-001 本机试玩

入口：http://127.0.0.1:4225/ 。服务已在本机独立运行，交付时 T15 暂停。点击“进入共同战役”继续现有进度，不会自动新建对局。

- 绿条是组织度；金条仅表示人员完整度，不含装备。
- 点击同格标记展开逐队双条，再点单位继续原有指挥。收起时组织取各单位归一化均值，人员取总现有/总满编；!N 表示低组织队数，“缺”表示有满编装备缺额。
- 点击战斗圆标看主攻、支援的各自双条；“军团与直属命令”查看编组人员、低组织及装备摘要。选中单位展开装备详情可看持有/满编需求。
- 原箭身进度、战斗预估、军官、生产、运输和通信保持原功能。敌方未知不画假条。

离开前暂停并保存。存档独立位于 `%LOCALAPPDATA%/EastfrontSaves/grand-unit-001/campaign.json`。

## 启动、关闭与回退

在此工作目录执行 `node ai/local/build.mjs` 后，用 PowerShell 运行 `./experiments/grand-unit-001/start.ps1`。它后台隐藏启动4225；端口已被占用时拒绝重复启动。

关闭只运行 `./experiments/grand-unit-001/stop.ps1`，它核对4225进程路径，仅停止本候选。先在网页保存。不可批量结束Node。

原4224服务、内存与存档未动：http://127.0.0.1:4224/ 。代码回退使用原分支 grand-map-002-progress-estimates / a9ed346a88f6b6308e2863af2f424b43fc37aaf4；不用重置本候选存档覆盖旧服务。

## 定向验证

`node ai/local/build.mjs`，然后 `node experiments/grand-unit-001/check.mjs`。

实际操作与限制见 ../../evidence/grand-unit-001/REPORT.md。仅本机访问，无部署。
