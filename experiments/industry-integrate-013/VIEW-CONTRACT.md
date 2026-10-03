# 人员只读视图 v1

入口：活实例`Transactions.read_view()`；保存证据`export_view.py --checkpoint T8`或`--sample <VIEWS.json标签>`。两者使用`view.export_view`，返回独立对象并检查前后根摘要相同。保存文件导出先校验对应证据摘要，不执行Core、申请、付款或入库。前端不得从此视图重建权威根。

| 字段 | 口径 |
|---|---|
| `schema / readOnly / origin` | `industry-013-personnel-view.v1`；只读。REAL为主路径，SYNTHETIC前缀为明确的合成试验/边界；不可当真实库存合并 |
| `rootRevision / gameRevision / turn / phase` | 当前观察点；工业事务revision与游戏revision分开 |
| `source` | 场景初始已训练后备假设，`actualTrainingReceipt=null`；导入标记、唯一来源/预算/包/申请/批次/运输/到账ID |
| `personnelBudget` | 独立人员账户：grantedI、availableI、acceptanceCareSpentI、escrowI、carriageSpentI；总额守恒2I |
| `equipment012Budget` | 原012完整预算；5I余额、3I生产费、2I交接费保持不变，不能用于人员申请 |
| `applicationStatus` | NOT_APPLIED / ACCEPTED / IN_TRANSIT / HELD / RECEIVED / AVAILABLE / EXPIRED。瞬间状态也保存在权威事件账中 |
| `custody` | 唯一包的owner和状态；sourceP、transitP、rearP为互斥归属，合计1P；quarantinedP是其中的状态子集，不能再相加 |
| `warehouse` | 单一RC007-REAR-G-A10，A10/0,9；P容量1、驻留/可用/隔离/入库预留；E2容量2及原012驻留2 |
| `warehouse.personnelAuthority` | 人员实物只读自personnel.package；旧012P=0为历史字段，不是当前P的另一库存 |
| `service` | 独立总额度4LQ，used/held/remaining；不按E刷新、不借SP或012能力，发运E7/E8、最晚收货E9 |
| `receivedEpoch / availableFromTurn` | 实际到账和次T可用；未发生为null，不用0占位。主路径为7/8 |
| `careEndsAfterEpoch` | 实际到账E+1结束后隔离；主路径为E8。可用不等于获得后续操作授权 |
| `blockingReasons` | 当前运力/仓位/资格/隔离原因；空数组只表示本切片当前无所列阻塞 |
| `lastRequestError` | 失败样例附带的请求错误；账本仍是失败前已提交状态，不是失败后的虚构结果 |
| `forwardTransportRecoveryFormationAllowed` | 恒false：不能据到账或可用信息开放前线运输、恢复、新编 |
| `globalBlockersRetained / globalBlockersClosed` | 35 / 0 |

`VIEWS.json`保存主路径导入、已接受等待、E7到账、T8成功；合成的运力已用/预留不足、拒收HELD、各处过期/终局和提交前失败。样例标签及origin必须一起展示或保留，尤其不能把合成受阻/过期视图的turn当成真实推进证明。

没有传入授权、材料数量、成本、epoch或写回库存的参数。视图字段不是请求报价，也不是恢复/运输凭证；权威完整根在TRACE中另存。
