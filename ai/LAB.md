# AI-LAB-001：研究聊天交接

这是离线批量评估工具，不是训练系统。本轮策略源码逐字冻结到 AI-005 `695ca0524eb039808491b18c69cea1fb74da0cca`，从性能交接 `abdd919c` 开独立分支。无浏览器/生产/后端部署；性能追查保持暂停。

## 运行
在仓库根目录，使用锁定依赖和 Node 24（本轮24.19.0）：
```sh
npm ci --ignore-scripts
node ai/lab/runner.mjs ai/lab/example.json tune /tmp/eastfront-lab-tune
node ai/lab/replay.mjs /tmp/eastfront-lab-tune/tune-17-GERMAN/attempt-1/record.json
```
每次 runner/replay 都复用 `ai/build.mjs` 编译隔离产物，不构建/发布预览。不依赖付费服务、网络API或训练平台。支持的策略是注册表 `ai005` 和现有 `minimal`，两者源码均来自固定AI-005树；不能传任意脚本路径或全知策略。基线必须为 `ai005`。

复制 example.json 到新的实验配置，明确 candidate.version、baseline.version、两套种子和上限。`params` 本轮只接受 `{}`，未知键直接报错：现有常数混合路线约束与风险/攻击门槛，尚未挑出有独立评估意义、值得暴露的少量权重，故采用任务允许的“先交付评估框架”。不宣称已实现自动参数搜索。`ai005` 对 `ai005` 是同版本校准；`minimal` 对 `ai005` 可作弱策略对照，不是更强候选。

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
- 每局 `latest.json`，每次 `attempt-N/record.json`：种子/席位策略参数/版本哈希/规则标识/结果/回合数/攻击数/拒绝数/耗时/异常原因。超时无完整状态时只报已落盘前缀，回合可能null。
- `trace.ndjson`：逐步授权观测hash、意图与host结果；`stderr.log`保留错误。错误可能发生在最后一步落盘之前，不保证捕获被强杀的在途行动。日志是可信离线评估产物，不注入策略或UI。
- 回放命令验证已接受Action序列与最终state hash。中断/超时只有前缀验证；不伪称完整重放。末行写入被打断时忽略该不完整行，其他JSON损坏报错。

完整权威状态仅在run结束后通过auditOmniscient读取以计算终局hash/统计；策略仅获FairHost冻结的授权DTO，保留原反馈契约。子进程用于资源/取消隔离，不是恶意代码安全沙箱；未来策略注册必须继续审查公平依赖图，不能将审计对象作为闭包传入。

## 调参与留出集
例子tune=[17]、holdout=[1017]，互不重叠且强制校验。本轮**没有运行留出集**。研究聊天先给出候选改动假设、参数名/范围、固定基线与小批次预算；实现/注册新参数须另行审查，不得偷偷改变此工具冻结的AI树。未来新策略版本应以新的固定源码SHA与注册表增量接入，并保留当前基线实现。

只在调参集比较候选对固定基线，覆盖双席；不只看候选自战。冻结候选后，单独执行：
```sh
node ai/lab/runner.mjs candidate.json holdout /tmp/eastfront-lab-holdout
```
留出结果不能再反馈本轮调参；若已据此修改候选，该集合已变成开发集，下轮另选未使用留出种子。汇报须给两席正常终局数、胜负、攻击/拒绝和异常比例，不挑掉失败局。跨规则比较需另立规则平衡任务、固定AI版本，禁止同时调整规则和策略参数；目前工具也会拒绝冻结Core/规则树有差异的运行。

## 本轮证据与继续方式
见 `evidence/ai-lab-001/REVIEW.md`、`smoke/summary.json`。研究聊天读取这些文件即可，不必重跑既有测试。推荐下一次小批次先4局（2调参种子×双席），按本机实测约2分钟纯对局，设置每局120秒、批次300秒以允许波动；并非性能保证。本轮不自动执行建议批次。
