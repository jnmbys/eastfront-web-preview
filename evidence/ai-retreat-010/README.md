# AI-RETREAT-010

基线 `d6470f331a7afd3758a6eeb0f5935e8201f98767`，独立分支 `ai-retreat-010`。管理状态复用已核实远端 `c7531c70fab4b7c7402cd2f7d927c2134adee228` 的 PROJECT_STATE / WORKER_PROTOCOL；不合并管理分支运行代码。研究聊天入口：[summary.md](summary.md)，机器数据：[summary.json](summary.json)。

## 先定位，后修改

原009完整trace及record原封不动保留。009未单独保存中断前状态文件，故先按原Action重放前缀（不调用策略生成新局），逐项核对原observationKey及Host返回；在17苏n739、18德n632的首次RETREAT提交前保存state/input gzip。两份stateHash均等于原异常局finalHash，因为其后8次拒绝均未改变权威状态。随后对原8次动作复核原策略选择、视图key、逐次Core错误和候选序号。

|问题|17苏 T14 / B-000008|18德 T12 / B-000031|
|---|---|---|
|实际决策方|固定AI005德军 / G-HUMAN-1|候选009德军 / G-HUMAN-1|
|待撤单位|G-J-02@(17,4)|G-ENG-01/G-I-07@(12,3)，G-J-02@(11,3)|
|要求距离|2格|1格（逐单位按提交顺序）|
|反复受阻首步|(17,3)|(13,3)|
|旧首个实际合法候选|第10项（index9）|第14项（index13）|
|旧8次拒绝|4次非法ZOC路径、4次未执行最大可行距离|7次非法ZOC路径、1次未执行最大可行距离|
|修复后接受路径|G-J-02: (16,5)→(16,4)|G-ENG-01/G-I-07各→(11,4)，G-J-02→(10,4)|
|恢复|第6次提交接受，后续强制流程完成|第6次提交接受，后续强制流程完成|

分类结论：**合法选择已生成但排得太晚**。原DFS依次耗尽一个首步的后缀，或一个早序单位固定路径下的后序单位组合。各8次动作完全重复0次，但受阻前缀重复；minimalAgent对整个动作去重有效，未解决结构性重复。拒绝后状态、观察key不变是正确的事务回滚，不是状态未刷新。空路径不能替代实际存在的最大合法撤退距离，Core按既有契约正确拒绝。没有发现这两个节点需要更改Core/规则的证据。

当时授权可见单位、CONTACT/LAST_KNOWN、自身历史、所有候选和每次拒绝，见 `checkpoints/*-input.json.gz`、`*-diagnosis.json`。策略从未收到Core错误；诊断中的真实合法性、隐藏ZOC来源仅离线核验，标记为offlineOnly，不反馈给决策。隐蔽首步阻挡本身不能通过全知过滤解决。

## 最小修复与边界

仅运行文件 `ai/fair/candidates.ts` 的retreatCandidates修改：

1. 相同路径长度内，按首步分组轮转，不先耗尽单个首步的所有后缀。
2. 将多单位分配的DFS改成惰性分支轮转，让早序单位的替代路径及时参与；单位提交顺序仍按ID，授权友军占位按已提议路径顺序模拟。
3. 保留原满长/短/空路径族、显式空路径保留位。退距仍只支持0～2；至多128候选、4096分配节点，Core/Host连续8次拒绝及16条历史不动。两格退距下同首步最多6条后缀，轮转循环据此有界。

静态排序不读取拒绝细节，不推断哪一个参与者/格子一定非法。最初仍可能走入未知ZOC，失败后仍只靠原通用反馈排除已拒的完整动作。隐藏世界中的合法路线不保证在上限内被找到；没有把该修复写成完整撤退求解器。Core、RNG、规则、补给、PlayerView/Host、联攻候选/评分、参数、移动和人工接管均未改。

## 验证与复现

`node ai/build.mjs` 通过，build.log为空是正常成功输出。

`node --test ai/tests/retreat010.test.mjs` 5项全部通过（tests.log）：

- 两个真实检查点：使用原授权input决策，仅在拒绝后追加允许的通用反馈；Host再次校验、Core接受，后续强制流程结束，实际Action重放终态一致。新Host没有历史敌情记忆，因此另断言其单位视图和候选与保存input一致；决策仍使用保存input，未以重建记忆冒充原记录。
- 隐藏ZOC、未来RNG的相同授权视图输出一致。原合法战斗夹具经ATTACK/PASS_REACTION产生RETREAT，真实无路可退时空路径由Core接受并执行额外损失，没有手造pending或伪造成功。
- 存在路线时空路径被拒绝，正常重试恢复；恶意重复同一非法动作仍第8次终止，状态无变化。
- 候选唯一、确定、至多128，逐单位顺序占位满足已知堆叠；CONTACT不补成确定占位/ZOC；通用拒绝去重与候选耗尽STOP保留。

复用009已有11项攻击/公平/参数及构建证据；未重跑全量、浏览器或华为测试。此次定向检查没有失败或重试改夹具记录。

需要重建诊断时，先准备基线009隔离工作树并构建（复用现有node_modules，勿改基线文件），设置 `COMBAT009_RUNTIME=/absolute/frozen009/.ai-dist`，执行 `node evidence/ai-retreat-010/checkpoints.mjs`。该命令仅读旧trace并重放动作、离线核验候选，不运行新的完整策略对局；通常无需再次运行，已保存检查点足够进行定向测试。不要把checkpoints权威state导入fair模块。

## 四局与统计口径

定向通过后，才执行一次 `AI005_ROOT=../ai005-fixed node evidence/ai-retreat-010/batch.mjs`。复用009 runner / metrics，17/18交换候选席位共4个job，1800决策、单局180秒、批次720秒及子进程看门狗。固定对手移动/攻击来自干净完整AI005构建，双方RETREAT入口统一转给010 minimalAgent；其他强制流程仍各自原策略。这一共享流程修复是明确的实验变量，不能声称固定对手全行为未变。

build记录源码父提交、尚未提交的fair diff哈希、实际编译runtimeHash及固定AI005 runtimeHash。sourceParent不是运行修改后的源码SHA；最终包含源码/测试/证据的Git提交才是可获取交付。日志保留所有拒绝（包括终止REJECTION_LIMIT），每局校验字节数/条数/traceHash并离线Core重放finalHash。

`node evidence/ai-retreat-010/summarize.mjs` 只聚合现有4份record和009对照并做完整性检查，无新局。summary.json保留逐回合最近距离、双方攻击/联合攻击/损失步/消灭单位/普通MOVE总格数/拒绝、异常、耗时及首次与009不同的动作位置。损失来自真实UnitStepLost事件，消灭另列，避免混淆。最近距离按存活德军到首都最小距离计算，不等同同一单位推进；死亡可能改变该指标。旧两局中断累计量不得与T16当作等长战绩。

原始失败证据未覆盖；新检查点、定向日志、4局trace/record、summary均入Git。未部署、未触main/source-main、未创建PR或调用Hook；提交前缀[CF-Pages-Skip]，不force push。
