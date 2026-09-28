# CORE-BASELINE-002 — 测试基线整理

基线：core-fix-001 / `f8e732138a8e3c01d2885ddac09a33e2fedfec18`，Tree `3f6e0e527cf8a15594ef604bdf3af7cf60f355b6`。独立分支 `core-baseline-002`，不合并、不部署。保留原源码归档、CORE-FIX-001 实现及历史失败证据；未改变运行时代码、规则、补给、美术或协议。

## 11 个失败的逐项分类

“过期夹具”是测试准备已不满足其原本声明的前提；不是修改规则使当前输出匹配测试。九个补给用例的数值／CRT／结果断言全部保留。

| ID | 原失败 | 分类 | 证据与修正 |
|---|---|---|---|
| C01 | combat: combined arms +1 | 过期夹具 | combat.ts 要求参与协调单位非 OOS；初始化刷新已把无路网夹具置 OOS。显式恢复该战斗夹具声明的 SUPPLIED，仍断言 +1。|
| C02 | combat: attacker artillery +1 | 过期夹具 | validArtillerySupport 拒绝 OOS；原补给构造已失效。恢复声明快照，仍断言 +1 与同一炮兵 ID。|
| C03 | combatAdvance: multi-unit breakthrough | 过期夹具 | prepareBreakthroughOrClose 排除 OOS 装甲，故旧夹具直接 CLOSED。保留原 BREAKTHROUGH_OPTION、候选和步数断言；恢复输入快照，显式 OOS 的负例仍 OOS。|
| C04 | combatTransaction: seed 2722 closes NE | 过期夹具 | OOS 攻击折减改变战斗比。归档 combat-declare-smoke 的同 seed、同单位、供给前提明确期望 NE。恢复前提，不改 seed、CRT 或 CLOSED 断言。|
| C05 | combatTransaction: unique A1 loss | 过期夹具 | 同上；归档 smoke 明确 seed 22→A1、5392→DR。仍断言损失一级、自动关闭及另一战斗 RETREAT。|
| C06 | combatTransaction: defensive artillery | 过期夹具 | 初始化苏军补给后炮兵 OOS，原 reaction 不合法。保持 accepted、一次消耗、重复拒绝与 -1 列修正断言。|
| C07 | combatTransaction: Last Stand | 过期夹具 | HQ OOS 不具反应资格。归档 smoke 明确 seed 8246 转换撤退；保留 CP、HQ 标志、-1、转换损失及 CLOSED 断言。|
| C08 | retreatLegality: one defender supplied | 过期夹具 | 声明的 SUPPLIED 被 setup 覆盖，导致全员 OOS。恢复各自声明（一个 OOS、一个 SUPPLIED），仍断言防御 10、不减半。|
| C09 | retreatLegality: TEMPORARY_SUPPLY | 过期夹具 | 正常补给刷新不读取 temporarySupply，写 SUPPLIED/OOS；战斗检查 supplyState。显式准备 TEMPORARY_SUPPLY 快照，仍断言防御 7、不减半；不实现临时补给行动。|
| C10 | transactionIntegrity: authorized retry | 过期预期 | 保留 accepted=true、拒绝错误授权／重复战斗的断言；删除的是旧占位 RULE_NOT_IMPLEMENTED／声明期 preview-combat 预期，替换为 issues=[]、正式事务、承诺 ID、pending 所有者与 CombatDeclared 断言。|
| C11 | transactionIntegrity: matching pending | 过期夹具 | 仅 reserved battle + 手写 pending，没有 CombatTransaction；完整战斗实现当然拒绝。经真实授权→ATTACK 建立事务后测试原屏障及 PASS_REACTION；新增负例确保缺少事务仍拒绝且不掷骰。|

本组 11 项：**10 个过期夹具、1 个过期预期；未发现需修运行时的实际缺陷或待裁决规则歧义**。这个结论只限该组，不代表全 Core 无缺陷。

### 判断依据与历史范围

使用同一归档内的源码、分阶段契约及已更新 smoke，而非按最新输出改断言：

- `core/source/src/engine/state.ts` 的 setup 顺序显式刷新双方补给。
- `docs/GERMAN_SUPPLY_REFRESH_002B_3.md`、`SOVIET_SUPPLY_REFRESH_002B_5D.md` 明确 setup 初始化与回合快照；后者明确不读取 temporarySupply。它们是较后阶段契约，不沿用早期“苏军补给 deferred”的旧说明。
- `scripts/combat-declare-smoke.mjs` 已在 setup 后显式设置该战斗夹具的供给前提，且保留同样的 seed/CRT/损失断言。
- `docs/COMBAT_DECLARATION_002A_1.md` 的 Attack declaration 定义正式事务、pending、参与者标志及事件；`scripts/transaction-integrity-smoke.mjs` 已按建立的事务验证联合攻击重试。
- `rules/combat.ts`、`rules/combatTransaction.ts`、`RulesEngine.ts` 分别确认 OOS 消耗规则、突破资格及声明的权威结果。没有重新选择规则。
- 原始历史 Git commit 仍未知；历史依据为此前哈希核实的归档，不能把新源码导入 commit 当作原始历史。

新增测试助手只在四个相关 combat 夹具中显式启用，不改变共享 makeState 或生产初始化。两个新增契约测试确认：无路网 setup 仍生成 OOS；孤立 pending 仍被拒绝、不产生骰点、不消耗 RNG。

## MP003：等待实际被测事件

旧用例 `deploy()` 仅等待操作方 B 的 revision/interactive，随即断言观察方 A 已收到并丢弃 revision=1。这两个 WebSocket 没有跨连接的回调先后保证。

修正仍使用原有 `wait` 的 7000ms 上限、原 3ms 轮询间隔；没有增加 sleep。主动 pause A 的接收流，先完成 B 的部署并断言 dropped=false，再 resume A、等待精确丢包回调。原有 dropped=true、A revision=0、一次 RESYNC、双方隐私及继续到 revision=3 的断言全保留。操作方重复提交抑制仍由原 deploy helper 验证。

负向控制仅用于验证测试本身：在临时副本删除新增事件等待，应在同一个 dropped 断言失败；不修改产品或提交该临时副本。结果保存在证据目录。

## 验证与复现

最终：Core **97/97**、Web **637/637**，完整门禁各 **1 次**；原 smoke **28/28**、AI **21/21**、MP003 定向 **4/4**；两端及 Core typecheck/build 通过。未解决失败 **0**。负向对照按预期失败，不计为门禁失败。

详细计数及运行次数见 `evidence/corebaseline002/RESULTS.json`，原日志以 gzip 无损保存。受影响的五个 Core 测试文件先定向验证；修改完成后完整 Core、完整 Web 各执行一次，不以循环重跑取绿。

```sh
npm ci
npm ci --ignore-scripts --prefix core/source
npm run typecheck --prefix core/source
npm run build --prefix core/source
npm test --prefix core/source
node core/run-smokes.mjs
node core/verify-equivalence.mjs
node ai/build.mjs
node --test ai/tests/*.test.mjs
npm run typecheck
npm test
```

构建后 76/76 Core 产物与 CORE-FIX-001 vendor 逐字节一致，见 runtime-equality.json。本轮不更新任何冻结哈希；原 Core 完整性修复及其非法状态断言保留。运行中生成的旧 MP 证据复制到本任务目录，恢复原历史文件。

## 下一步结论

可继续**隔离分支上的公平 AI 增援／撤退接口和完整对局流程开发**。这不是合并／部署许可，也不表示人机对战已可用。仍需遵守 AI-001 PlayerView 边界、对本方候选与权威合法性区分、历史隔离、有界拒绝及终局退出，并对增援与撤退补齐授权输入和真实行动测试。补给实验、美术原型与本任务没有合并关系；华为多人验收继续挂起。
