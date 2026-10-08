# GRAND-ECONOMY-001 试玩

[正常暂停新局](http://127.0.0.1:4237/) · [真实中期续玩](http://127.0.0.1:4238/)。两者使用同一游戏与新规则、独立存档；不是物流演示。只绑定本机。旧4235/4236源码、存档不变，不静默转换旧局。

1. 顶部“军厂”→生产与库存：展开装备线，勾选永久厂房并应用。调入会从原线撤出；转产品种损失效率和未完成工时，成品保留。
2. “补给网络”→枢纽：查看真实铁路、覆盖与占用，按需开启机动化。火车不足造火车，覆盖不足调卡车；断线必须维修。日常供给先占用，补人补装只用剩余共享能力。
3. “建设队列”：排入受控铁路维修/升级、枢纽升级、厂房建设。民厂逐步施工，无旧I付款。失守工程停工。
4. 底部军团选择目标并委托，或选择单位调回直属。部队详情分别显示缺员、缺装备、供给和组织度；自动部分补充，不再要求满100人或整套材料。
5. 暂停期间自由规划，继续后共同时间推进。离开前暂停并“保存”；重启或读档后仍暂停，不重复发放。

每步5分钟，七日上限，第五日后满足中央与侧翼目标保持条件可提前结束。九类装备保留各自作用；装备数量是现有编制折算单位，非现实逐件枪械。没有燃料、贸易、征兵法、科技、海空军；铁路与枢纽可修/升级，本版不铺新线/新建枢纽。后方来源为既有工区，并非完整钢四首都模型。见 [规则与官方参考](RULES.md)。

中期入口首次使用固定B自然进程24小时检查点；本机当前存档保留第3日的浏览器真实续玩，加载暂停。原始检查点在 evidence/grand-economy-001/mid.json.gz。浏览器续玩与固定A/B比较分列，不能以其不同操作推断单项因果。

关闭前保存。只关闭本候选4237/4238：
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:/Users/jinyibo/eastfront/work/grand-economy-001-hoi-style/experiments/grand-economy-001/stop.ps1'
```
重新开启（已完成构建）：
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File 'C:/Users/jinyibo/eastfront/work/grand-economy-001-hoi-style/experiments/grand-economy-001/start.ps1'
```
存档在 `%LOCALAPPDATA%/EastfrontSaves/grand-economy-001`。回退使用原 `grand-play-002-campaign-loop` 和其独立存档；本候选关闭不会结束其他Worker服务。没有合并或部署。
