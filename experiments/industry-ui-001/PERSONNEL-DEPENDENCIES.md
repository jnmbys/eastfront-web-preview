# UI-003：013人员只读映射与证据依赖

UI基线：`aeeceb9be390ec3a1c8d0f0711f4f63a66aa2f73`。
013来源：`2d04264a3f4ba6d38f76a99ae76821cc0a55abdb`。
消费原 [VIEW-CONTRACT.md](https://github.com/jnmbys/eastfront-web-preview/blob/2d04264a3f4ba6d38f76a99ae76821cc0a55abdb/experiments/industry-integrate-013/VIEW-CONTRACT.md) 与 **industry-013-personnel-view.v1**，没有定义新工业API或写端点。

## 文件职责与固定来源

- `extract-013.py`：只读离线提取。固定契约、export_view.py、view.py、personnel.py、config.py、VIEWS.json、EVIDENCE.json、TRACE.json.gz、README.md的Git blob，记录原始SHA-256。原导出器导入personnel.py仅用于counts函数，不执行事务或启动Core；所有导入依赖先验摘要。
- `records-013.mjs`：已验证的25条静态view、9个文件摘要和33项原证据检查摘要。包装的id/kind/label/sourceLabel/checkpoint只是本UI离线索引，不是正式请求接口。内部view未经改写。
- `personnel-adapter.mjs`：校验和映射，不导入演示或012数据，无写方法。未知schema或缺字段时拒绝展示，错误明确写“未提供”；null按契约解释，不改成0。
- `personnel-view.mjs`：textContent渲染。013库存与费用只来自当前所选记录；不相加跨模式、跨检查点或跨样例的数据。
- `app.mjs`：模式切换仅控制展示。演示事件有mode门禁；013页面不生成业务按钮。
- `serve.mjs`：静态资源白名单，127.0.0.1，CSP connect-src 'none'；没有业务HTTP接口。

提取固定7个检查点：initial、imported、accepted、preE7、E7、T8、noApplicationT8。最后一个是SYNTHETIC_NONMERGEABLE对照，不能因为属于检查点列表而改标REAL。原18条VIEWS全部保留，包含四条与检查点相同的REAL样例。重复观察点分别浏览，绝不累加库存。

原导出器各次读取均校验TRACE解压内容摘要或VIEWS规范序列化摘要。包装器再核对四对检查点/样例、最终T8与EVIDENCE.final、提取前后所有固定源字节一致。只读取既有证据，不重新宣称完成Core或真实业务验收。原证据的singleProcessOnly=true、crashPersistence=false照实保留。

## 字段映射

|013字段|界面及校验口径|
|---|---|
|schema / readOnly / origin|仅接受v1、readOnly=true；原样显示REAL或SYNTHETIC来源。合成样例显著说明不是真实推进|
|turn / phase / rootRevision / gameRevision|显示原值。样例名称中的E8/E9不是另行推算的实际回合|
|source.kind / imported / actualTrainingReceipt|初始受训预备池假设、导入状态、无实际训练回执；不宣称新完成训练|
|source.ids|全部7种标识可展开。标识可能预先分配，不凭ID存在判定付款、发运或到账|
|personnelBudget|人员累计拨款=余额+照管支出+托管+运送支出，独立检查守恒。initial拨款0，导入后2I|
|equipment012Budget|原装备累计拨款=余额+生产支出+交接支出+托管，独立检查守恒；不与人员账户抵销或互用|
|custody.sourceP / transitP / rearP|互斥物理归属；已导入合计1P，未导入合计0P|
|custody.quarantinedP|全位置隔离子集，不作为第四个物理地点再相加|
|warehouse|只显示一个RC007-REAR-G-A10（A10/0,9）。驻留、可用、隔离、入库预留各自展示|
|warehouse.residentP / availableP / quarantinedResidentP|后两者为前者子集；仓库与custody的对应字段必须一致|
|warehouse.incomingHeldP|来货占位，不是实物。P占用=residentP+incomingHeldP；隔离不再另加，也不释放占位|
|warehouse.residentE2|013引用的原012装备驻留2 E2，只读取一次；不读取012模块来补齐或相加|
|personnelAuthority / historical012PIsNotCurrentStock|personnel.package为人员唯一来源；012旧P=0只在012历史模式显示|
|service|独立一次性总4LQ，used+held+remaining=quota；renews=false；不与SP或012合并。合成过期样例中算术剩余不表示当前可重新使用|
|receivedEpoch / availableFromTurn / careEndsAfterEpoch|主路径E7/T8/E8；E7导出快照已进入T8可用。照管截止后仍留后方将隔离；合成隔离记录仍显示原账本时间|
|applicationStatus / custody.state / owner|按选中记录显示原状态、持有方及中文说明；不凭回合、回执ID推演新状态|
|blockingReasons / lastRequestError|原因码保留；失败请求显示错误与失败前已提交账本，不套成功余额|
|forwardTransportRecoveryFormationAllowed|必须为false。只读页不提供申请、前送、恢复、续期或新编；可用不等于授权|
|globalBlockersRetained / Closed|原35/0，不自行解除阻塞|

未导出的申请报价、续期条件或操作接口显示“未提供”，不得从配置或演示补齐。未知schema、缺失必需字段（含nullable字段）、非法类型、守恒或子集关系错误时隐藏整条数据，避免残留上个成功快照。

## 关键样例

|原标签|保留的观察事实|
|---|---|
|E7_received_T8_available|REAL；实际T8/GERMAN_SUPPLY_RAIL；1P可用、原2 E2驻留；人员2I已支出，4LQ已用完|
|T8_German_recovery_success|REAL；T8/GERMAN_RECOVERY；照管至E8结束，后续操作仍未授权|
|quota_blocked_used / quota_blocked_held|SYNTHETIC_FIXTURE；算术剩余3LQ不足本次发运；来源池1P、托管1I保留|
|rejected_receipt_held|SYNTHETIC_REFUSAL_ON_REAL_REPLAY；在途1P、后方0P、来货占位1P；运送费和额度已使用|
|E9_transit_expired|合成E9条件；实际快照仍T8；在途隔离1P，目的预留释放；运送费/额度不退|
|E8_unsent_expired|合成E8条件；实际快照仍T7；来源池隔离1P；未支托管1I退回同一人员账户，照管费不退|
|end_T8_rear_care_expired|合成E8条件；实际快照仍T8；后方1P、其中隔离1P、可用0P、占位1/1|
|early_terminal_*|合成提前终局样例，仍保留人员物理归属及各自账本；不说明真实主路径已经终局|
|failure_after_reserve / dispatch / receipt / before_commit|SYNTHETIC_FAULT_ON_REAL_REPLAY；T7/SOVIET_ENTRENCHMENT、来源池1P、驻留0P；照管支出1I、托管1I、运送支出0、已用0LQ|

## 回归边界

demo-adapter.mjs、view.mjs、record-adapter.mjs、record-view.mjs、records-012.mjs与四个既有测试文件保持基线内容。R1的E24到账实际库存保留、可用0、availableFromTurn=25仅作账本、无T25/E25，以及未完成/HELD/暂存/托管保留规则均已回归。013没有加入推进功能，也没有用合成过期记录替代真实T8。

40项单元检查、三种视口全部模式的浏览器检查通过，见README和UI003-VALIDATION.json。截图为桌面和两种平板尺寸的浏览器视口证据，非真机验收。

