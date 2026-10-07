# GRAND-MAP-001-R2

本机入口 http://127.0.0.1:4223/ 。独立显示修订分支，保留R1完整玩法与原4222服务。

- 时间条：暂停/继续、速度、保存、加载。圆标双剑代表实际交战，旁边小字为攻/守；灰色表示战况依据不足，不代表劣势。
- 点击同格部队标记展开成员，再点击单队；选中部队突出其真实动作。地图中的数字是当前授权同格部队数。
- 点击双剑，查看/选择主攻、支援部队并沿用原攻击、支援、接管、撤回。红主攻、蓝支援（不跟进）、绿行军；宽透明箭为军团计划。
- 详情右上×收起；城市生产和军团编辑在右侧展开；全部行动箭头开关位于“战线、计划与图层”。

交付时服务已运行。重新启动：仓库根运行 `node ai/local/build.mjs`，随后 `powershell -ExecutionPolicy Bypass -File experiments/grand-map-r2/start.ps1`。
关闭前在网页暂停并保存，然后运行 `powershell -ExecutionPolicy Bypass -File experiments/grand-map-r2/stop.ps1`；脚本只关闭4223且核对本候选进程路径。
存档：`%LOCALAPPDATA%/EastfrontSaves/grand-map-r2/campaign.json`。完整复用R1规则版本，服务重启可恢复；验收起点为R1已保存T10片段，不是构造的新胜利局面。
回退直接打开 http://127.0.0.1:4222/ ，R1进程与原存档未改。不转换或覆盖其存档。

复核：`node experiments/grand-map-r2/replay-check.mjs <R1仓库路径>`；读取已有T10和日志，纯离线对照，不操纵运行中的网页对局。详见 `evidence/grand-map-r2/REPORT.md`。
