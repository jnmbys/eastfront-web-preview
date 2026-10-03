# 017本地接口

固定监听127.0.0.1，默认8817。所有API要求`X-Local-Session: <启动链接片段中的凭证>`；POST还要求`Origin: http://127.0.0.1:<实际端口>`、`Content-Type: application/json`。不支持跨源。实例关闭后所有根、登记和回执查询都随进程消失；重新启动不接受旧instanceId。

## GET /api/state

返回`industry-017-state.v1`，只含必要只读投影：

| 字段 | 含义 |
|---|---|
| `instanceId` | 本次进程实例；不是权限凭证 |
| `version/gameRevision/materialRevision` | 完整根版本、原游戏版本、016联合材料版本；POST用version |
| `turn/phase/phaseLabel` | 真实当前Core阶段及展示标签 |
| `equipmentBudget/personnelBudget/care` | 两套原账户、照管转账/实付/到期；无二次赠款 |
| `materials` | P/E2的原权威分账派生：owner、custody、quantity、consumed |
| `rearInventory/frontInventory/availableFrontInventory` | 后方/前线实物与可用子集；不要加总子集为新库存 |
| `transport` | 原上限、实际SP占用、预留、货运已用、剩余；cargo仅费用规格，不再次计占用 |
| `shipment/terminal` | 本次E8发运/到账/T9可用和同一8W凭证状态；null表示尚无结果 |
| `impact` | null或实际E8逐受影响单位维护/库存/D及Core效果，来自本实例实际SP结算；参照来自固定015 |
| `target/recovery` | 真实步损、RP、次数/上限，以及已提交恢复结果；无结果时recovery为null |
| `expired/blockers` | 016到期和展示原因；不是新的授权 |
| `operations` | CARE/NEXT/RECOVER的enabled与精确当前操作描述；提交时仍重验 |
| `restrictions` | 单进程、无持久化、35项阻塞及来源缺口、正式运行未批准 |

不返回完整Core、bundle、原存档、授权/方案字段或永久回执全量内容。读取不创建新实例、不补仓、不扣费。`VIEW_UNRESOLVED_QUERY_RECEIPT`表示视图未能刷新，不能当作操作未提交；按请求ID查结果。

## POST /api/operations

只接受四个字段，拒绝多余字段：

```json
{
  "requestId": "a-client-generated-unique-id",
  "instanceId": "GET-state中的本次实例ID",
  "expectedVersion": 37,
  "operation": "CARE"
}
```

`requestId`为8—80位字母/数字/下划线/连字符，推荐UUID；`expectedVersion`必须为整数。operation只接受：

- `CARE`：调用016照管支付，价格固定1I。
- `NEXT`：服务端用原Core查询下一合法阶段/场景强制命令；调用方不能选择控制器、单位或原Core动作。E8运输随阶段结算触发。
- `RECOVER`：固定T9德国恢复阶段、G-I-01、P/E唯一支付。

首次登记时保存完整HTTP原文和一次生成的016内部绑定。旧版本/不可用请求拒绝后也固定保存，不因重试变成新请求；这些未进入事务的请求没有可执行内部绑定。相同ID内容变化409；格式错误400，Host/Origin/凭证错误403。内部绑定不会对客户端公开。

返回形状（示例不是成功证据）：

```json
{
  "requestId": "a-client-generated-unique-id",
  "instanceId": "同上",
  "operation": "CARE",
  "expectedVersion": 37,
  "status": "PENDING",
  "code": null,
  "resultVersion": null,
  "gameRevision": null
}
```

202表示PENDING/PROCESSING；200可以是已确认COMMITTED或REJECTED，**不能只看HTTP 200认定业务成功**。终态code示例：COMMITTED、STALE_VERSION、OPERATION_NOT_AVAILABLE、CORE_OR_TRANSACTION_REJECTED。并发失败可能由入队前版本检查或原016版本检查拒绝，均无部分扣费。

## GET /api/requests/{requestId}

返回上述必要结果投影。404 REQUEST_NOT_REGISTERED表示此实例尚无该ID，不表示另一个旧实例未提交。网络超时/连接断开/502等传输失败均应视为结果未确认：保留原四字段，查此接口；不得从新状态重新生成同ID的内部报价。确需重试时再次POST原四字段完全相同内容。只有确认旧请求拒绝/结束后，才为新的用户意图生成新ID。

## PowerShell接口例子

先启动服务，将启动URL片段中`session=`后的值暂存为环境变量`INDUSTRY017_TOKEN`。本段在T8未付款起点执行；页面操作和命令操作共享同一个实例。

```powershell
$base = 'http://127.0.0.1:8817'
$headers = @{ 'X-Local-Session' = $env:INDUSTRY017_TOKEN; Origin = $base }
$state = Invoke-RestMethod "$base/api/state" -Headers $headers

# 只在第一次创建用户意图时生成ID和固定请求正文。
$requestId = [guid]::NewGuid().ToString()
$body = @{
    requestId = $requestId
    instanceId = $state.instanceId
    expectedVersion = $state.version
    operation = 'CARE'
} | ConvertTo-Json -Compress

Invoke-RestMethod "$base/api/operations" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
Invoke-RestMethod "$base/api/requests/$requestId" -Headers $headers

# 若通信结果未知，先查询上行；必要重试必须复用原body，不重新读取版本拼装。
Invoke-RestMethod "$base/api/operations" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

确认COMMITTED后重新读取状态，为下一次意图建立新ID和正文，将operation改成NEXT。重复到T9德国恢复阶段后提交RECOVER。不要在服务重启后复用旧正文。

页面凭证和待确认正文只保存在各标签页的sessionStorage；它们不是权威存档。只读视图也不得用于重建或上传完整根。当前协议仅限017隔离接口，生产服务器和既有协议保持不变。
