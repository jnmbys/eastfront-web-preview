# SUPPLY-UX-020 第二次攻击补验收口

固定受测候选：`8503f1ff826a934f599af423626ea934f29f13bf`。结论：**一个合法SCHWERPUNKT第二次攻击场景，真实本地浏览器→HTTP→冻结权威执行器端到端通过；无需展示修复。触屏仍待验。** 本次只添加该场景的脚本、证据和状态记录，不修改候选运行代码、规则、库存、资格、RNG、参数或部署配置，不重跑原有18＋6项检查。

## 合法来源和行动链

起点为既有 `experiments/supply-exp-005/evidence/campaign011-final/nonzero-combat-destruction-state.json.gz`，revision102、T4德军战斗阶段。加载时以同目录原行动记录的final_hash校验，并通过冻结物料审计。没有重建部署或重新设置库存。

从起点执行16个合法行动至revision118：结束当前阶段、部署规则强制要求的两支T4苏军增援、推进至T5德军移动、G-I-01移动一格、进入战斗、G-PZ-01＋G-I-01攻击(5,5)、装甲前进、沿(6,4)→(6,5)完成两格突破。首击自然掷出6＋6＝12，结果D3R；没有试掷、改种子或重掷。首次尝试跳过必需增援被规则拒绝，随后按授权模型正常部署；失败记录保留在attempt.json的preparation_notes，未修改规则以跳过。

第二击资格来自现有Core：`combatTransaction.ts`的prepareSchwerpunktOrClose要求德军D2R/D3R、真实突破移动、原攻击者为存活且至多损失1阶的装甲、非OUT_OF_SUPPLY、本回合未用；declareSchwerpunktCombat另核对阶段、控制者、新目标邻接且有苏军守军。记录中的G-PZ-01全部满足，授权模型只给出该单位攻击(5,6)的选择。第二击是**单个合格装甲**的行动，不是再进行一次联攻。

## 预览与实际逐项对照

| 项目 | 第二击前的最新状态/预览 | 实际提交后 |
|---|---|---|
| revision | 118（首击前115，首击后116；已完成前进和突破） | 119 |
| 攻击者 | 只有G-PZ-01；没有沿用首击的G-I-01行 | 子战斗B-000005只含G-PZ-01，来源B-000004 |
| 储备 | 0库存单位＝0补给点 | 0补给点 |
| 本次费用 | min(4,0)＝0库存单位＝0补给点 | SCHWERPUNKT_ATTACK账本费用0 |
| 欠账 | D=1/4维护份，每份2补给点，折合0.5补给点 | D仍为1/4 |
| 欠账系数 | 100% | 未发生维护或配送 |
| 本击有效补给系数 | 50%，基于最新空仓计算；不直接照抄单位缓存中的100% | 该单位战前基础攻击力6，有效攻击力3 |
| 第二击战斗修正 | 既有规则 | secondAttackShift=-1，未被补给系数覆盖 |
| RNG | 三次浏览器查询均保持draws=8 | 实际提交后draws=10，掷3＋2＝5，A1 |

A1使装甲由损失1阶变为2阶；这是实际战果，不属于预览承诺的补给扣费后储备。该样例按现有规则允许空仓减效攻击，因此费用为0；**不据此声称覆盖了非零费用的第二击**，也不为制造非零费用修改库存或延长本轮范围。

## 只读、新鲜度和执行证据

- 三次真实HTTP查询逐次比对整个slot（Core、RNG、库存、账本、去重表、回执、记忆等），完全不变。
- 报价绑定revision118和当前第二击目标；只出现单个第二击候选，未混入revision115首击的另一名攻击者。实际提交后报价rows清空，旧草稿不会继续显示。
- HTTP执行完成后，以相同真实命令交给冻结执行器在私有副本上对照，**完整结果状态一致**，包括骰点、库存、债务和战斗事务。
- 第二击服务事务约0.644秒，原3秒预算未改变。这是本机数据，不是线上或限资源验收。
- 浏览器为独立本地无头Edge 154.0.4258.48，1440×1800。未使用Render或曾失败的控制通道。

[第二击预览截图](evidence/second-attack/second-preview.png) · [提交后回执截图](evidence/second-attack/second-receipt.png)

[完整合法准备链/首击结算](evidence/second-attack/attempt.json) · [HTTP查询只读与权威结算对照](evidence/second-attack/http-authority.json) · [浏览器结果](evidence/second-attack/browser.json) · [派生合法检查点](evidence/second-attack/second-before.json.gz) · [证据校验](evidence/second-attack/SHA256.json)

复现仅本场景：使用既有构建和依赖，运行 `python -X utf8 experiments/supply-ux-020/second_attack.py` 生成合法检查点，再运行 `node experiments/supply-ux-020/verify_second_browser.mjs`。后者仅启动127.0.0.1:8782私有测试服务，浏览器通过原有实验入口和按钮操作；没有新增HTTP检查点注入接口。工具路径覆盖变量同REPORT020.md。本次两个本地进程均已关闭。

已通过：原24项沿用既有证据；本次新增一个合法第二击的资格、最新报价、实际结算、状态/RNG只读、首击旧报价失效与真实浏览器验证。待验：触屏；部署镜像验收仍由018另行负责，本任务未部署。
