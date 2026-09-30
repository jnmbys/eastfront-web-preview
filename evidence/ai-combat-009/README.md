# AI-COMBAT-009

基线/源码父提交 `3640246770921fb907eb68fd7e8a37f8f368af11`；独立分支 `ai-combat-009`。给研究聊天直接读取的交接是 [summary.md](summary.md)，机器数据为summary.json / comparison.json。候选代码及完整日志由本目录所在最终Git提交固定；build.sourceParent记录运行时父提交，sourceDiffHash与runtimeHash绑定当时实际修改及编译字节，不冒充父提交本来包含本次改动。

## 契约与最小改动

Core的 `rules/combat.js:validateAttackAction/buildCombatContext` 和 `combatTransaction.js:declareCombat` 已支持 `attackerUnitIds[]`。校验每个单位存活、同阵营、有控制授权、尚未攻击、未专用于修铁路、邻接目标、直接攻击力>0且ID不重复；真实宣告战斗后一次性将所有参战者hasAttacked置true。Core负责组合的实际CRT修正、损失、反应、战后选择；AI不复制规则或查询权威合法性。

原 `basicAgent.ts:scoreIntent` 本来就按实际attackerUnitIds对攻击力求和，逐单位应用OOS取整，以可见守军防御之和估计比值，沿用地形/堑壕/最差渡河惩罚。因此**评分代码零修改**，默认attackRatio=1.5、penaltyWeight=0.75及所有风险参数不变，不加人数奖励、不把协同兵种/侧翼等Core奖励塞进启发式，也不加支援候选或支援攻击力。

运行代码仅改 `ai/fair/candidates.ts`：

- 战斗阶段提案：READY_FOR_PHASE_END + 单位ID排序的单攻 + 有界联合攻击。单攻同样排除公开已失去资格的单位；hasMoved不是攻击失格条件，测试确认已移动单位仍可攻击。
- 目标仅来自当时FairView.units中的敌军，按hexKey去重排序；CONTACT、LAST_KNOWN不补成目标。只选同控制者单位，不申请跨控制者承诺或窥探其他席位。
- 同一目标的合格相邻单位按ID排序，用惰性组合生成器生成2、3、4人组。按目标×组合大小的流轮转；每组合ID唯一、顺序规范。组间共享单位是备选方案，不是重复执行：选定一次真实ATTACK后，后续视图的hasAttacked会排除所有已参战单位。
- 每次最多64个组合、最大4人，总候选仍≤128。单攻先占位（含等待最多128项），组合只用剩余空间。单攻过多时可能没有组合空间；这不是全部合法攻击枚举，也不保证找出最强组合。没有新增人数/搜索参数供调参。
- 原强制流程入口在战斗候选前执行，仍交minimalAgent；三次同观察拒绝收束、16条历史、8次同方连续拒绝上限原样保留。

未改Core、RNG、补给、publicRules/PlayerView、评分、移动/路径、Host或生产源码；没有兵力调动规划、训练、留出集、部署、PR、Hook。

## 定向验证

构建命令 `node ai/build.mjs` 通过；只编译隔离.ai-dist，没有生产发布。

`node --test ai/tests/combat009.test.mjs ai/tests/lab002.test.mjs` 首次运行4个既有LAB测试通过（包含54组默认战斗评分/决定一致性），新测试有2项因夹具假设错误失败：G-INF攻击是5，单攻S-INF防御3已经过门槛。改用原S-TANK防御5形成单攻5/5不足、联合10/5满足的合法场景，不修改模板/参数迎合测试；保存tests-first-fixture-failure.log（仅清除行尾空白，保留全部诊断内容）。

随后 `node --test ai/tests/combat009.test.mjs` 当时6项通过，见tests.log；只对随后补充的真实己方损失分配测试运行 `node --test --test-name-pattern='joint attacker loss' ai/tests/combat009.test.mjs`，1项通过，见loss-test.log。当前新文件合计7项，另4项既有LAB通过，共11个相关测试；没有重跑全量套件。复用006既有移动、成本、公平及回放证据。

覆盖：

1. 两个单攻均不够、联合达到原门槛、通过FairHost与Core；重复ID被Core拒绝，所有攻击者资格消耗，之后不能再攻击。
2. 即使联合仍不够时选择等待；被拒联合不会立即重试，原三次收束有效。
3. 已攻击、专用于修铁路、死亡、其他控制者、零攻击、非相邻单位不进入组合；允许正常已移动单位；CONTACT不能攻击。
4. 等总攻击力的单/联合同分；加入渡河单位可以降低评分；逐单位OOS取整；不使用support字段、不重复计支援。
5. 18人围邻控制夹具生成64个组合，含2/3/4人；总数≤128、单攻保留、去重且倒置view.units后顺序/内容相同。
6. 相同授权视图下改变隐藏敌军组成/位置及未来RNG，候选与决定相同，政策调用不改变权威状态。
7. 原合法战斗夹具中的真实联合宣告→防御反应→战后选择（seed8246）及→己方损失分配（seed17），每一步通过Core并按Action回放终态相同。详细短日志：joint-forced-flow.json、joint-loss-flow.json。

这些定向通过不代表所有撤退战例已经通过；4局发现的集成缺项如下。

## 4局配对、完整性与成本

只运行17/18、候选德/苏共4个job，命令 `AI005_ROOT=../ai005-fixed node evidence/ai-combat-009/batch.mjs`。复用006对战骨架、initial、FairHost、记录与Action重放；固定对手从独立干净695ca052工作树完整导入编译模块，不使用共享新candidates的frozenBasic伪装旧对手。

对照是006原4局与本次009在**同一AI005对手**下的配对结果；不是009直接对006。脚本确认对手runtimeHash、rulesHash、scenarioHash、mapHash、agent seeds（德101/苏202）、默认参数完全相同。旧4局仅读取既有日志并赛后重建损失事件，没有重跑旧策略。

沿用maxDecisions=1800、每局180秒、批次720秒，以及单独进程看门狗；只4个固定job，没有重抽种子/补跑异常局。耗时约38.5/61.1/46.9/57.3秒（终态重放另计），不同终止时点且云端负载未控制，不能用这组数字宣称性能优化。

每条原始trace保留选择、观察哈希、状态，record保存字节数、条数、traceHash、finalHash。批次结束后 `metrics.mjs` 只重放记录Action，核对Core接受/拒绝及终态哈希，统计ATTACK参战人数、UnitStepLost、UnitDestroyed与MOVE格数。完整状态/事件仅在赛后评估，不回传策略；动作中仍只有授权PlayerView。

`node evidence/ai-combat-009/compare.mjs` 读取4份新record及4份006原record，校验完整性并复建旧损失指标；`node evidence/ai-combat-009/summarize.mjs` 只据已存数据生成研究摘要与修正后的派生汇总。record.replay保留新局攻击、损失、拒绝事件索引，control-metrics.json保存旧局对应统计。终止REJECTION_LIMIT也应计一次拒绝，旧复用脚本曾漏计最后一次；现已改正统计并保存rejection-count-corrections.json，raw trace从未改动，也未重跑对局。

4局重放哈希均通过；2局正常到T16（均苏军胜），2局REJECTION_LIMIT无正常胜者。18候选苏军整局traceHash和finalHash与006同座位完全一致；该局0次联合，不强迫制造攻击。

## 集成异常与结果边界

共54次联合ATTACK经Core接受，0次ATTACK拒绝。可见局部兵力确实被组合利用，且有联合消灭目标后普通MOVE进入原目标格的日志，见opened-hex-examples.json；不能由这一局部事实推出胜率提高。

共23次拒绝：6次MOVE/ENEMY_ZOC_STOP，17次RETREAT/INVALID_RETREAT。其中：

- 17候选苏军：T14 n739～746，固定AI005德军G-J-02的撤退连续8次失败，嵌套stepIssues为ENEMY_ZOC_STOP@(17,3)，触发原Host上限。
- 18候选德军：T12 n632～639，候选德军G-ENG-01撤退连续8次失败，嵌套stepIssues为ENEMY_ZOC_STOP@(13,3)，触发原上限；另n505苏军S-MOT-02一次撤退最大可行距离不匹配，随后流程恢复。

错误原因只用于赛后分类，不传给策略。此处不追加撤退搜索或提高拒绝上限。两个异常局的损失、攻击及距离是停局时累计量，不能直接与006的T16当作等时长结果比较；不计正常胜负。日志/回放完整性通过与“完整对局验收通过”必须分开，当前后者**未完整通过**。

主要限制：组合上限4与64/128会漏掉一些备选；评分仍是保守估计，不预测CRT、不规划兵力调动、不保留单位给未来攻击；更多攻击伴随己方损失增加，不以次数为优势。下一步可由研究聊天先提出针对两段撤退失败的独立任务，本轮不越范围修复。

## Git交接

仅一个AI运行文件、一个必要测试文件与本目录证据。原完整回放和新4局日志均保留Git；summary.md可直接粘贴/读取。提交使用[CF-Pages-Skip]，远端分支ai-combat-009，未改main/source-main、不force push。工具夹具失败、统计漏计与真实对局异常分别见failures.json，不合并为正常败局，也不报告“全程无异常”。
