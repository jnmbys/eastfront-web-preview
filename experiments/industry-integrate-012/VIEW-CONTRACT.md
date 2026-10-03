# 只读工业视图：industry-012-view.v1

前端消费既有结构，本轮不实现前端界面。内存接口为`Transactions.read_view()`，返回新建JSON兼容对象，读取前后根、游戏、库存、次数、revision及RNG不变。它没有授权、下单、扣费、改库存或回写入口。请求执行接口不属于这份前端交接契约。

离线入口只读已保存且摘要匹配的证据，不启动Core/求解器或创建实例：

```text
python experiments/industry-integrate-012/export_view.py --checkpoint E5
python experiments/industry-integrate-012/export_view.py --checkpoint T7
python experiments/industry-integrate-012/export_view.py --sample blocked_reserved_capacity
python experiments/industry-integrate-012/export_view.py --sample failure_after_receipt
```

| 字段 | 含义与前端处理 |
|---|---|
| `schema`, `readOnly` | 固定版本及只读标识；不是运行授权。 |
| `origin` | `REAL`为实际记录；合成样例保留`SYNTHETIC_*`标记，必须展示，不能当成另一笔真实订单。 |
| `rootRevision`, `gameRevision`, `industryRevision` | 分别为整体事务、游戏和工业账本版本。拨款/下单会改工业版本而不改游戏版本；普通阶段推进也不必改工业版本。 |
| `turn`, `phase` | 原Core当前回合与阶段。 |
| `budget.availableI` | 可用I，不含托管；禁止与RP/SP混算。 |
| `budget.escrowI` | 尚未发运的交接费托管。 |
| `budget.productionPaidI`, `handoffPaidI`, `grantedI` | 已付生产费、已付交接费及一次性拨款总额。 |
| `order` | 未下单为null；状态`WORKING`、`WAITING_HANDOFF`、`HELD`、`AVAILABLE`。生产完成但尚未入库不显示“可用”。 |
| `order.workCompleted`, `workRequired`, `workEpochs` | 已合法提交的工业进度，不是墙钟倒计时。 |
| `expectedCompletionEpoch`, `expectedCompletionIsConditional` | 无中断时的预计完成E，始终是条件预测；不得作为入库证据。 |
| `completedEpoch` | 实际产出事件的E；没有产出时null。 |
| `equipment.producedE2` | 唯一批次累计产出。E2:L不可自动替代人员或其他装备。 |
| `productionStoreE2`, `inTransitOrHeldE2`, `rearE2` | 三处实物数量，合计等于产出；`rearE2`不一定已可用。 |
| `availableRearE2` | 已到账且原Core达到可用turn的A10数量。 |
| `productionReservedE2`, `incomingReservedE2` | 容量占用，不是实物，不能加到装备总数。 |
| `equipment.P` | 固定0；本轮没有人员来源，不应显示完整恢复包。 |
| `arrival.receivedEpoch`, `availableFromTurn` | 未到账为null；本次成功为6、7。批次和shipment ID在未到账时可能已存在，不能凭ID判定成功。 |
| `arrival.receiptId` | 只有真正到账才非null；只是后方到账凭证，不能用作011的C10服务凭证。 |
| `externalCapacity[]` | 各E独立有限资源的上限、所有已用、所有预留及算术剩余。`epochClosed=true`后即使remaining>0也不能使用；`carryForward=false`。独立于SP rail/T/W。 |
| `blockingReasons` | 当前仍未解除的发运/收货阻塞；窗口过期会额外指出不能自动续期。空数组不代表可以恢复部队或已获运行授权。 |
| `lastRequestError` | 保存失败样例时附带的拒绝回执；正常内存读取为null。用于提示，不是账本事实，也不推动状态。 |
| `globalBlockersRetained`, `globalBlockersClosed` | 固定35、0。 |

`VIEWS.json`的每个元素为`{label, view}`。包括真实接受待生产、E5等待、E6到账和T7成功，以及单列的外部容量已用/预留、仓位受阻、发运/收货拒绝、提交前失败样例。合成样例仅复制真实检查点进行局部验证，不写入主实例。UI不得把历史E5剩余4工作点显示成T7可支配额度。
