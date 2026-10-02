# RULE-CAMPAIGN-003｜真实地图最小接入候选

2026-10-02。**交付实现评审配置及拒绝式离线校验器，不是已可加载的场景。** 分支`rule-campaign-003`从规则R1建立，只新增本目录。CAMPAIGN-004、工业004、R1均固定引用，未合并其研究代码、未重跑实验，也未修改Core、地图、运行默认或部署。

配置：[candidate.json](candidate.json)；校验：[validate.py](validate.py)；实际检查结果：[VALIDATION.json](VALIDATION.json)；来源及哈希：[SOURCES.json](SOURCES.json)。`null`表示未决，运行门禁必须拒绝，不能转成0、空权限或默认允许。

|固定输入|完整SHA|本轮用途|
|---|---|---|
|CAMPAIGN-004|268ea7bd3d139936c4c6e52579cd4a84470e2611|真实接口接受/拒绝、全军与节点事实；只读已保存证据|
|RULE-CAMPAIGN-002-R1 / 分支基线|1fe5a2f342928fe9da0cd9f0aaaf825b993483e1|candidate.1的离线许可及结算/维护契约|
|INDUSTRY-CONTRACT-004|46529bef14a331b07947cb9bb5e352825af6640b|原22SP条件模型、配方/候补条件；不把它重命名成真实地图输入|
|运行源码|813b4072568352e95d0726fe5fe04060c889c554|只读查看live、Core恢复/增援和原SP求解接口|
|ART-LAYOUT-020|2aa9a655e2906667929f3828d4dd6f58d7286ea2|沿用R1的空间审查，不授予规则功能|

`LEADER-RULE-CAMPAIGN-002-20261002`仅许可离线候选。新映射、服务授权和P/E接入都没有运行批准；candidate.runtimeEnabled=false、runtimeApprovalRef=null。

## 1. 真实source、depot、receiver、entry分别注册

这四类ID不是同一种对象。现有source有真实SP额度，hub有真实SP库存/约束；新depot是P/E组建账户，receiver是装备/人员入库服务，entry是工业单位入场授权。共用一格不等于共用账户或自动获得全部功能。

|侧|真实来源引用|候选源侧depot|候选receiver|候选工业entry|
|---|---|---|---|---|
|G|G-A10，A10，32q=8SP|DEP-G-A10，源侧组建账户锚定A10，仅扣G-A10|REC-G-C10，C10，与GH2同格；不与GH2的SP库存混账|ENTRY-G-A10，A10，GERMAN_SUPPLY_RAIL移动前|
|S|S-AF10，AF10，24q=6SP|DEP-S-AF10，源侧组建账户锚定AF10，仅扣S-AF10|REC-S-AC10，AC10，与SH1同格；不改S-AC10既有SP来源|ENTRY-S-AF10，AF10，SOVIET_REINFORCEMENT_SUPPLY移动前|

G路径引用CAMPAIGN-004修路后的`A10—B10—C10`；S引用`AF10—AE11—AD10—AC10`。都仅为已保存的**SP铁路连通见证**。它们不是设备货运权、共同容量预留或永久畅通保证；每次发运必须重新绑定权威状态/拓扑/容量见证。

选这些点的理由：A10/AF10是原边界源和边界铁路位置；C10是G合法修路后真实出现的恢复基地，AC10是现有S恢复基地/枢纽。避免先创造新的接轨格或跨格服务。**A10/AF10本身并未因此成为Core恢复基地**；C10初期也不是恢复基地。任何新P/E库必须先登记容量、服务权限、库存来源清单和被占后的处理规则，当前这些字段均null。

depot的“源侧”是独立后台账户绑定真实边界节点，不生成地图单位，也不占原SP枢纽库存；这种源侧服务本身需要注册批准。地图外生产→depot的入库来源/运输仍未定，不能以“就在源边”制造免费P/E。运输到前线receiver与组建depot是不同目的地，订单不能远程消费前线库中的物资。

其他现有来源完整保留：G A5/A10/A16各8SP；S AF4/AF10各6、AF16/AC10/AC11各4SP。不能把其他源自动汇成候补池，不能挪用SH1/SH2已有库存抵候补清欠。G A5/A16、S AF4/AF16仅列备选工业入口，首切片不启用；原S的13个增援槽继续独立，AC10是独立来源却不是原东线入口。

### 服务授权与控制权

每次操作至少具备：批准的服务注册ID/用途、side、controller权限、当前revision/snapshotHash、节点状态和专属serviceGrant。敌方控制、敌占、敌ZOC拒绝；未知谓词拒绝。工业入场另查当下活跃边界铁路入口（G复用computeActiveGermanRailNetwork.entryHexKeys，S复用computeActiveSovietRailNetwork.exitHexKeys）、堆叠、已完成订单、清欠、上一E足额维护、正确自方窗口、当T入场额度、永久ID唯一性；不能复用DEPLOY_INITIAL_UNIT或占用DEPLOY_REINFORCEMENT的旧槽。

CAMPAIGN-004开局640格control均null，不能推断为己控或中立。推荐为新服务设计**显式场景服务授权**：若Leader以后批准`REQUIRE_EXPLICIT_SCENARIO_SERVICE_GRANT`，null控制格必须具备针对该服务/侧/用途的可信授权才可处理；明确敌控仍覆盖并拒绝。它不写Core control、homeSide、VP或生产所有权，也不替代敌占/ZOC/堆叠检查。

这是新增授权能力，不是当前Core接口；`approvedNullControlPolicy`和`nullControlApprovalRef`目前均null，所以本候选对null仍明确拒绝。审批不能只填“有坐标”，必须确定可信grant签发/撤销责任、用途范围和同revision检查方式。若Leader不接受该方案，则保持严格已知己控，不能给640格批量填owner解决。

### 020预留不获得功能

J7、M14、R9、AD9仍是visualOnlyNodes，不能填入新库、来源、入口来绕过审批。其邻格J6/M15/R10/AD10是某些状态下的S恢复基地，只可能满足距离条件之一；既有末端步行配送边也不是设备跨格服务权限。首都群AC10/AC11/AD10仍一个候选物理群；本配置不分配objectiveId、homeSide、VP、工业收益。AC10的候选接收账户引用既有节点，与赋予首都三份分数无关。

## 2. P/E恢复与旧RP：明确一路支付，共享资格及次数

推荐内部标准化意图为：`actionId, unitId, paymentMode(RP|PE), receiverId?, expectedRevision, snapshotHash`。matchId/控制者由权威会话封套提供。旧REPAIR_UNIT未指定新模式时仍只走既有RP；本轮不改其白名单。未来实验能力启用后，新的标准化命令必须明确选择一种模式，同ID载荷锁定，不允许混合字段、自动回退、先扣RP再返还或双付。

|责任|RP分支|P/E分支候选|
|---|---|---|
|共同资格|两路使用相同真实Core恢复资格；不能以“材料足额”替代|同左，包括原补给投影后的正常供给状态|
|专属支付检查|按原模板检查RP余额|按已批准模板材料配方、receiver和真实已可用批次检查，不要求额外RP余额|
|唯一支付者|原RP扣账路径，只扣RP|RecoveryTransactionCoordinator的P/E账，只扣P/E，RP delta=0|
|恢复状态与次数|共同一次step恢复与接受日志|必须写入同一恢复次数/单位已恢复记录，不能因为新action.type而逃过旧计数|
|失败|完整状态不提交|库存预留、支付、step、次数、revision一起不提交，无RP回退|

最小价格引用仅G-INF/S-INF：每阶1P＋2E2:L（=1E轻装备），来自R1/工业004的条件步兵示例；不是装甲/炮兵通用价格，其他模板PE明确拒绝。recipeApprovalRef=null，尚未批准运行。未知材料类型不能兑换；RP、P、E、SP互不转换。

**保留的真实资格**：正确自方恢复阶段/控制者、存活受损、模板存在、正常供给、未移动/攻击/炮兵支援、德工兵未专职修路、无相邻活敌、距实际恢复基地≤原规则距离、未重复恢复、未超侧每T额度、无待决。只允许将旧RP余额校验拆为支付专属校验，不放宽其余规则。

实际`validateRecoveryAction`同时检查资格与RP；`applyRecoveryAction`同时step−1和扣RP，当前不能原样套进PE。未来必须定向拆出共同资格与共同恢复效果，让付款由唯一分支执行；不能给RP临时加点、忽略全部INVALID_SUPPORT、直接写step或先调用旧扣RP函数再补钱。`acceptedRecoveryActionsThisPhase`目前只认REPAIR_UNIT，新增封套最终必须归一到同一接受记录或共同计数器，否则混合支付可能重复恢复。

### 材料何时、在哪里可用

- 每lot必须有材料种类、数量、side、receiverId、receivedEpoch、availableFromTurn、唯一接收回执/来源、已预留数量；只可扣本库未预留的已收货余额。
- E_t到货最早T(t+1)消费；E24到货标25，只记终局库存，不能资助T24。到货并不即时修复单位，不重放先前失败命令；HELD、在途、escrow、embodied都不可当available。
- 首切片推荐**同格P/E服务**：单位与receiver同格，且照常通过Core恢复基地范围检查。站在B10即使距C10基地合格，也不能免费远取C10材料；这项材料送达限制是新接口候选，不修改原RP范围。更远服务需要独立批准的配送批次/交接。
- 配送归Shipment/E事务负责实际“入库一次”；RecoveryTransactionCoordinator只消费已入库批次并记录RepairPaid，不生产或再次配送物资。人员P的运输/接收成本仍未定，不能默认免运；没有其来源及可信接收回执就拒绝。
- 两次请求抢同一lot须在一次revision/CAS或串行事务中预留并消费；重复同actionId返回旧回执，异载荷拒绝。同一恢复动作只能记一条资源费用和一次step效果。这里是未来验收条件，本离线脚本没有验证服务器幂等。

## 3. 同源预算与后方维护边界

候选E00冻结nominalCap、原`usable`/当前状态推导的effectiveCap、单位在场名单、订单和库存。E10按acceptedTurn/orderId稳定排序处理未入场订单：每单先清旧欠，再付本期模板B；可付=`min(绑定源余量,旧欠+B)`。绑定源不可用即该源0，不借同侧其他源、不挪枢纽库存、不改sourceId清欠。

`rearPaid(source,E) + frontInjected(source,E) ≤ effectiveCap(source,E) ≤ nominalCap(source)`。

E20给原求解器的本E源额度必须是`effectiveCap−rearPaid`；这是事务内预算余量，不是永久改profile来源。不能先按全部额度配送后补扣，也不能另生成“后方保障SP”。后方实付直接记消费，不进入携行库存；未用额度不结转。设备运输占边/桥/W/T，不凭空扣或增加SP来源。既有枢纽库存释放另记出库，不能计成源额度增加。

维护Owner按永久ID×E唯一：本E00已部署者只FRONT；ASSEMBLING/WAITING_ENTRY只REAR；实际入场stock0/D0，先前后方费用不退、不转携行；R只在真实部署原子提交时增一次。现有S定时增援不是工业订单，不再加一份候补费。

|全军原基线|G|S|
|---|---:|---:|
|单位数|26|32|
|每E维护SP|33|38|
|来源SP|24|24|
|即使无限运输的来源缺口SP|**9**|**14**|

这些缺口是未考虑携行/枢纽库存缓冲的来源算术下界，不是当轮实际短付或死亡时间。后方清欠只会进一步减小前线源余量；例如条件单在G-A10付旧4q＋当期4q，全侧前线源上限96→88q，原33SP维护对22SP源余量的差成为11SP，不能宣称其他源自动补足。此例不是新全局来源参数，也没有将工业004的22SP迁入地图。

`SOURCE-003=22SP`、标量运力21及BASE-003-CONDITIONAL仍保留工业004原值，禁止叠加、替换真实24SP、按比例平摊或把抽象base直接重命名为新库。需另行批准新地图profile和配方/来源绑定后才可重算相关账；本轮不重算。

E14设备发运仍需candidate.1的前线净维护可行凭证，先维护、再设备、再储备，不采用CAMPAIGN-003的储备优先变体。每条边、桥、枢纽W及T的设备负载换算和P运费均待批准；配置中的2q/E2只是004的标量负载提议，不是已批准多路径向量。缺可行凭证则新增设备货运为0或拒绝计划，不能把源总量足够当路径足够。德9/苏14缺口意味着某些状态下连维护都不可保障，**不能保证新工业有正向发货窗口**。

所有预算、批次、消费和恢复/入场效果最终须在候选统一事务内提交；失败或总3秒超时整笔回滚。E24同样扣预算和维护，材料不追溯。该编排仍未实现，现行苏末turn递增配送和T16终局保持原样。

## 4. 首个最小实现切片与接口

**建议首切片S1：服务注册解析＋单次恢复付款计划，先只读并明确拒绝。** 以G的REC-G-C10为主，S的REC-S-AC10验证侧隔离；只读真实Core恢复资格、revision和receiver内的可信lot，返回RP或PE唯一支付计划及未决原因。不先实现生产、新编、全图货运、24回合或胜利系统。

这是能够在当前真实地图上先消除“unsupported surface”和隐式授权的最小接口切片，**不是已经打通PE修复**。S1只读不产生资源，也不把002/004条件流水灌入真实Core。随后S2才实现批次接收/同源预算及RecoveryTransactionCoordinator提交；S2的正向PE验收必须已有批准的物资来源、容量、运输服务/回执，或另经Leader批准的可追溯初始物资清单。当前initialMaterialManifest=null，没有合法正向材料起点，不能在验收脚本里塞库存凑通过。

|接口职责|可复用事实/函数|必须新增能力/首切片边界|
|---|---|---|
|ResolveCampaignService|真实map节点、source/hub ID，现有控制/敌占/ZOC查询|S1新注册表、grant用途与revision校验；null缺字段返回固定拒绝码|
|ReadRecoveryEligibility|computeRecoveryBaseHexKeys、validateRecoveryAction中非支付条件；新补给project供给投影|S1返回共同资格及支付专属原因；实现时小范围分离RP余额检查，不忽略其他错误|
|PlanRecoveryPayment|原模板RP价格、actionLog恢复次数；材料配方仅条件输入|S1新只读计划、lot占用摘要、可用回合/同库校验；不预留、不扣费、不改变RNG|
|BuildEpochBudget / DebitRearUpkeep|原source可用性与SP约束、现有单位B|S2新增逐源rear消费、Owner与求解输入残额；不能把旧solve当已有共享余量接口|
|RegisterMaterialReceipt / ReserveCapacity|真实SP路径/约束查询可作参考|S2新P/E批次、仓容、设备/P向量、同状态维护可行凭证、到货/HELD与内部可信回执；不提供公网注入接口|
|CommitRecoveryPayment|旧RP恢复效果/日志语义|S2单事务唯一付款＋step/次数，不能复用会扣RP的旧apply来完成PE|
|RequestIndustrialEntry|原S入口过滤与单位初始化可提取复用，之后照常校验移动/攻击|后续S3新G/S工业命令、队列、订单资格、授权、R/Owner原子交接；独立于13旧槽|
|SettleE / VP-W|已存在SP结算；R1仅有候选时序|后续单独S4统一E1—E24、终局与目标批准；不属于S1|

### S1及后续提交的验收条件

1. 固定原地图/源码/参数；CAMPAIGN-004的“足供但无基地”事实必须仍给基地不合格，不能因有PE授权变合法。真实RP恢复的全部条件保持一致；不重跑004全链，只在获准实现时做相关定向检查。
2. 未知registry/side/grant、control=null无专门批准、错误revision、预留格当库/入口、SOURCE-003付款、旧S槽冒充工业单均拒绝，状态/RNG不变。
3. RP计划只列RP；PE计划只列已可用P/E、RP=0；每个原资格false或unknown都拒绝。G-INF/S-INF外无配方拒绝，不自动fallback。
4. E_t到货不能用于T_t；E24到货不能T24修复；同lot重复引用/已有预留不能增加余额；不以Core距离2免费扩展物资服务。
5. S1对所有材料缺失情况应返回可审计阻塞，不能宣称PE贯通。S2才测试一次付款/一次恢复、跨支付方式共享名额、请求重放、失败和超时无残留，真实检查必须取权威回执而不是本离线布尔输入。
6. 同源单边界核对名义额度、有效额度、后方实付、前线源余量和未用量；源不可用不借别源；相同永久ID/E不能REAR与FRONT双收。不得调来源、耗损、RNG或总3秒预算获得通过。

## 5. 校验器怎么使用、什么算通过

```text
python docs/rule-campaign-003/validate.py --self-test
python docs/rule-campaign-003/validate.py --runtime-gate
```

第一条验证固定输入哈希、真实节点/源/hub引用、原路线见证、未决字段及支付/同源预算的短条件计划。结构正确可退出0，**同时明确runtimeDecision=REJECT并列blockers**；不允许把文档校验通过解释为运行可启用。第二条对本候选应退出2，表示未决/未授权。结构篡改、坏引用等退出1。

只读脚本不导入Core、不写文件、不联网、不运行旧实验；stdout可由调用者保存。自检只在内存造明确标注的合成许可/物资回执，检查所提接口的拒绝逻辑及数学，不保存到候选，不具备任何真实授权。Core条件是布尔回执输入，不是脚本自己执行Core；既有路径只是固定证据，不是重新求解。没有验证服务器事务幂等、真实设备货流、新单位部署、平衡或死亡回合。

待决分组：新服务grant及null控制处理；P/E容量与来源清单；跨格/人员/设备运输向量；配方与共同恢复计数接入；候补预算接口；工业入口初始化；24回合与战略目标。**首要实验风险仍是候补清欠挤压本已缺供的前线**；局部材料恢复可行也不能解除这一风险。
