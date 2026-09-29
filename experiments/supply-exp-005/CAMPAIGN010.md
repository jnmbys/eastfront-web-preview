# SUPPLY-CAMPAIGN-010 — 完整战役隔离入口

基线 9cf0e5fb7fac27e16b2700559716b590e81957b7；上线证据7f2778bc仅复用背景，本轮没有部署。Core源码、RNG、求解器和补给公式不改。现有在线沙盘仍固定原SHA。

## 必须补齐的接缝与处理

1. 原片段始于T4/T11且T15硬停，Core原胜负上限为16。新增createDeploymentGameState入口（T1苏军部署），只在campaign配置下解除片段硬停；原片段不变。
2. 原实验expSupplyMode关闭了胜利调用。战役桥在原Core胜利检查点调用原evaluateVictoryAtCheckpoint，若已有胜者，仅该次合法END_PHASE/READY交回原Core终局分支。没有新胜利公式、资格或物流分配条件；Core自己验证行动并封局。原Core首都胜利仍重算其正常铁路补给，不读取实验实收/储备。终局不追加配送/回合。
3. 开局单位逐个部署时赋予3B库存，容量4B，单独增加初始物资总账。重部署不重复发放。实际增援沿用EXP004/005零库存，消灭注销身份、剩余库存计损失，禁止身份复活。
4. 战役开放真实DEPLOY_INITIAL_UNIT、DEPLOY_REINFORCEMENT、READY_FOR_PHASE_END、ENTRENCH、REPAIR_UNIT。现有移动、战斗、修路、强制战损/撤退/推进/突破/重点突击沿用。战役不再在结束阶段时自动选增援入口；玩家必须显式部署，有可部署增援时Core继续阻止跳过。
5. 独立campaign-server.py仅绑定127.0.0.1:8766。复用UX007的地图/选择/回执/反馈，加部署、增援和终局面板。两方是热座人工操作；默认Core的S-AI-1只是既有controller ID，未接AI策略。
6. 回放必须经过Python完整事务接缝，不能只重放Core actionLog，否则会漏掉真实后勤损失。状态文件和紧凑证据均可CLI回放。全知回放不由玩家HTTP导出。

## 明确实验配置

campaign-config.json是本次固定全局配置；所有整数库存/容量以1/4补给点计。初始单位3B、上限4B（B沿用兵种4或8），增援0。G源A5/A10/A16各32；S源AF4/AF10各24、AF16/AC10/AC11各16。枢纽G=A5/C10/A16，S=AC10/AC11/AF10；初始8、容量32、W96、quota40、floor4、范围8；普通边40、桥24；T2200开启、full、A、last、GS。普通EXP003容量与prepare储备配置显式化；不采用restore的W512/铁路128/单源128。

初始总物资是随58次部署累加的开局授予，不是供给源配送；从未部署→首个合法部署仅发一次。守恒：初始授予+源投入=现存库存+维护+行动消费+销毁库存。done按epoch保留连续结算；seen按请求ID保证幂等；失败/超时连Core状态、骰点、库存、epoch、revision都不提交。

## 维护者最短运行方式

在本分支的experiments/supply-exp-005目录，复用现有依赖初始化：

```sh
python3 restore-fixtures.py
npx --yes --package typescript@5.7.3 tsc -p core/tsconfig.json
python3 -m pip install -r requirements.txt
python3 campaign-server.py
```

打开http://127.0.0.1:8766。先苏军部署，再德军部署；选单位、选公开格位并部署，完成后结束阶段。之后复用原地图和战后选择；苏军有增援时先选单位/入口。有隐藏占位时Core可拒绝，界面不预报隐藏通路。旧补给对照选择旧模式后重置，是独立新局。默认预算3秒，不放宽。

CLI研究入口：`python3 campaign.py new /tmp/campaign.json --mode new`，`python3 campaign.py view /tmp/campaign.json --viewer G`；将带id/revision/controllerId的真实Action JSON送入`python3 campaign.py apply /tmp/campaign.json`标准输入。研究状态文件全知，不交给公平玩家或AI。

测试：`OPENBLAS_NUM_THREADS=1 python3 -m unittest test_campaign010 test_campaign010_seams`。紧凑完整回放：`python3 campaign.py replay evidence/campaign010-new.json`（旧模式对应old.json）。测试不接AI、不调数值、不请求在线沙盘。

## 验证边界与待决项

test_campaign010以Core既有生产全局烟测部署布局、固定seed17和显式增援/结束阶段Action，测试从空部署到原规则终局；该被动序列验证生命周期，不代表正常进攻策略或平衡。强制战斗采用已有EXP006合法战斗夹具，在campaign接缝下验证阻塞、玩家后续、结算和回放，单独标注为夹具，不冒充第二场完整战役。

无需引入新机制才能完成这条生命周期。后续待研究：普通容量下实际进攻能否持续、枢纽位置/初始库存是否合适、新物流与原Core首都胜利补给判据在体验上是否需要统一。本轮全部保留，不擅自调整胜利资格、俘获枢纽、缴获库存或新增运输规则。

本轮是本地隔离候选，不更新Render、不增加费用；华为浏览器完整战役尚未验收。HTTP接缝测试不等于真实浏览器/触屏通过。完整战役新代码没有Render资源测量；不得套用009/上线时512MB结论。

## 本轮实测结果

- 新/旧模式各从空部署到T16 GERMAN_ENTRENCHMENT原Core终局，均221次事务Action，胜者SOVIET / SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT；两份完整适配层逐动作回放hash一致。
- 新模式15个连续配送epoch、6个实际增援（入口被占后其余延迟遵从Core）、46个注销单位；初始900+投入1179=维护1868+剩余211，单位均为1/4补给点。被动全局序列未攻击、未修铁路，不用于胜率/平衡结论。
- 单独战斗接缝夹具：攻击→反应→推进→突破→重点突击→反应/跳过→回合末结算可重放；行动消费8、销毁库存36，守恒成立。额外LOSS_ALLOCATION/MOVING_RETREAT均阻止跳过、接受玩家合法选择。
- 幂等、冲突ID、错误控制方、部署重新定位不重复发货、0.001秒超时回滚、初始部署已被Core接受且库存已入草稿后的注入失败回滚通过。HTTP部署入口/玩家过滤通过；全知research回放路径返回404。
- 本地单次事务最高新0.82224秒、旧0.38311秒；保持默认3秒，不是Render或512MB实测。Python3.12.14 / Node24.19.0 / SciPy1.17.0 / NumPy2.3.5。43个Core源码/求解器文件与9cf0e5fb字节一致。
- 证据：evidence/campaign010-validation.json、campaign010-new.json、campaign010-old.json、campaign010-combat.json、campaign010-forced.json及对应测试日志。最初metadata把isDeploymentPhase传入phase字符串导致测试失败；改为Core要求的state参数后通过，保留初次失败日志。

当前没有阻塞生命周期的待决规则。接下来应先审阅上述固定配置和完整对局候选，再单独批准触屏试玩/资源验证；本轮不部署，也不把用户对三个短片段的初步认可升级为完整战役认可。
