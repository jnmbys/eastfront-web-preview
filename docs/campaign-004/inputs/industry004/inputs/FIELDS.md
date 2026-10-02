# 候选字段与状态表

字段均为合同草案，不是已存在的Core schema。所有整数非负；未知不填0，研究阶段使用`null + unresolvedReason`；执行所需字段缺失必须拒绝启用对应接口。两方账分开，客户端只见授权投影。

## 1. 单位与事务

|字段|类型/约束|语义|
|---|---|---|
|contractVersion / profileHash / rulesHash / scenarioHash|字符串|锁定本候选、参数、规则和真实场景；不跨版本复用回执|
|matchId / revision / actionId|稳定ID/整数/稳定ID|命令以expectedRevision比对；重复actionId比对payloadHash|
|turn / epoch / lastCommittedEpoch|1..24 / 1..24 / 0..24|E_t对应完整T_t；每次合法边界只推进1|
|eventId / sequence / entityId / causeId|稳定字符串/整数|如`match:version:E5:rear:orderId`；无RNG生成ID；causeId指唯一前因|
|beforeHash / afterHash / inputFactHash|哈希|整包或相关账本快照；失败不得残留after事件|
|outcome|ONGOING、WIN_G、WIN_S、DRAW|与winner字段分开；终局阻止E25与玩家新命令|
|q|整数，4q=1SP|库存、候补欠付、来源发送、维护和行动费|
|equipmentE2[type]|整数，2E2=1E|沿用002半E记账；L/H/V逐类不可互换；夹具仅L|
|personnelP / investmentI|整数|已训练人员包/有限建设额度；不是SP、RP、CP或现实人数|
|debtD / attritionAccumulator / weight / lossFraction|约分有理数{n,d}，d>0|禁止显示取整参与门槛比较；W不是equipment wreck账户|

## 2. 资源、设施与批次

|对象|必需字段|不变量/事件|
|---|---|---|
|Depot|depotId、side、kind(REAR_SOURCE/ASSEMBLY/FRONT)、sourceId?、capacityE2、lots、incomingReservedE2|后方组建点必须显式绑定现有源侧服务；普通城市不可默认绑定|
|Lot|lotId、materialType、qtyE2、location、availableFromTurn、shipEligibleEpoch、createdByEvent|location为唯一库/在途/订单escrow/embodied/consumed；拆批有parentLotId及数量守恒|
|PersonnelAccount|side、availableP、escrowByOrder、embodiedByFormation、consumedRepairP|下单available→escrow；完成escrow→embodied；入场只改归属；不能二扣或把消灭人员退回|
|Project|projectId、side、recipeVersion、acceptedTurn、paidI、workNeeded、workDone、completedEpoch、operationalFromEpoch|I于合法接受扣一次；E_c完工，E_(c+1)起有效；每E最多推进一次|
|ProductionReceipt|assetId、epoch、capacityBeforeOutput、recipeInputs、outputE2、blockedE2、reason|满仓/停产未生产部分不累积；产出不凭空复制；回收另列wreckConsumedE2|
|FreightRequest|requestId、side、createdTurn、sourceDepot、destinationDepot、materialType、maxE2、priority、L、pathRef|T期间提交，L≥1；E14按priority/requestId稳定排序审核；不保证全部发运|
|Shipment|batchId、requestId、source/destination、qtyE2、dispatchEpoch、arrivalDueEpoch、L、state(IN_TRANSIT/HELD/RECEIVED)、receivedEpoch、availableFromTurn、capacityReservationId|due=dispatch+L−1；received只写一次；HELD可能超期；E24 due>24照实保留|
|CapacityReservation|reservationId、epoch、profileHash、topologyHash、vectorByResource、purpose、batchId/certificateId|源/边/桥/W/T单位显式列出；同一槽所有实用之和≤cap；预留转实用不得双加|
|MaintenanceCertificate|epoch、inputFactHash、sourceCapsAfterRear、perUnitNetNeed_q、feasible、reservationVector、evidenceKind|feasible须有逐资源证据；单走廊可SCALAR_EXACT，多路径需ROUTED_WITNESS；UNKNOWN不当true|

前线SP与单位库存的守恒：`stockBefore_q + received_q = maintenancePaid_q + stockAfterMaintenance_q`；再扣真实销毁库存单列，不把删除单位当物资消失。

装备守恒按类型：`初始+生产+真实回收+明确调入 = 各库+在途+escrow+embodied+repairConsumed+明确损毁`。embodied消灭后改为永久损失/残骸对应账，不能既保留完整可用装备又加回全量残骸。来源cap不是初始库存，未发额度不能写成stock结余。

## 3. 新编与维护

|字段|类型/取值|写入时点|
|---|---|---|
|orderId / plannedUnitId / side / templateId / recipeVersion|稳定ID|OrderAccepted一次；plannedUnitId不得复用已消灭/既定增援ID|
|assemblyDepotId / rearSourceId|经配置审核的ID|接受时锁定；首版不免费转移来源|
|status|ASSEMBLING/WAITING_ENTRY/DEPLOYED/DESTROYED|由合法事件转换，无草稿Core实体|
|acceptedTurn / escrowP / escrowE2 / embodiedP / embodiedE2|整数/映射|资源承诺与实物转换可追溯|
|workNeeded / workDone / completedEpoch / entryEligibleFromTurn|整数/可空|维护结清才推进整编；完成E后最早下一T入场|
|B_q / rearArrears_q / lastRearPaidEpoch|锁定B/整数/可空|后方每E记一次；B由明确模板映射，不能按师/旅名字猜|
|enteredTurn / entryHex / deploymentEventId|可空；入场后永久|只有IndustrialEntryCommitted可写；失败保持null|
|firstActionEligibleTurn / entryPhase / initializationRuleRef / entryStateHash|可空/真实阶段/规则引用/哈希|部署时写入；最早enteredTurn自方后续阶段，实际动作仍需Core资格验证，不等同已行动|
|stock_q / debtD / step|Core单位字段|真实入场初始化0/0/模板初始档；此前不创建前线影子单位|
|weight / everCommitted / committedEventId|有理数/布尔/事件ID|实际入场同时置true并加入R一次；毁灭不移出R|
|RearMaintenanceRow|epoch、orderId、sourceId、arrearsBefore_q、currentDue_q、paidArrears_q、paidCurrent_q、arrearsAfter_q|due=B；paid≤旧欠＋本E；旧欠先清；usedSource=两项paid之和|
|FrontMaintenanceRow|epoch、unitId、B_q、stockBefore_q、received_q、maintenancePaid_q、D_before/after、loss、stockDestroyed_q|沿用真实补给结算输出，不用后方欠付填D|
|MaintenanceOwner|plannedUnitId、epoch、REAR/FRONT/NONE、reason|按E00状态唯一选定；本E入场前已成功则FRONT|

初始实际部署和旧定时增援也在各自真实部署事件纳入同一永久ID集合一次；导入检查点须有部署来源，不能将当前存活名册冒充历史投入名单。候补预约ID不纳入。

投入兵力：`R=ΣeverCommitted weight`；`L=ΣeverCommitted weight×lossFraction`，已消灭按1，存活按真实step/maxDamageSteps。候补只有订单/embodied，不进R/L。不得用maxDamageSteps=3硬编码处理022候选旅。

## 4. 战略地点：接收美术候选，不冻结落点

已按用户提供的远端固定提交读取ART-SCALE-019：`69eb6b3369fcf47ba51891dd0ad9dc08c35e54a0`，路径`research/ART-SCALE-019/REPORT.md`。Git blob `a5eb5572c46c5a0b6549a91e386e0c5adb04fbf0`，SHA256 `7c6d378c7bb93a84eddba648f1fdb7585fd4e776290899b2e3b9ae2cabc5b501`。本地美术工作树提交不同，未用其HEAD代替指定版。

**数量、S0—S6角色表均为候选，不对应已批准坐标。** ART-LAYOUT-020将交真实坐标清单；结算合同不等待它，但实际场景激活必须等待规则审核。024的9组/100VP同样是研究预算，不优先覆盖美术6—7组候选，也不在本轮二选一冻结。

|字段|研究阶段|未来批准条件|
|---|---|---|
|candidateId / artSourceCommit / layoutSourceCommit|S0等可作为候选引用；layoutSourceCommit=null|不得把候选ID直接当Core节点或正式objectiveId|
|siteId / objectiveGroupId|稳定业务ID或null|规则侧给真实物理地点分组；多个角色指向同一组，避免多份分数|
|roles[] / primaryRole|候选CITY/INDUSTRY/STATION/SUPPLY/CAPITAL等|角色不创造产能/源容量/得分；必须独立引用已批准资产|
|visualFootprintHexes / captureHexes|null，待020|视觉外围不默认是占领核心；需要逐格真实性、重叠和通行审查|
|initialOwner / homeSide|状态UNRESOLVED，值null|批准后允许GERMAN/SOVIET/NEUTRAL；NEUTRAL是明确值，不用null猜Core中性控制|
|occupationPolicy|null|规则审核可占单位、所有核心/部分控制条件、资格、两E确认和丢失判定；美术不能以屋顶决定|
|vpValue / willPressureKey|null|一个组一份VP和唯一压力键；角色重叠不自动累加|
|industrialAssetIds / supplySourceIds / hubIds / railNodeIds|候选引用或空；与未知区分|必须解析到对应实际系统的已批准ID；站场图案不默认供给源|
|reviewStatus / unresolved[] / decisionRef|CANDIDATE、LAYOUT_RECEIVED、RULES_REVIEWED、APPROVED|APPROVED且无执行必需缺项才进入scenarioHash；未决项不能填0静默运行|

去重验收：同一captureHex原则上只能属于一个计分组；若两个组重叠必须规则侧合并或明确特例，不能仅改ID躲避。组有多个格仍只有一份VP；同site的城市、工业、站场可共存，但生产事件和失守事件只贡献该组约定的一次地点压力。initialOwner决定开局确认，homeSide决定原有资产失去压力，二者不能跟随每次占领同时改写。

研究/003资源账可在地点未决时继续计算资源，`scoreStatus=UNRESOLVED`；不得将未知VP/W当零、输出胜率或宣布C模型验收。
