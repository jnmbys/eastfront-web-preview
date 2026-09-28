# CORE-FIX-001 — 突破后完整性审计修复与 Core 源码交接

状态：独立候选 checkpoint，**未合并、未部署**。AI-001 第一阶段已接受；本任务不提供 Human vs AI，也不改变华为多人验收挂起状态。

## 可持续源码交接

- 仓库：`jnmbys/eastfront-web-preview`；工作分支：`core-fix-001`。
- 保留 AI-001 `2f457bdc83f6d457a01fb8a0109657c1e6f8cc70`，新建源码导入提交 `1098967b239e65be1e7861d5930adc9a7e804aed`；导入 Tree `f47d4b7daab931cadf61592cb528f3510aae5946`。
- 原始历史 Git commit：**未知**。上述导入提交是本次新建，不冒充历史版本。
- 原始基线以归档 SHA256 标识：`b157991005b04e339ed0911a8e9dfdd9a7ab5f901cba1fc03f72f293b2dd5609`。
- 原 ZIP 位于 `core/archives/eastfront-digital-core-v0.2.25-task002G-3R1.zip`，逐字节保留；来源为已有项目文件 `libfile_29c7e4ba06548191aea0df5c26858392`。
- `core/source/` 是可编辑 TypeScript 原工程，保留原 tests、scripts、docs、reference；原 dist 在 ZIP 内，工作目录 dist 由编译生成。另附 `core/archives/CORE-FIX-001-handoff.zip`，便于规则 Worker 独立取得。
- `core/ORIGIN.md` 记录来源。新生成并提交 package-lock.json：Node 24.19.0，TypeScript 5.9.3、Vitest 2.1.9、@types/node 22.20.4。原声明范围分别为 ^5.7.2、^2.1.8、^22.10.0；锁文件不是历史归档的一部分。
- 原源码重建 **76/76** 与生产 vendor 一致，逐文件 SHA256 在 `evidence/corefix001/baseline-artifacts.json`。

## 根因与证据范围

`src/engine/integrity.ts` 原先对所有 `advance.advancedUnitIds` 永久要求 `unit.hex == tx.targetHex`。真实 BREAKTHROUGH 会改变位置，但不会从正常推进历史中删除该单位；因此合法状态被误报 `COMBAT_ADVANCE_POSITION_INVALID`。关闭事务仍被检查，导致该误报不会因为 PASS_SCHWERPUNKT 消失；以后合法位移也不能被历史推进格永久锁住。

已用真实引擎执行：ATTACK → PASS_REACTION → RETREAT → ADVANCE_AFTER_COMBAT → BREAKTHROUGH → SCHWERPUNKT_OPTION → PASS_SCHWERPUNKT。没有手工构造结果或覆盖骰点。原版和修复版逐步 ActionResult（含状态、事件、骰点和 RNG）完全一致；只有审计输出不同。原 headless 第 5 步因完整性停止；修复版完成 6 步并正常回放。另用独立确定性 seed 8253 完成 Schwerpunkt 子战斗及其普通推进，避免把 seed 8246 的其他结果误写成已覆盖子战斗推进。

### 事务证据是否足够

现有 `CombatBreakthroughState` 只存 eligible/completed/max/resolved，**单凭 completed 标记不够**。权威 actionLog 另存接受状态、actionId、battleId、controllerId、turn/phase、unitId 和实际 path；事务存声明/关闭 actionId、目标格、阶段、原参战者及推进记录。这些资料足以核对本次推进→突破的记录、顺序及终点，不需增加协议字段或修改结算。

本修复没有把当前敌军 ZOC、占格或后续损伤重新套回历史路径；那会产生另一类误报。历史合法性依赖已接受的权威日志，原行动校验器仍负责提交时的全部规则。既有调试夹具允许从中间事务开始，因此不额外要求全部历史声明日志必须存在；声明日志存在时核对回合、阶段与顺序。本审计不是整套伪造日志的认证机制。

## 最小修改

正式 Core 源码仅改 `core/source/src/engine/integrity.ts`：

1. 普通推进仍验证原目标格；只有关闭战斗之后新的、已接受位移记录可以更新期望位置，拒绝记录不能授权位移。
2. 突破完成必须有唯一的接受记录，匹配本战斗、单位、声明控制者、actionId、阶段和时序。保留原参战／可选资格检查，并检查 advance resolved、CRT 允许突破、装甲身份及非 Schwerpunkt 二次突破。
3. 核对记录中的路径长度、地图范围、相邻关系及不可进入地形；当前位置必须等于记录终点或后续已接受的位移终点。仅把 completed 标记改成 true 不会绕过检查。
4. 空路径仍是放弃移动，正常推进单位必须留在目标；空路径且未正常推进的单位没有留存原位置，新增审计不伪造这个缺失的历史坐标，仍由原行动校验约束。此限制与本次正常推进后误报不同。
5. 活跃事务必须匹配当前阶段／回合和 pending；关闭事务必须匹配正确的关闭行动。原普通推进身份与位置断言、原全局完整性检查均保留。

没有改行动执行、移动成本、CRT、随机数、补给、单位模板或终局时点。`core/build.mjs` 从原源码编译后生成 vendor，**76 个文件中仅 engine/integrity.js 改变**，另外 75 个逐字节不变；未手改编译产物。差异与哈希见 `fixed-artifacts.json`。

AI-001 仅调整那个“已知错误应停止”的测试：合法突破后允许最小代理 PASS_SCHWERPUNKT，比较原引擎结果；另外注入非法位置，继续断言 INTEGRITY_FAILURE 且策略不会被调用。公平输入、候选和代理本身均未改变。

## 生产影响评估

| 宿主 | 原行为与核实范围 |
|---|---|
| Core runHeadlessGame / replayHeadlessActions | 默认启用逐行动完整性审计；真实链已复现停止，修复后继续及回放一致 |
| AI FairHost | 初始及接受行动后校验；原合法突破状态会停止，新合法流程通过，非法状态继续停止 |
| 本地 UI dispatchGameAction | 接受后采用状态并记录 integrityIssues；这些问题显示在 debug 面板。当前调用路径没有因该数组自动撤销或停止战斗 |
| 生产多人服务器 | 创建 match 时检查初始完整性；后续沿用 dispatchGameAction，未发现因该错误自动中止 Action 的路径 |

生产代码确实含旧检查，因而可产生该审计误报；**没有生产故障遥测或用户复现证明线上已卡死**，不作该声明。本次没有访问或改变真实对局，也没有发布。

## 测试与基线失败

原 Vitest：71 项，60 PASS / 11 FAIL。修复后原 71 项仍为相同 60 PASS / 11 FAIL，原失败名称和断言不变；新增专项单独列出。不能称 Core 全部测试绿色。

原 11 项失败如下（未经修改的原测试，实际值与预期值见 baseline-vitest.log）：

| 原测试文件／用例 | 基线观察 |
|---|---|
| combat / German combined arms +1 | 0，预期 1 |
| combat / eligible attacker artillery +1 | 0，预期 1 |
| combatAdvance / multi-unit breakthrough boundary | CLOSED，预期 BREAKTHROUGH_OPTION |
| combatTransaction / deterministic 2D6 closes NE | AR，预期 NE |
| combatTransaction / unique damage allocation | 2，预期 1 |
| combatTransaction / defensive artillery once | accepted=false，预期 true |
| combatTransaction / Last Stand | accepted=false，预期 true |
| retreatLegality / one defender supplied | 5，预期 10 |
| retreatLegality / TEMPORARY_SUPPLY | 4，预期 7 |
| transactionIntegrity / authorized joint retry | 未包含旧 RULE_NOT_IMPLEMENTED 预期 |
| transactionIntegrity / matching pending action | accepted=false，预期 true |

本轮未决定这些旧预期应如何迁移，也没有以旧测试失败为由改规则。原 28 个 smoke 脚本基线全部通过；修复后也全部通过。

新增专项覆盖真实链、普通推进、空路径、各可选放弃、准确终点、缺失／拒绝／重复记录、控制者／单位／战斗／Action 身份错配、路径长度及相邻性、过期阶段／回合、完成标记、错误关闭记录、重复 Action、Schwerpunkt 子战斗推进、后续正常移动及回放。

首次完整 Web 回归：630/637，通过之外 7 项均为冻结完整性产物的旧哈希。按生成产物更新 6 份 fixture 中同一个 `vendor/.../engine/integrity.js` 哈希（performance fixture 被两个测试使用），并更新 ua003r1 fixture 内对 ua003 fixture 文件本身的嵌套哈希。总计 6 个产物条目 + 1 个容器条目，没有删除断言或改变其他内容。逐文件旧／新值在 `frozen-hash-updates.json`；首次失败日志完整保留。原归档 BASELINE_SHA256 不变。

最终结果：新增 Core **24/24**、AI **21/21**、原 smoke **28/28**；Core 与两端 typecheck/build 通过。最终整轮 Web **636/637**，失败为 `tests/mp003-network.test.mjs:47` 的 `assert(dropped)`；单独复测该文件 **4/4** 通过。测试只等待操作端部署结束，随后立即断言另一客户端的丢包回调已发生，存在跨连接时序假设；这是一项待进一步确认的测试稳定性问题，不在本轮修改网络代码或断言。保留完整失败及复测日志，**不把单独通过当作整轮绿色**。这一用例发生在部署、没有战斗事务阶段，新增突破检查不会在其中执行。

新增运行日志以无损 `.log.gz` 保存（原始基线日志保持原样）。准确记录见 `evidence/corefix001/RESULTS.json`；Node/headless、原 Vitest、原 smoke、Web 全回归分别报告。本轮没有浏览器或华为验收，不改变之前验收状态。

## 复现与交接

```sh
git clone --branch core-fix-001 https://github.com/jnmbys/eastfront-web-preview.git
cd eastfront-web-preview
npm ci
npm ci --ignore-scripts --prefix core/source
npm run typecheck --prefix core/source
npm test --prefix core/source  # 已知 11 项原始失败；不要解释为全通过
npm exec --prefix core/source -- vitest run --root core/source tests/coreFix001.test.ts
node core/build.mjs --sync-vendor
node core/verify-equivalence.mjs
node ai/build.mjs
node --test ai/tests/*.test.mjs
npm run typecheck
npm test
```

`verify-equivalence.mjs` 需要 Python 3 标准库，以核验哈希并提取原 ZIP 作对照。独立交接包保留 core/、docs/corefix001/、evidence/corefix001/，可执行 Core 的安装、build、typecheck、test 和对照；AI 与 Web 验证需要完整仓库。`core/run-smokes.mjs` 可运行原有全部 smoke，不修改脚本。

提交使用 `[CF-Pages-Skip]`，不触发 Cloudflare 分支预览；不更新 main/source-main，不 force push，不发布 Render。原工作区、Pages 工作区、美术与规则研究均不改动。候选回退只需不用此分支；生产没有需要回滚的变更。

下一阶段仍是公平代理的增援、撤退及完整对局流程。本次没有接入 Human vs AI 界面，也未开展策略训练。
