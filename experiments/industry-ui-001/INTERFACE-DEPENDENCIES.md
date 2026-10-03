# 工业012只读映射与演示边界

UI-002以已独立保存的UI-R1 `00a97635d882509675fe4d5f6e789cdbc791fdc0` 为基线。
012数据固定为 `e64c0e11fb16b05cfe725240193e8590b4eefd88`，读取其 [VIEW-CONTRACT.md](https://github.com/jnmbys/eastfront-web-preview/blob/e64c0e11fb16b05cfe725240193e8590b4eefd88/experiments/industry-integrate-012/VIEW-CONTRACT.md)、`export_view.py`、`view.py`、`VIEWS.json`、`EVIDENCE.json`、`README.md`及离线检查点。

## 已消费契约

使用既有 `industry-012-view.v1`，没有要求012提供新的字段、HTTP端点或写入接口。`record-adapter.mjs`验证和映射；`record-view.mjs`只展示。`records-012.mjs`是导出内容的静态封装，其provenance/label元数据是本UI的离线索引，内部`view`保持原值，不冒充新的工业契约。

|012字段|UI表达与限制|
|---|---|
|schema / readOnly / origin|只接受已知v1与readOnly=true；原样显示REAL、SYNTHETIC_FIXTURE、SYNTHETIC_FAULT_ON_REAL_REPLAY。REAL指已完成隔离实验，不代表实时连接|
|turn / phase / 三种revision|显示实际T与原始阶段、版本；检查点标签不替代实际回合|
|budget.grantedI / availableI / escrowI / productionPaidI / handoffPaidI|分开展示拨款、可用、托管、支出；支出只将两种已付金额相加，不作为报价|
|order及workCompleted/workRequired/workEpochs|null明确显示未下单；进度只读取已提交E，不按墙钟或切换次数推进|
|expectedCompletionEpoch / completedEpoch|前者显示条件预测，后者显示实际产出；不把预测当到账证据|
|equipment的produced/store/transit/rear/available字段|显示实物归属、实际库存及可用子集；验证实物守恒，不把预约加进产出|
|productionReservedE2 / incomingReservedE2|独立显示生产暂存预留和A10来货占位；不推算未导出的仓容上限|
|arrival|null或无receiptId时不宣称到账；不凭batch/shipment ID判定成功|
|externalCapacity|原样显示各E上限、已用、预留、算术剩余。epochClosed=true即标为可用0、不结转；未关闭记录也不代表当前授权|
|blockingReasons / lastRequestError|显示原因码与提示；错误样例的账本就是该样例数据，不合并主路径或重试结果|
|globalBlockersRetained / Closed|展示35项保留、0项关闭；不推导前线运输或恢复权限|

未导出的生产/交接报价、总报价、计划产量报价、仓容上限与权限统一显示“未提供”。即使源码配置或演示有值，也不补进v1记录视图。

## 易混淆边界

- `E5`检查点的实际回合是T6；容量行E5虽remaining=4，但已关闭，不可使用或结转。
- `E6`检查点实际已进入T7/GERMAN_SUPPLY_RAIL，availableRearE2=2；未伪造真实的“E6到账未可用”快照。`T7`检查点阶段则是GERMAN_RECOVERY。
- `blocked_receipt`是SYNTHETIC_FIXTURE，2 E2归HELD，目的预留2、实际库存0、运费已支出2I。
- `failure_after_*`/`failure_before_commit`是SYNTHETIC_FAULT_ON_REAL_REPLAY，仍为T6、进度1/2、产出0、托管2I、交接支出0；不套用重试成功结果。
- 未知schema、缺失必需字段（含应为null的字段）、非法类型或守恒不符：隐藏数据视图并列出缺失/错误，不显示上个检查点或演示默认值。只读禁用按钮始终保留。

## 离线来源及约束

`extract-012.py`用固定提交的9个Git blob核对源字节；调用原导出器（6个真实检查点+10个合成样例），继承TRACE/VIEWS摘要校验，核对VIEWS重复视图及最终EVIDENCE，提取前后复查源摘要。摘要和25项来源证据检查的简要状态保存在静态模块。这是读取既有证据，**没有重新运行012生产验证、Core或求解器**。

源码读取使用`python -B`，不生成源目录pycache；没有修改012原文件。服务器仍是127.0.0.1上的静态白名单，无业务HTTP或外部连接。真实预算/订单写入不属于本轮能力。

## 原演示适配器继续独立

`createDemoAdapter()`及其快照字段仍是UI内部演示约定，不是012正式API。`terminal`与`endgame`遵循R1：E24内可完成合法发运/接收；E24到账availableFromTurn=25只为账本信息，可用0；不提供T25或E25操作，未完成/暂存/HELD/托管照实保留。`fixtureStartTurn`仅为测试夹具，默认页面仍T5开始。

记录模式不导入演示快照或补齐演示常量。页面模式切换只管理可见性，检查点切换只更换静态记录；写入按钮禁用，隐藏演示事件处理器另有模式门禁。
