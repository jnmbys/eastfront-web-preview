# UI-004：016只读字段映射与提取校验

UI基线：`1519ab5138acbca7f5c3ee9f1e8f3e9ab84bc59d`。独立分支：`industry-ui-004`。
016来源：`15e4d13fa9423ddb474432719468a8a8409823e9`。
只消费已有 **industry-016-view.v1** 和该提交保存的TRACE / LEDGER / VIEWS / SYNTHETIC-VIEWS，不定义工业请求接口。

## 离线来源及提取

`extract-016.py`固定10个来源文件的Git blob：`view.py`、`config.py`、`report.py`、`README.md`、`TRACE.json.gz`、`RUN.json`、`LEDGER.json`、`VIEWS.json`、`SYNTHETIC-VIEWS.json`、`VERIFICATION.json`。先比对原始字节，再只导入原`view.export_view`与其config声明；禁止pycache写入。不导入adapter、run、verify或report，不启动Core，不重新运行实验/求解器。

- 解压TRACE的SHA-256必须同时符合RUN、LEDGER、VERIFICATION。
- SYNTHETIC-VIEWS规范摘要必须符合VERIFICATION；起点和恢复后根摘要符合RUN。
- 按LEDGER七个检查点取原始完整根，调用原投影，校验根摘要、三种revision、预算、照管、材料、前线实物/可用、过期状态、Core步损和RP。
- 六份既有VIEWS全部逐一比对；第七份从E8实际边界完整根投影。
- 核对LEDGER.capacity与真实E8根、LEDGER.actualE9UnusedMaintenance与未恢复分支E9实际结算一致。
- 提取前后再次比对10个源文件原始字节。静态模块保存每个文件的Git blob与SHA-256、TRACE摘要、原48项检查的名称/来源/结果；没有将这些既有检查冒充UI重新执行的实验。

`records-016.mjs`保存7个真实检查点与全部5个合成样例，内部view原值不改。外围branch/origin/sourceOrigin/sourceLabel/tracePath/rootHash/ledger为本UI离线证据索引，不属于新的正式API。来源REAL/SYNTHETIC在原016视图外围记录，不能从view内不存在的origin字段补出“实时”含义。

在仓库根目录执行：

```sh
python experiments/industry-ui-001/extract-016.py --source /path/to/pinned/experiments/industry-integrate-016 --check
```

去掉`--check`只重建UI目录内的静态模块；未知源哈希立即拒绝，先验摘要不符时不导入来源代码。Python 3；Node页面运行不依赖Python、Core或工业原文件。

## 七个真实检查点与分支

|UI检查点|原始来源|游戏/root/material revision|实际回合/阶段|
|---|---|---|---|
|主线 T8起点|TRACE.start / VIEWS.start / T8_START|142 / 37 / 0|T8 GERMAN_RECOVERY|
|主线 照管付款|TRACE.care / VIEWS.carePaid / T8_CARE_PAID|142 / 38 / 0|T8 GERMAN_RECOVERY|
|主线 E8到账|TRACE.records中的E8 afterBoundary / E8_ARRIVED_T9_BEGIN|149 / 45 / 1|T9 GERMAN_SUPPLY_RAIL|
|主线 T9恢复前|TRACE.preRecovery / **VIEWS.received** / T9_RECOVERY_BEFORE|152 / 48 / 1|T9 GERMAN_RECOVERY|
|主线 恢复后|TRACE.recovered / VIEWS.recovered / T9_RECOVERY_AFTER|153 / 49 / 2|T9 GERMAN_RECOVERY|
|对照A 无操作E8到期|TRACE.control.root / VIEWS.controlExpired / NO_OPERATION_END_E8|152 / 47 / 1|T9 GERMAN_RECOVERY|
|对照B 未恢复E9到期|TRACE.unusedEndE9.root / VIEWS.unusedExpired / UNUSED_END_E9|159 / 55 / 2|T10 GERMAN_SUPPLY_RAIL|

**VIEWS.received实际是恢复阶段的观察点，不能冒充E8刚到账的revision 149。** 七个UI检查点按实际根和账本映射。主线选择器仅含五点；两个真实对照分别单独选择，不把对照串成恢复后的历史。

对照A从同一T8根未付照管、未发运，A10人员在E8结束隔离，装备仍为REAR_AVAILABLE。对照B独立照管/前送但不恢复，E9结束C10的1P与2 E2隔离。两个分支均为真实已完成记录，各自sourceOrigin保留原文。

## 字段映射及算式

|016字段 / 证据|展示与限制|
|---|---|
|schema/readOnly/runtimeDefaultEnabled|仅v1、只读true、默认运行false；未知schema拒绝展示|
|turn/phase/revisions|原值显示；标签不替代实际阶段|
|TRACE.start.personnel.importReceipt|来源是实验假定受训后备池，actualTrainingReceipt=null；不宣称训练系统已完成|
|materials的id/owner/custody/quantity|原P包和原E2批次；一项一行，分别显示位置、当前实物、可用、隔离子集和消费历史|
|rearInventory/frontInventory|必须与材料归属一致；不会与012/013其他模式库存相加|
|availableFrontInventory|本次前线可用量；还需本次shipment已到账且到达其可用T。A10可用按REAR_AVAILABLE及材料历史可用T派生并在文档说明|
|consumedP016/consumedE2016|消费墓碑；消费后当前量0，永久ID仍保留；当前量+消费历史守恒为1P/2E2，不因ID存在新增材料|
|隔离状态|QUARANTINED数量是当前实物子集；C10隔离1P/2E2仍占全部限定仓容，不再另加一批|
|receiver.capacity/incoming|实物+入库占位不超上限；HELD仅在途实物及目的地预留，无C10实物。隔离在途后释放目的预留|
|shipment.dispatchEpoch/arrivalEpoch/availableFromTurn|本次E8发运/E8到账/T9可用。原materials的E6/E7、T7/T8仅为历史A10入库|
|equipmentBudget|10I拨款 = 可用 + 生产3 + 原交接2 + 托管 + careTransferOutI；未建care时无转出项表示尚未发生|
|personnelBudget|原2I账户独立显示且不变，不与装备账户抵销|
|care|内部转入receivedI = 装备careTransferOutI；receivedI=spentI+availableI。转入不是新增拨款；转出及照管实支不重复加总|
|transport|E8历史资源行，originalCap=spUsed+reservation+freight+remaining；cargo仅收费规格，不参与实际占用加总|
|terminal|paidW=同一W:GH2 freight=8；extraRecoveryW=0；凭证不是另一笔8W，状态可为PAID/CONSUMED/EXPIRED|
|recovery|G-I-01实际beforeStep1→afterStep0，payment为1P/2 E2/RP0/extraW0|
|LEDGER.checkpoints.RP/step|当前已提交Core值；恢复前后德8/苏12不变。合成view未导出这些字段则显示未提供，不套主线|
|LEDGER.unitComparison|E8实际与015固定参照比较，qPerSP=4。G-REC-02维护少2q=0.5SP，D2→2.5；G-I-01期末库存+4q=1SP，G-PZ-01−2q=−0.5SP|
|actualCore|G-REC-02攻击系数0.5、移动上限1、OUT_OF_SUPPLY；较参照没有再跨档或新增掉步。没有战斗或长期净收益声明|
|LEDGER.actualE9UnusedMaintenance|仅未恢复E9分支展示；德军68q=17SP、苏军128q=32SP，五支单位各掉1步|
|E9Interpretation|显著注明没有同期E9无货运反事实，不能把全部实际损失归因于运输|
|globalBlockersRetained/Closed/sourceGapSP|35/0、德9/苏14继续保留，视图不授予后续操作权限|

主线早于E8时不显示未来E8代价为当前结果；E8比较只在主线已到账的观察点出现。两个对照与合成样例不自动套用主线收益。E9实际损失只在真实未恢复分支出现，合成在途隔离不套该损失表。

## 原合成样例

- careFailed：SYNTHETIC_FAULT_ON_REAL_CHECKPOINT；装备可用5I、尚未支付照管。
- E8Failed：同来源；照管已提交，可用4I，但E8运输整笔回滚，运力/运输记录为null。
- recoveryFailed：同来源；恢复回滚，前线实物1P＋2 E2仍在，未消费，无恢复回执。
- held：SYNTHETIC_RECEIVER_REFUSAL_ON_REAL_BOUNDARY；材料在途，C10预留1P/2E2，实际freight已用，没有终端到账凭证。
- heldExpired：SYNTHETIC_REFUSAL_FOLLOWED_BY_LEGAL_E9_CONTINUATION；在途隔离，预留释放，不退款、不重新到账。

内部回滚与契约拒收区别保留，所有样例使用各自账本，不拼接成功数据。

## 实现和验证范围

forward-adapter.mjs校验映射；forward-view.mjs以textContent渲染；无写方法、fetch或业务按钮。已有demo、012、013适配器/视图/静态数据及旧测试不改。静态服务器仅增加本模式ES模块白名单，仍127.0.0.1且connect-src 'none'。

56项单元测试（原40＋新增16）；桌面1440×1100、平板820×1180与1024×768复查七真实点、五合成样例、金额数量分支时间、W单次计数、缺字段/未知schema、四模式隔离。原演示、012、013及R1 E24终局约束另行回归。仅浏览器视口验证，非真机验收。没有重跑016工业实验、接写接口、合并或部署。
