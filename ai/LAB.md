# AI-LAB-002：研究聊天交接

这是离线批量评估工具，不是训练系统。固定基线为 AI-005 `695ca0524eb039808491b18c69cea1fb74da0cca`；LAB002从 `e8cfb5e5` 增量接入已有攻击评分系数。无浏览器/生产/后端部署；性能追查保持暂停。

## 运行
在仓库根目录，使用锁定依赖和 Node 24（本轮24.19.0）：
```sh
npm ci --ignore-scripts
node ai/lab/runner.mjs ai/lab/example.json tune /tmp/eastfront-lab-tune
node ai/lab/replay.mjs /tmp/eastfront-lab-tune/tune-17-GERMAN/attempt-1/record.json
```
每次 runner/replay 都复用 `ai/build.mjs` 编译隔离产物，不构建/发布预览。不依赖付费服务、网络API或训练平台。支持注册表 `ai005`（冻结副本）、`minimal` 和 `ai005-param-v1`（参数化候选）；不能传任意脚本路径或全知策略。基线必须为 `ai005`。

复制 `ai/lab/candidate-002.json` 即可开始一次固定候选实验。默认值与AI-005一致；仅候选版本 `ai005-param-v1` 接受以下参数，省略键补默认，未知键、非数值/非有限值及越界值拒绝。基线 `ai005` 与 `minimal` 仍仅接受 `{}`。固定副本 `ai/lab/frozenBasic.ts` 启动时逐字核对695ca052原版（仅import相对路径调整），共享的路线/候选/强制流程也维持原版。

| 参数 | 含义 | 默认 | 范围 |
| --- | --- | --- | --- |
| attackRatio | 无不利因素时的最低估计攻防比 | 1.5 | 1–3 |
| penaltyWeight | 每单位已知地形、堑壕、跨河不利因素增加的门槛 | 0.75 | 0–1.5 |

评分沿用 `required = attackRatio + penalty * penaltyWeight`；通过门槛后仍是原 `10 + min(10, ratio-required)`。这是AI意愿参数，不修改Core攻击合法性或CRT。降低参数可能增加冒险攻击，更多攻击不等于更强。这两个范围是有限实验边界，并非已验证的最优区间。本轮只跑预先指定候选 `{ "attackRatio": 1.25, "penaltyWeight": 0.5 }`。

```sh
node ai/lab/runner.mjs ai/lab/candidate-002.json tune /tmp/eastfront-lab-002
```
配置固定调参种子17/18，候选对AI-005双席共4局；每局1800行动、120秒，批次480秒。汇总位于输出目录 `summary.json` / `summary.md`，异常见 `anomalies.json`。重用目录只用于原配置续跑，不用于另一组参数。

- `maxGames`：当前split的总局数，2..400且为偶数；每个种子固定跑候选德军/候选苏军两局。种子多于上限时取前若干完整席位对。生产地图/场景固定。
- `maxDecisions`：每局1..10000次host.step，接受、拒绝、强制战后步骤均占预算，不只是MOVE/ATTACK。
- `matchMs`：每局50..600000ms，包括子进程启动。父进程看门狗可终止同步死循环，子进程也逐步检查。
- `batchMs`：每次命令的对局执行阶段50..3600000ms；不含依赖安装、编译和末尾汇总IO。顺序执行，一个子进程/局，无后台无限搜索。达到批次预算记录BATCH_TIMEOUT并停止。
- 固定combat种子；agentSeeds独立固定为GERMAN101/SOVIET202，与既有比较一致。seed0允许；公平输入之外不提供隐藏信息。

## 中断与续跑
Ctrl-C / SIGTERM 杀掉当前局子进程并记录INTERRUPTED、已有trace；再次执行**相同命令/配置/源码/运行版本**，跳过已完成局，只从头重跑被中断或BATCH_TIMEOUT的局。局内不恢复私有Host内存；重跑靠固定种子确定性。旧attempt保留，不被覆盖。
正常结束、ACTION_LIMIT、TIMEOUT、ERROR、AGENT_STOP等已有结论不自动重试。改变预算或候选请用新输出目录；身份不符拒绝续跑。输出目录有独占`.lock`，避免双runner覆盖；若runner被SIGKILL或机器崩溃，确认owner.json中的进程及其子进程均已终止后才手动移除该目录的`.lock`。无record的孤立attempt保留trace，下次从新attempt重跑，不声称已保存完整终局。

## 读汇总
- `manifest.json`：配置、策略基线SHA、运行时/源码/工具内容哈希、Node、规则/场景/地图ID与哈希。sourceCommit是当时checkout父提交，sourceHash/labHash标识当时待提交工作树的实际字节；本交付commit包含这些文件，不能只用sourceCommit重建工具。后续干净checkout运行会记录本交付SHA。
- `summary.json` / `summary.md`：仅GAME_OVER计正常胜负，候选两席分别统计；德苏不对称，**不以50%为平衡目标**。小样本校准不能估计稳定胜率。没有正常终局时分母为0，不能当作0%胜率。
- `anomalies.json`：所有已归档异常attempt及回放路径，包括已重跑的中断；不会因为重试成功删掉异常。
- 每局 `latest.json`，每次 `attempt-N/record.json`：种子/席位策略参数/版本哈希/规则标识/结果/回合数/攻击数/拒绝数/耗时/异常原因，以及完整结束后的objectiveProgress（德军控制首都格数、总目标格数、存活德军到首都的最小六角距离）。这是终局目标位置快照，不是全局推进曲线，也不用于策略反馈。超时无完整状态时只报已落盘前缀，回合可能null。
- `trace.ndjson`：逐步授权观测hash、意图与host结果；`stderr.log`保留错误。错误可能发生在最后一步落盘之前，不保证捕获被强杀的在途行动。日志是可信离线评估产物，不注入策略或UI。
- 回放命令验证已接受Action序列与最终state hash。中断/超时只有前缀验证；不伪称完整重放。末行写入被打断时忽略该不完整行，其他JSON损坏报错。

完整权威状态仅在run结束后通过auditOmniscient读取以计算终局hash/统计；策略仅获FairHost冻结的授权DTO，保留原反馈契约。子进程用于资源/取消隔离，不是恶意代码安全沙箱；未来策略注册必须继续审查公平依赖图，不能将审计对象作为闭包传入。

## 调参与留出集
LAB002例子tune=[17,18]、holdout=[1017]，互不重叠且强制校验。本轮**没有运行留出集**。研究聊天先给出候选改动假设、参数名/范围、固定基线与小批次预算；研究聊天可直接在上述范围内提出下一组候选值，用新输出目录跑明确授权的小批次；范围外参数、新策略或规则改动须另立任务。参数版本、完整参数与源码hash均进入日志，固定基线不可跟随候选改变。

只在调参集比较候选对固定基线，覆盖双席；不只看候选自战。冻结候选后，单独执行：
```sh
node ai/lab/runner.mjs candidate.json holdout /tmp/eastfront-lab-holdout
```
留出结果不能再反馈本轮调参；若已据此修改候选，该集合已变成开发集，下轮另选未使用留出种子。汇报须给两席正常终局数、胜负、攻击/拒绝和异常比例，不挑掉失败局。跨规则比较需另立规则平衡任务、固定AI版本，禁止同时调整规则和策略参数；目前工具也会拒绝冻结Core/规则树有差异的运行。

## 本轮证据与继续方式
最新四局结果见 `evidence/ai-lab-002/batch/summary.json`；默认一致性/参数生效见 `evidence/ai-lab-002/tests.log`。LAB001工具证据继续引用 `evidence/ai-lab-001/REVIEW.md`。研究聊天读取这些文件即可，不必重跑既有测试。推荐下一次小批次先4局（2调参种子×双席），按本机实测约2分钟纯对局，设置每局120秒、批次300秒以允许波动；并非性能保证。LAB002已运行指定4局，后续不自动追加或无限搜索。出现超时/错误/拒绝上限先停止选优并检查异常；预算到达或用户中断即停。若候选在定向局面未改变决策，先检查参数接线，不扩大对局量。规则平衡仍须固定AI另立任务。


## LAB002交付验收
候选1.25/0.5对冻结AI-005，17/18双席4局均GAME_OVER，第16回合苏军胜；攻击3/3/2/2，拒绝0，终局德军首都控制0/2、最近距离10。最终状态均与相应种子的既有AI-005证据相同：这组候选未在4局体现行为增强；定向局面分别证明两个参数可改变实际选择，不能将战役无差异误判为参数未接线。留出1017未运行/未查看结果。

新参数测试3项＋候选隐藏信息测试1项；复用策略测试8项（其中包含2局默认参数确定性回归）和工具测试3项通过。默认54组阈值/地形局面评分及选择与冻结副本相同。4局Action回放最终hash验证通过，未追加候选对战。详细日志在evidence/ai-lab-002，沿用LAB001取消/续跑证据，不重复全套。

必须保留的异常：批次结束后发现17苏军/18德军日志各缺尾15/3行；record中已保存的完整traceHash分别与另一席完整日志相同。保留原始缺尾文件，经完整hash及前缀校验复用匹配副本后回放通过（journal-integrity.json、replay-first-failure.log、recovery.log）。缺尾原因未知，不计作游戏输局，也不掩盖日志可靠性缺口。研究聊天下一次运行应先核对traceHash；若重现缺尾，停止扩批并另立日志持久性检查，不凭summary单独选优。未修改调度/日志系统来猜测修复。
