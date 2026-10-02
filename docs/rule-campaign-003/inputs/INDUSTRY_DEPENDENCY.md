# INDUSTRY-CONTRACT-004 依赖验收与冻结边界更新

2026-10-02。本项延续004，不重开任务。用户确认RULE-CAMPAIGN-002-R1已经通过Leader离线证据验收；指定证据提交为 `1fe5a2f342928fe9da0cd9f0aaaf825b993483e1`，decisionRef为 `LEADER-RULE-CAMPAIGN-002-20261002`。

## 核查结果及验收边界

已只读核查指定提交的 [审查报告](https://github.com/jnmbys/eastfront-web-preview/blob/1fe5a2f342928fe9da0cd9f0aaaf825b993483e1/docs/rule-campaign-002/r1/REVIEW.md)、[决定记录](https://github.com/jnmbys/eastfront-web-preview/blob/1fe5a2f342928fe9da0cd9f0aaaf825b993483e1/docs/rule-campaign-002/r1/DECISION.json)、[验证记录](https://github.com/jnmbys/eastfront-web-preview/blob/1fe5a2f342928fe9da0cd9f0aaaf825b993483e1/docs/rule-campaign-002/r1/VALIDATION.json)和布局审查。原CONTRACT、FIELDS、BOUNDARY_CASES、CROSSCHECK、VALIDATION_HANDOFF、fixtures及CHECKS七份文件与 `9ed3f4f16450c2ff936de242b328c7ba30059dc5` 逐字节相同；逐文件SHA256见 [DEPENDENCY_R1.json](DEPENDENCY_R1.json)。

契约仍是CAMPAIGN-SETTLEMENT-002-candidate.1。R1补充许可记录和可复算证据，没有改变本次计算依赖；因此保留004已完成的003精确复现、首笔订单后续算及窗口对照。本次没有再次运行R1核验器或004账本，不将R1已记录的核验结果冒充本次新执行结果。原始计算提交为 `5dfa4a23835df6a78f5f574ad7d71ea02c1d38f6`。

离线证据验收不等于候补等额B、同源SP、后方优先已经成为正式默认；不批准Core接入、真实入口、模板初始化、来源/运输服务或目标计分。三个维护条件仍是被测方案，所有004参数和原22SP来源保持不变。用户已确认的E14—E15临时停源仅用于既定压力分支，不扩大为正式来源日历。

## 已有证据如何覆盖继续关注项

|关注项|004已保存的逐事件字段或证据|解释|
|---|---|---|
|候补旧欠|RESULTS.trace.rearRows的arrearsBeforeQ、paidArrearsQ、arrearsAfterQ|独立于本期费；先清旧欠，不漏账或免除|
|候补本期维护|currentDueQ、paidCurrentQ；每E维护Owner|入场当E切为FRONT，不能同E同时收REAR与FRONT|
|前线可用来源|rows.frontSourceAvailableSP、frontIssuedSP、sourceUnusedSP|扣候补后额度、实际收到及未用额度分开，来源额度不是库存|
|维护缺口及D|rows.maintenanceShort；trace.maintRows的dueQ、paidQ、debtBefore、debtAfter|逐单位保存D变化；满维护而攻击空仓不记作维护欠额|
|后续完成、部署、行动|finalOrders及各T orders/entryRows/unitActions；ORDERS.md、WINDOWS.md|有接受/完成/最早入场/条件入场时间及每次攻击扣费前库存；不只替换期末统计|
|未承诺对照|四路线T13下单前fork.state与相同哈希|之前订单继续付费，没有删除订单或免费取消|

上表的RESULTS指RESULTS.json中各条results对象；q=0.25SP。记录为条件事件，仍不具备Core合法入场证明。

关键判断保持原样：B在E16支付旧欠4SP和本期2SP，前线源余16SP，足额维护后储备0；同起点未承诺新增订单对照支付旧欠2SP和本期1SP，源余19SP，受运输约束实收17SP，维护后储备1SP。C对应储备4对7SP。停源期间的维护不足单列，不能全部归因清欠；未观察到额外当前维护欠额不代表后方优先已安全通过。

## 020空间证据补齐但功能仍未确定

R1的 [布局审查](https://github.com/jnmbys/eastfront-web-preview/blob/1fe5a2f342928fe9da0cd9f0aaaf825b993483e1/docs/rule-campaign-002/r1/LAYOUT_REVIEW.md)与 [结构化未决字段](https://github.com/jnmbys/eastfront-web-preview/blob/1fe5a2f342928fe9da0cd9f0aaaf825b993483e1/docs/rule-campaign-002/r1/layout-review.json)引用020提交 `2aa9a655e2906667929f3828d4dd6f58d7286ea2`。本次依据R1固定审查读取其出处，未另行运行美术或地图校验。

J7、M14、R9、AD9继续只是装卸/仓储/维修空间候选。R1指出四处设施到接轨点没有已定义的真实交通边或transferPermission；相邻和同一城市群不能构成物流资格。空间、运输节点、维修能力、工业产能分别待审，不增加生产或补给源，不改变004抽象基地的条件性质。

七组objectiveId、initialOwner、homeSide、captureHexes、vpValue及工业收益继续未决。null表示UNRESOLVED，既不是零分、零产出工厂，也不是中立归属。保留profile和SOURCES中的初算来源记录，本新增依赖记录承载后来补齐的空间出处，不借改元数据重写计算输入或审计哈希。

## 本次保存与后续范围

只新增本说明与依赖核对JSON，并更新报告中的依赖状态和空间出处。003原始结果及004的profile、程序、账本、差异、审计与复现哈希文件全部保留；已记录这些004文件当前SHA256供复核。

不重复敏感性扫描，不提高来源、免费用、改耗损或扩展工业系统。若后续契约发生语义变化，应先对齐版本，再从首个受影响事件定向续算。当前无此变化；继续保持独立分支远端保存、不合并、不部署。

## CAMPAIGN-003已验收证据仅供后续候选

用户确认CAMPAIGN-003通过Leader验收并冻结于 `559fb7df1e6ecbf357ee8f263dd1b2cfaa4105dd`。已只读核查其 [REPORT.md](https://github.com/jnmbys/eastfront-web-preview/blob/559fb7df1e6ecbf357ee8f263dd1b2cfaa4105dd/docs/campaign-003/REPORT.md)：在CAMPAIGN-001旧代理内，货运净维护之后改为SP储备优先，T6—T12实际攻击支付从24SP增加到38.25SP，伴随夺点与终局VP变化，也付出维修延后、扩军减慢和设备积压代价。这里是引用已冻结报告，不是004新增实验或跨模型复现。

该旧代理保留下一T自动入场、同时攻防等自身条件，没有接入新候补合同；其SP来源、攻击策略与空间推进也不等同004。故只登记为未来可能检验的假说依据，不能把它的优先级、夺点或VP移植到本次结果，更不能宣布candidate.1已经平衡。

004继续冻结：候补等额B、同源支付、按单旧欠先于当期且后方先于前线；剩余前线运输先保证可满足的净维护，再发装备，再补SP储备。没有采用CAMPAIGN-003的“储备先于装备”干预，也没有提高来源、改变003/004行动政策或重新运行实验。战略Worker收口不触发跨聊天指令；本次只完成工业交付的依赖登记和远端保存。
