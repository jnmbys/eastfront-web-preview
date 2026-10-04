# 018 本机接口交接

仅127.0.0.1、单进程、一个match。每次启动从012真实T5/game revision109新建唯一实例；刷新不重置，关闭不持久保存。未来UI消费本接口，不导入TRACE或演示数据来生成成功。

沿用017四字段请求和原安全校验；017-R1、UI-005原文件与启动方式均未改。本018服务新增四种固定意图及只读扩展，旧CARE/NEXT/RECOVER及旧视图字段保留。UI-005原启动器仍固定核验017-R1，不声称它能直接改指向018通过其版本锁；下一轮UI应明确适配以下新增操作。

| 方法与路径 | 返回/用途 |
| --- | --- |
| GET `/api/state` | `industry-017-state.v1`；旧字段加`extensions.industry018`及四个新增operations |
| POST `/api/operations` | 仅`requestId, instanceId, expectedVersion, operation`；202为登记，不能当作已付款 |
| GET `/api/requests/{requestId}` | 原ID回执：PENDING/PROCESSING/COMMITTED/REJECTED，及resultVersion、gameRevision、code |

API都要求`X-Local-Session`；Host须精确匹配本机监听，POST须同源Origin和`application/json`。不接受完整存档、库存、预算、价格、配置、授权、Core命令或运输方案。无CORS、任意文件读取、重置或重新导入入口。凭证仅在启动链接fragment出现，不写证据。

| operation | 有效时机 | 固定业务 |
| --- | --- | --- |
| ALLOCATE_I | T5德国恢复、尚未拨款 | 原一次性10I |
| PLACE_ORDER | 同上且已拨款、尚无订单 | 2 E2，付3I、托管2I |
| ACTIVATE_PERSONNEL | T7德国恢复、尚未启用 | 原场景已训练池1P及独立2I；不是训练行为 |
| APPLY_PERSONNEL | 同上且已启用、尚未申请 | 支付1I、托管1I |
| CARE | T8德国恢复且仍满足原016条件 | 原装备账户支付1I，照管至E9结束 |
| NEXT | 当前合法阶段 | 原结束阶段或必需场景增援；自动执行该E的生产/接驳/前送结算 |
| RECOVER | T9德国恢复且原Core共同资格与服务凭证满足 | G-I-01支付1P＋2 E2，RP不扣，共用次数 |

用`operations[op].enabled/label`驱动按钮。NEXT不会替用户自动下单或申请；跳过必要业务可能导致后续完整根不符合授权切片，交接拒绝，不能靠新ID补预算或延长窗口。页面停在T9恢复/恢复后；到期分支由验证器的私有测试副本执行，不开放任意阶段/存档入口。

`extensions.industry018`字段说明：

| 字段 | 语义 |
| --- | --- |
| schema / stage / matchId | `industry-018-chain.v1`；当前012/013/016处理阶段，同一个match |
| order | 永久订单、批次ID、原订单状态、接受T、实际workEpochs；null代表尚未下单 |
| production | 已推进/需要的合法E数量，生产库存预留；不是前端倒计时 |
| equipmentBatch | 当前唯一装备批次，数量、owner/custody、生产回执ID、receivedEpoch、availableFromTurn、消费墓碑 |
| equipmentHandoffCapacity | 012独立外部服务：每E4工作点、每E2占2；实际used/holds及窗口，不能作SP铁路/T/W |
| personnel | 永久人员ID、原场景来源、无训练回执、是否启用、申请、唯一package、独立4LQ总额度及预留；T7前null |
| handoffs | 实际根交接方向、游戏版本、保留的永久回执数量；无完整权威根或写回材料 |
| accountStatus | NOT_ALLOCATED/NOT_ACTIVATED表示尚未启用。旧兼容预算零值仅表示尚无该拨款，不是未来预算假设 |

旧`equipmentBudget/personnelBudget/care/materials/rearInventory/frontInventory/availableFrontInventory/transport/shipment/terminal/recovery/target/impact/blockers`仍来自当前账。前送材料版本`materialRevision`从原016阶段开始计，不代表012生产版本；并发写入应绑定顶层`version`。请求内部绑定完整链根摘要、原阶段完整绑定及原候选授权；不由请求自报。

收到COMMITTED后先持久保存请求关联与resultVersion，再GET同实例且版本不低于该值的账本。失败时显示“已提交、账本待刷新”，锁定所有七个业务按钮；不再POST。结果未知才查询原ID或按首次原内容重试。REJECTED也要等新视图恢复后再释放业务按钮。018页复用R1恢复逻辑、使用独立`industry018.*`sessionStorage键，避免与旧页混用。

PowerShell接口示例（用实际启动端口/凭证替换，不将凭证提交到Git）：

```powershell
$serviceUrl = 'http://127.0.0.1:8818'
$sessionKey = '从本次启动链接session片段读取'
$headers = @{ 'X-Local-Session'=$sessionKey; Origin=$serviceUrl }
$state = Invoke-RestMethod "$serviceUrl/api/state" -Headers $headers
$requestId = [guid]::NewGuid().ToString()
$body = @{requestId=$requestId; instanceId=$state.instanceId; expectedVersion=$state.version; operation='ALLOCATE_I'} | ConvertTo-Json
Invoke-RestMethod "$serviceUrl/api/operations" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
Invoke-RestMethod "$serviceUrl/api/requests/$requestId" -Headers $headers
# 不生成新ID重试未知请求；确认提交后只恢复读取
Invoke-RestMethod "$serviceUrl/api/state" -Headers $headers
```

35项全局阻塞、德9/苏14 SP缺口保留。018本机实验不构成正式运行、跨进程或崩溃持久化接口。
