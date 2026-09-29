# AI-LAB-001 checkpoint

目标完成：复用FairHost与Core Action回放，提供顺序批量CLI、固定种子双席比较、预算、可中断续跑、身份校验、每局日志、summary与异常回放索引。无训练、部署、付费服务或后台任务。

基线：AI-005 695ca0524eb039808491b18c69cea1fb74da0cca；任务分支从性能暂停交接abdd919c95ddba6d6bc290c4c1752fb419b4a442建立。远端ai-lab-001起始不存在。沿用已读c7531c70的WORKER_PROTOCOL，不改管理文件/生产分支。公平策略/authority/vendor与AI-005逐字相同；仅新增ai/lab、实验测试、ai/LAB.md与本目录。

## 小批次结果
配置 ai/lab/example.json，tune种子17、候选ai005对固定ai005，两席各1局；holdout1017保留未运行。两局均GAME_OVER，第16回合苏军胜，1013接受（含终局Action）、3次ATTACK、0拒绝。两局traceHash一致，最终stateHash一致且等于AI-005已有种子17证据：9c9a3a068d90d7c791fa3029727ef745b2b45935c87e3a45cf352c27ebda11cd。旧summary的accepted1012不含终局，本工具从actionLog计1013，非行为差异。

每局墙钟31.129/29.974秒，总61.103秒（云端Node24.19.0，子进程顺序运行，无浏览器/UI性能含义；不含编译/汇总）。这是同版本校准，不是新策略胜率、已学习或平衡性结论。建议后续每次4局=2调参种子×双席，约2分钟纯对局，保留120秒/局与300秒/批预算；本轮未运行建议批次。

## 验证与索引
- build.log：复用node ai/build.mjs成功；不重复全量测试。
- tests.log：3项定向测试通过（配置/种子隔离/双席与参数拒绝；阻塞子进程强制超时/中断/ERROR；异常胜负排除与部分日志）。
- fair-boundary.log：复用并运行3项既有隐藏部署/隐藏兵力/CONTACT边界测试通过。策略与权限实现未改。
- smoke/summary.{json,md}、manifest.json、两局attempt-1/record.json及trace.ndjson：完整原始对战记录。
- equivalence.json、replay.log：双局轨迹一致；完整Action回放与终局hash一致；对照既有evidence/ai005/ai005-17-summary.json。
- resume.log：重跑相同命令跳过两个完成局，无新attempt，不重复自战。
- integration.log：真实CLI行动上限、完成局续跑、配置不符拒绝、单局TIMEOUT、SIGINT中断→从头重跑通过；其中打印的Resume identity mismatch是预期负例，不是未处理失败。
- action-limit/：2局各1步后ACTION_LIMIT；timeout/：2次50ms看门狗终止，均不计胜负。
- interrupted/：首局中断，旧attempt保留；续跑后两局各10步ACTION_LIMIT。anomalies.json保留中断与上限记录。
- interrupted-replay.log：中断日志前缀1步可回放，不声称在途动作已落盘。
- batch-cap.log、batch-cap/：50ms批次预算导致BATCH_TIMEOUT，后续局未启动；真实耗时55.6ms包括终止/收尾，预算不是硬实时保证。

除上述预期超时/中断/配置拒绝，没有新观察到的游戏错误。研究操作说明/命令仅维护在 ../../ai/LAB.md（仓库路径ai/LAB.md）。定向集可用node --test ai/tests/lab.test.mjs；CLI集node ai/tests/lab-integration.mjs默认输出到独立临时目录，LAB_TEST_OUTPUT可指定新的空目录。本轮已执行其对应各门槛；补入可复现脚本的batch-cap门槛通过单独同命令验证，未为脚本组织调整重复完整对局。

## 限制与下一步
- 只注册现有ai005/minimal；参数仅{}，尚未暴露有独立意义的评分权重，未来参数实现须新任务与固定版本。没有自动搜索或学习。
- 一个地图、一个调参种子的同版本双席校准不足以评估泛化、规则平衡或优越性。留出集未看。
- 续跑粒度是局，不是中途状态；强杀/机器崩溃需先确认旧进程结束再处理锁，孤立trace保留；正常Ctrl-C路径自动收尾。
- 超时可能发生在子进程初始化，回合null/空前缀不是零回合正常输局；因果诊断只能依赖落盘范围。
- process隔离不是恶意代码沙箱；只运行审核注册策略。完整state仅在决策结束后读取评估，不回馈策略。
- 研究聊天先用ai/LAB.md提出小批次候选/参数假设；规则平衡另立任务并固定AI，禁止同步改规则和策略。性能追查继续暂停。

远端保存使用[CF-Pages-Skip]，不改main/source-main/ai-preview-001，不创建PR、不调用Hook、不force。本目录sourceCommit字段是执行时父checkpoint，sourceHash/labHash记录当时工作树新增工具字节；交付commit包含对应工具，不将父SHA误称工具已存在的版本。
