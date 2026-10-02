# INDUSTRY-INTEGRATE-005｜真实局面只读恢复计划

交付三个可调用接口与命令行入口。直接读取CAMPAIGN-004保存的完整检查点，执行固定原Core的恢复校验及引擎前置检查；不推进战役，不预留、扣费或恢复单位。全部新增文件仅在本实验目录。

## 固定依赖与运行

|用途|提交|
|---|---|
|运行Core及新补给基线|`813b4072568352e95d0726fe5fe04060c889c554`|
|规则003-R1坐标与未授权候选|`7a970e020dc6ac104d44ac72a4a18508b10b1d2f`|
|CAMPAIGN-004真实检查点及动作回执|`268ea7bd3d139936c4c6e52579cd4a84470e2611`|

需要Git中已有上述对象、Node ≥22.13；本次验证Node 24.19.0。不安装包，不启动服务器。仓库根执行：

```text
node experiments/industry-integrate-005/prepare.mjs
node experiments/industry-integrate-005/verify.mjs
node experiments/industry-integrate-005/cli.mjs german_recovery_T5 RP
node experiments/industry-integrate-005/cli.mjs german_recovery_T5 PE
node experiments/industry-integrate-005/cli.mjs german_recovery_T2 RP
node experiments/industry-integrate-005/cli.mjs repaired RP
```

`prepare`只从固定Git对象生成本目录忽略的`.runtime`，不采用当前工作树Core，不重跑战役。Node内置类型转换器会提示实验性功能；不改原算法。`verify`重查保存证据并比较结果，不写文件；`verify --write`仅更新本实验的EVIDENCE.json。不同Node版本若转换器输出或环境版本不同，证据比较会失败，须明确记录环境差异，不伪称逐字复现。复跑前可用同样命令重新准备派生目录。

## 三个接口

从`service.mjs`导入：

|接口|返回|
|---|---|
|`resolveService(bundle, request)`|Core坐标、当前格事实、既有SP节点、原Core动态恢复基地、候选材料服务绑定；四类能力分开|
|`queryRecoveryEligibility(bundle, request)`|请求/旧入口限制、引擎前置问题、完整Core恢复问题、共同资格、单独的RP不足问题|
|`planRecoveryPayment(bundle, request)`|上述两层＋单一付款方式报价、阻塞项、候选运行门禁；始终`executable:false`|

`bundle`是原样的`{core, logistics, mode, clip, revision, seen, journal}`。它来自可信存档调用方；此库不是客户端认证边界或网络协议。不得向不可信玩家直接暴露完整敌方存档。

资格/计划请求字段：`controllerId`、`unitId`、`expectedRevision`、`snapshotHash`、`paymentMode`，可选`receiverId`与原Core规范`actionId`。`paymentMode`必须显式为RP或PE；未知字段（包括混合收费字段）拒绝。`snapshotHash`由`inputs.mjs`导出的`snapshotHash(bundle)`计算：递归排序对象键，数组顺序保留，哈希包含journal与seen；不同于旧`hash_bundle`的删字段摘要。revision与完整哈希必须同时匹配。`actionId`若已存在，保留原Core重复身份错误；未提供时只在一次性克隆中解析，不占用原计数器。

仅查空间时，`resolveService`还接受`nodeId`来观察指定格；它不授予操作权。资格/计划接口不接受替代单位坐标，固定从单位本身解析。

命令行可接任意可信调用方提供的完整存档与原请求：

```text
node experiments/industry-integrate-005/cli.mjs --stdin < request.json
```

输入结构为`{ "operation": "plan", "bundle": <完整存档>, "request": <上述请求> }`，operation可为`service`、`eligibility`或`plan`。stdin方式不会重填过期版本或哈希；位置参数演示方式才从指定存档创建一个当前请求。有效查询即便资格/门禁拒绝也输出JSON并退出0；输入不能解析/存档损坏等查询失败退出1。调用方须读各层结果，不能把进程成功当作行动获准。

## 资格与付款边界

直接调用固定基线`experiments/supply-exp-005/core/src/rules/recovery.ts`的`validateRecoveryAction`。只将`code === INVALID_SUPPORT && details.reason === INSUFFICIENT_RP`从共同资格拆到RP支付条件；其余问题的code、message、details、顺序完整保留在`recoveryIssues`。不提高RP、不跳过整个INVALID_SUPPORT，不重算或替换权威补给快照。

原引擎没有独立的总前置查询。准备脚本从固定`RulesEngine.ts`逐字提取`controllerReadyGuard`和`apply`函数的开头，止于`const reject=`之前，并执行原clone、identity、pending和deployment辅助函数。保留原身份→终局→待决→Ready→部署门禁的短路顺序；之后仅返回问题。没有调用RulesEngine.apply，也没有到达日志、扣费、恢复和随机分支。提取锚点唯一性断言与源码/片段哈希保存在`.runtime/guard-extraction.json`；完整来源和派生物哈希进入EVIDENCE。

另核对原`live.execute`相关前置条件：revision、当前控制者、GAME_OVER；原GameState完整性校验也调用。Core直接恢复问题即使被引擎前置门禁挡住也返回，供诊断用，不意味着它们能越过前置门禁。

|付款模式|报价/可用计划|明确阻塞或不发生的事项|
|---|---|---|
|RP|原单位模板RP价格；合法时plan.debits仅有RP|不列P/E扣项；不写入状态；运行接入仍未获批|
|PE|当前步兵候选`1 P + 2 E2:L`（即1份L）；只有需求报价，plan为null|配方/接入钩子、服务授权、来源凭证、材料运输与真实材料账未决；不回退RP，不拿SP仓库当P/E|

真实存档没有P/E材料账：返回未知null及`MATERIAL_LEDGER_UNAVAILABLE`，不解释为库存0。当前公开计划接口不能通过请求附带材料或授权来开启PE。`materials.mjs`只是无副作用批次算术，支持收据、同源/同侧/同接收端、到货可用时点与已预留量校验；有批次的调用仅出现在明确标记的合成单元测试中，不是入库接口，也不构成凭证信任验证。

`planAvailable:true`仅说明该存档有合法RP只读计划；`payment.conditionsSatisfied`仅说明付款层条件。共同资格、付款与运行门禁必须分别阅读。35项候选门禁原样保留，RP报价不等于批准005接入；既有RP运行行为没有改变。

## 验证结果与空间边界

见[REPORT.md](REPORT.md)及可重验的[EVIDENCE.json](EVIDENCE.json)。真实存档用例包括无基地、合法RP、已恢复、错侧、过期版本/哈希、未授权PE、错侧接收端、混合字段及重复身份。每个查询分别调用三个接口并重复规划，对完整存档深比较与冻结检查，另记录库存、次数、revision、身份计数器、RNG前后摘要。未重跑完整战役。

使用R1的640格映射，并用原Core坐标函数逐格双向核对：C10=`2,8`、AC10=`28,-5`、AF10=`31,-6`。J7/M14/R9/AD9只保留地图空间；测试中无运行source、hub或Core恢复基地，产能仍未知，homeSide与目标仍为null。历史SP路线见证不升级为当前P/E运输权；动态材料路径仍未验证。

此结果不覆盖HTTP、多人并发、真正支付事务、路径配送性能、部署或平衡验收。所有运行阻塞继续保留；原Core、服务器、协议、默认规则和旧实验文件均未修改。
