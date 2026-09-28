# AI-001 — Fair PlayerView Agent Boundary

状态：独立源码 checkpoint；未合并、未部署，尚不是可用的人机对战。
COMBAT-UX3.1 工程交付已审核；华为多人真机验收继续挂起，未标记通过。

## 基线与隔离

- 生产前端 Source：0d60f5b745981094ffad90bc95e64bd79f1e3967；Tree：240fea6b18c11190397fd3b53bfd940434818e00。
- Cloudflare main：349369ad358b9b24fa0410735649de497a94b9ea。
- Render source-main：5fe12513bca95c5b43c2ddc125021a117c5bcce4。
- 本轮分支从后续证据提交 4b9c81bf7e63e6bf1f779f3b6368084ebe9b2784 建立，保留所有已验收改动及交付证据。
- checkpoint 提交使用 `[CF-Pages-Skip]` 前缀，避免 Cloudflare 自动生成分支部署；不更新 main/source-main，不调用部署流程。依据：[Cloudflare 官方跳过部署说明](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)。
- 独立 worktree / branch：eastfront-ai001 / ai-001-fair-boundary。原源码和 Pages worktree 未切换、未修改。
- AI 构建只输出 .ai-dist；前端与服务器没有导入 AI 模块。现有 src、server、vendor、public 逐文件不变，未修改美术或规则研究成果。

## 旧接口审计

| 路径 | 实际能力 | 本轮处理 |
|---|---|---|
| Core engine/headless.ts 的 HeadlessActionProvider | 完整 GameState、previousResult（含 state/events/issues）、全知随机状态；复制只防止修改 | 保留兼容；新别名 runOmniscientEvaluation 明确标记全知评估 |
| src/player-view/playerView.ts | 本方单位、已识别敌军、CONTACT、Last Known；OBSERVER 额外有 authoritativeState | 公平入口固定分配阵营，只调用玩家投影，再做逐字段白名单 |
| src/core-adapter/session.ts / browserProjection.ts | 本地 UI 会使用完整状态做规则预览 | 不交给策略，也不提供 session、engine 或回调 |
| server/gameplay.ts queryModel / forcedAction | 有接收方过滤，但合法性、撤退、突破等由真实状态计算 | 不复用为 AI 可反复试探的合法动作 oracle |
| RulesEngine.apply / SeededRNG | 权威校验、真实结算、战斗随机序列 | 仍仅由权威宿主调用；策略输出普通行动意图 |

实际成对探针证明：本方视图相同、隐藏敌军 ZOC 不同，validateMoveAction 对两步路径会返回不同结果。因此“过滤错误文字后开放无限合法性查询”仍不等于公平。新策略接口不提供预览、枚举真实合法动作、假提交或验证回调。

## 新接口

公开策略入口：`ai/fair/index.ts`，只导出类型、观察候选生成及最小策略。

`FairAgent(input) -> FairDecision` 只收到一个深度冻结、脱离宿主引用的纯数据参数；调用时没有宿主或另一座位作为 this。输入字段：

- schema、matchId/controllerId/side 身份域；仅允许每方一个控制者。
- 经现有 PlayerView 投影和第二层显式白名单处理的 view，类型中没有 OBSERVER/full state/RNG。
- 最小公开规则子集：规则/场景 ID、当前回合上限、堆叠上限、模板的公开阵营与最大损伤级数。没有 initialUnits、对方部署或场景私有扩展字段。
- 部署时只附本方 roster、基于公开地图与配置的本方部署区。已审查原 deploymentHexKeysForSide，不读取敌军占格。
- 最多 16 条本方意图与 ACCEPTED/REJECTED 反馈。Last Known 只沿用既有 rememberPlayerView；不另建持久敌军身份/兵力档案。
- 明确由宿主单独提供的 agent seed 与本方 decisionIndex；没有战斗 seed、draws 或 RNG 对象。

公开观察摘要的 SHA256 用于识别同一观察下的重试，不含全局 revision、隐藏行动计数或随机状态。

候选由 `observationCandidates` 在策略侧纯粹根据输入生成，最多 128 个，**不保证合法，也不是完整合法动作集合**。当前包括本方部署、本方一步移动、对当前已识别相邻敌军的单单位攻击、结束阶段及部分战斗待处理意图。CONTACT/Last Known 不会变成可攻击的敌军身份。候选路径不调用引擎或预览。

`ai/authority/FairHost.ts` 是可信宿主模块，保留完整状态：

1. 依据原控制者/待处理决策所有权选择策略；不由策略选择操作座位。
2. 将获授权纯数据交给策略。
3. 复用现有精确 NetworkAction 形状校验，拒绝伪造 controllerId/actionId、未知字段；意图还必须属于本次观察候选。
4. 宿主注入控制者身份，交给原 RulesEngine.apply。只有接受结果更新状态。
5. 策略只能得到本方意图的 ACCEPTED/REJECTED；不返回原 issues、details、事件、actionId、完整结果或全状态。
6. 保留原完整性检查；连续拒绝 8 次终止，运行上限最多 10000 次决策，终局不再调用策略。

没有新的多人消息字段、服务器部署或 UI 路由。复用 NetworkAction 类型与校验器不意味着当前网络端已经接入 AI。

## 最小代理的实际能力

这是被动验证代理，不评估战略、不训练、不改平衡。

- 初始部署：基于本方观察选格，独立 seed 只用于确定性选项排序。
- 普通阶段：提交 READY_FOR_PHASE_END，不主动移动、攻击、修铁路、恢复或布置增援。候选接口中的移动/攻击由测试策略覆盖。
- 防御反应：PASS_REACTION。
- 损失：根据本方已知单位及公开最大损伤级数提交简单分配，由原引擎校验。
- 可选推进/突破：PASS_ADVANCE / PASS_BREAKTHROUGH。
- 撤退：明确 UNSUPPORTED_RETREAT，停止；不伪造无路可退、自动分配损失或绕过步骤。
- 必须部署增援而无法结束阶段：本方收到一次通用拒绝后停止 NO_CANDIDATE，不无限重试、不强制过阶段。
- Schwerpunkt 的 PASS 意图在接口/纯策略上有覆盖，但下述原 Core 完整性问题阻止适配器走完实战路径，不能算完整支持。

实际生产地图演示：97 次宿主步骤，95 次接受、1 次拒绝、1 次明确停止；双方均被调度，全部初始部署完成，至第 4 回合苏军必需增援阶段停止。战斗 RNG 与初始值完全相同。这不是完整对局通关。

## Core 原始源码与构建链

初查当前仓库和可访问 GitHub 仓库只见 vendor/dist；随后从已有文件找到：

`eastfront-digital-core-v0.2.25-task002G-3R1.zip`

SHA256：`b157991005b04e339ed0911a8e9dfdd9a7ab5f901cba1fc03f72f293b2dd5609`。

包内有可编辑 src/engine/headless.ts、RulesEngine.ts、integrity.ts、规则模块、测试、脚本及 tsconfig.json/package.json。原包 76 个 dist 文件与生产 vendor 完全一致。使用当前 TypeScript 5.9.3 执行 `tsc -p <Core 原工程>/tsconfig.json` 成功，重建的全部 76 文件仍逐字节一致。见 evidence/ai001/core-source.json。

本轮没有改原 Core 源码、规则、vendor 编译产物或其分发；外部适配层保持独立。原工程完整 Vitest 套件未执行，不宣称通过；已完成重建比对及实际引擎专项探针。

发现并保留的已有阻断：

- 原引擎真实接受 ATTACK → PASS_REACTION → RETREAT → ADVANCE_AFTER_COMBAT → BREAKTHROUGH，进入 SCHWERPUNKT_OPTION。
- 但原完整性检查 `src/engine/integrity.ts:173` 对所有 advancedUnitIds 仍强制要求当前格等于原目标格，没有排除已经突破的单位，报 COMBAT_ADVANCE_POSITION_INVALID。
- 本轮测试断言这一原始不一致及宿主停止、策略不再被调用；没有过滤该错误或改写 vendor 让测试变绿。
- 修复应在已找到的 Core 原始工程中另开任务并验证规则不变；不能把该流程当作已支持。

当前生产 turnLimit=16、最终德军回合末的判定时点保留。独立终局微场景用原配置断言 GERMAN_ENTRENCHMENT 判胜、GAME_OVER 后不再调用策略。没有混入规则聊天 C3 的苏军完整回合实验。

## 验证与复现

在本分支安装既有依赖后：

```sh
npm ci
node ai/build.mjs
node --test ai/tests/*.test.mjs
node ai/demo.mjs
npm run typecheck
npm run build
npm run server:build
node --test tests/fow001-player-view.test.mjs tests/fow002-fog.test.mjs tests/move001r1-state.test.mjs tests/combat-ux3.test.mjs tests/combat-ux31.test.mjs
```

最终结果：

- AI 专项 **21/21 PASS，0 skipped**；包括编译期负向契约、运行期参数/引用检查、成对隐藏部署、隐藏支援、不同未来 RNG、CONTACT 匿名性、实际 Last Known 更新、候选查询泄漏、通用错误、引擎拒绝后的恢复、有界停止、座位/对局隔离、真实战斗决策所有权及原 Core RNG/state oracle 对照。
- 前端与服务端 typecheck/build PASS；AI 独立 TypeScript build PASS。
- 既有 FOW-001/FOW-002、MOVE-001R1、COMBAT-UX3/UX3.1 相关回归 **72/72 PASS，0 skipped**。本轮未重跑上一轮完整 637 项，不复述为本轮全量通过。
- 原 Core 重建 PASS，76/76 产物一致；生产受保护路径无修改。
- 这些是 Node/headless/权威引擎验证；本轮没有浏览器/Huawei AI 验收，也没有部署。

初始专项失败原因也保留在证据日志：复用的微场景混用了生产部署清单与小地图，原完整性检查正确拒绝；已改成明确独立的测试场景，不关闭检查。生产演示发现强制增援不能跳过，改为诚实断言停止；可选战斗链探针发现上述原 Core 阻断，保留并单独断言，未伪造成功。无既有规则/隐私断言或冻结哈希被放宽。

## 剩余隐私风险与边界

- 这是已审计策略的进程内数据/能力边界，不是任意恶意 JavaScript 的安全沙箱。宿主没有把全知方法或上下文交给策略，但无法阻止另一段自行导入宿主、捕获外部变量、读文件或无限循环的未受信任代码。引入第三方策略之前还需进程/Worker 隔离、模块与 I/O 限制和执行时限。
- `auditOmniscient()` 仅供宿主评估；`ai/omniscient.ts` 及原 Core headless 仍可读全状态。它们不能作为公平策略入口、不能把其结果回传给策略。
- 已提交行动的接受/拒绝本身可能提供游戏既有的信息；这里收窄可提交范围、移除原因并限制重试，不声称实际结果在隐藏状态不同的情况下相同。隐私测试要求的是相同授权输入/历史/agent seed 下的执行前输入与输出相同。
- 当前 PlayerView 的地图、接触、战斗参与者临时识别权限原样沿用；本轮没有证明所有游戏状态的全局信息非干扰，也没有更改既有可见性政策。
- 没有全知 rollout、隐藏敌军搜索、规则预览回调或未来骰点预测。代理观察历史只在本场本座位宿主中存在，新实例从空历史开始；最小代理本身无全局缓存。

## 下一步 Human vs AI 尚缺

1. 独立处理 Core 突破后的完整性不一致，保留现有规则。
2. 完成获授权的本方增援可用信息与非试探式候选、撤退规划及其失败/接管流程。
3. 本地人机座位设置、宿主调度与交接、取消/退出、运行时限、保存/恢复的隔离设计；人类与 AI 均走同一权威 Action 路径。
4. 把观察与意图序列化送入隔离执行器，并审查下一阶段策略的输入依赖；接入现有授权战斗摘要须单独投影，不能回退到内部 CombatTransaction。
5. 完整对局、UI 与触屏验收。尚未提供本地 Human vs AI 按钮或可玩入口，不应写成该功能已可用。
