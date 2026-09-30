# AI-EVAL-012：战后推进修复的留出对照

状态：8局固定留出已完成；只验证，未改策略/规则、未部署，未干扰SUPPLY-VERIFY-016。研究聊天直接读取 [comparison.md](comparison.md)；机器数据 [summary.json](summary.json)。

## 结论

没有支持“战后推进改善战役目标进展”的留出证据。候选德军在1017/1018分别实际推进16/14次，每次局部首都距离减1，但终局最近距离从基线10/11变为13/12，均更远；两版本首都德控均0/2。两首都格原始control均null，不称为苏军占领。逐回合快照和首个行动分歧均保留，不能把全军最近距离误解为单个推进单位的路径。

德军受测局：1017德军损步2→3、消灭0→0，苏军损步51→42、消灭14→12；1018德军损步1→1、消灭0→0，苏军损步57→27、消灭17→7。拒绝分别8→3、7→10，未发生拒绝上限或游戏流程异常。苏军受测的两对完整trace及终态均一致。8局均T16苏胜，但德胜不是本任务通过标准。

30次推进的随后敌方回合窗口全部完整，推进者损步/消灭均0/0，基线同单位同窗亦0/0。**固定AI005苏军在德军受测局中，两个种子的攻击数都是基线0/候选1**，反击覆盖很弱；没有观察到明显更差的即时暴露损失，但这不是面对充分反击的安全性证明。1017德军全局多损1步，与“推进者下一敌回合损失为0”是不同指标。1018候选的1步德军损失来自苏军回合的G-REC-02，该单位不属于任何推进事件。

相同初始种子不保证每场战斗骰点逐一相同。德军受测局RNG总抽样次数1017为90→74、1018为96→62；行动变化改变消耗顺序，不能将之后各场战斗视为共同骰点的严格配对。保留混合/不利结果，不调参、不补跑更多种子。

## 固定范围与来源

- 管理规范：collaboration-setup-001 @ c7531c70fab4b7c7402cd2f7d927c2134adee228 的PROJECT_STATE.md、WORKER_PROTOCOL.md；候选树无AGENTS.md。未修改共享管理文档。
- 基线：ecb15ce201a4ca096bab2cb918f7c295dd474eda；候选：3f9c1441c50a4cb44638c816070df58d6bc96db6，后者直接以基线为父提交。
- 固定对手：695ca0524eb039808491b18c69cea1fb74da0cca完整fair模块独立构建，未使用共享当前routing/candidates的lab/frozenBasic冒充原策略。
- 8局双方RETREAT均显式委托同一010 minimalAgent，其余各自策略。基线和候选candidates/minimalAgent字节相同；Core、authority、src/core-adapter与固定AI005对应文件Git blob一致。
- 每种子：基线/候选 × 德/苏受测席位，对手相同。默认参数attackRatio=1.5、penaltyWeight=0.75；agentSeeds德101/苏202；默认生产地图、场景、规则、部署初态；1800决策/180秒每局、1440秒批次。config.json及rulesIdentity/initialHash固定并核验。
- 既定留出只有1017。检查LAB文档、配置及006～011/研究任务的manifest和文档，均使用17/18且声明未动留出；树中无1017/1018结果路径。按自然相邻值补定1018。seed-audit.json保存检索文件SHA和相关行，范围限指定候选的Git证据，不声称排除仓库外未归档实验。
- **首局前**本地预登记提交9a1bf6c54b735af66a86405193e8c19aa0549024；远端等树预登记b410db6145cb5a9fdb329c810b776b874ceba42d。远端发布较晚，不能冒称先于首局；未修改预登记字节。

## 实现与复现

独立目录C:/Users/jinyibo/eastfront/ai-eval-012，分支ai-eval-012。直接Git传输不可达，使用GitHub连接器取得文件与Git树。只读复用其他目录的相同blob时先验SHA，再复制至本任务；未写入其他任务。候选commit/tree对象按原始Git SHA重建，使用稀疏本地对象库，未下载与验证无关的旧大文件；远端结果基于完整候选树增量保存，不删除既有文件。

复现环境Node v24.19.0、锁定依赖npm ci --ignore-scripts。脚本会验证source-manifest.json中的源码Git blob；frozen保存2个基线差异文件和原AI005的6个fair源文件。其余均来自候选，构建到.evaluation与.ai-dist，产物不入Git。build-identity.json保存三份实际运行JS哈希、编译器/Node及配置哈希。

唯一既有工具修改是ai/lab/common.mjs将URL.pathname改为fileURLToPath，修正Windows盘符解析。策略、Core和规则无编辑。任务驱动复用ai/lab的initial、rulesIdentity、hash、atomic、records及canonical replay；使用逐局子进程、固定上限、同步写入与fsync。赛后才读取权威state，单独离线重放统计事件，绝不向policy反馈隐藏信息或错误码。

干净checkout中：

1. npm ci --ignore-scripts
2. node evidence/ai-eval-012/build.mjs
3. 已存8局：node evidence/ai-eval-012/summarize.mjs只做日志核验/汇总，不开新局。不要为了阅读结果重跑游戏。
4. 若今后另行授权复现，使用新独立checkout和新输出目录，保留原batch/manifest；run.mjs可核验后跳过已完成记录，不自动覆盖或重试结论局。

## 检查、异常与完整日志

既有推进5项、撤退5项、参数4项测试通过（tests.log）；既有lab配置/看门狗/异常汇总3项通过（lab-tests.log）。构建通过。未重跑全量Web/Core/浏览器测试，复用原011/010公平边界与诊断证据。

每局batch/<id>/trace.ndjson是完整授权决策/Host结果；events.ndjson为赛后Core事件与RNG轨迹；record.json保存终局、双重回放hash、初态/规则/配置哈希、损失/推进/拒绝明细。所有8局trace字节数、SHA256、解析行数/哈希、canonical replay及事件重放终态一致。summary.json包含8局及4对完整汇总。

保留唯一运行进程异常：首局新脚本用--child，与导入ai/lab/match.mjs的旧CLI入口冲突；旧入口把JSON参数误当文件路径，报ENOENT并置退出1。该首局仍完整执行GAME_OVER、fsync和两份回放核验。batch-run.log、process.log、process-failure.json和run-initial.mjs.txt保留原始证据。只把新驱动参数改为--eval012-child，核验原record后跳过首局，batch-resume.log只执行剩余7局。anomalies.json分别列游戏异常0与进程异常1。不删失败、不重跑首局、不换种子。

准备阶段曾因稀疏文件未补齐server依赖而构建失败，补齐原blob后构建通过；本机npm缓存访问需授权，离线锁定安装后成功。均在留出运行前解决，没有策略调整。研究结论为“不支持目标改善；未观察到即时暴露损失，反击覆盖不足”。后续研究建议不构成本任务调参或扩样授权。

所有任务提交使用[CF-Pages-Skip]，不推main/source-main、不建PR、不触发Hook、不部署。
