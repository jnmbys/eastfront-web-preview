# INDUSTRY-UI-006 · 从T5下单到T9恢复

UI输入 `5dc9e51c090a3c9b269e9bb0e7c54afbc3465289`；工业018输入 `0f31196d998fb9be8e27e2183161fb4cec0f01e1`。独立分支 `industry-ui-006`，提交带 `[CF-Pages-Skip]`，不合并、不部署、不开公网。

## 启动与简短操作

使用此电脑已有的Python/NumPy/SciPy、Node和已准备的018目录。UI启动器不准备、修改或替换原后端。

```powershell
# 本UI目录；只检查26个固定源文件和1624个运行文件，不开启事务
.\start-chain.ps1 -BackendPath 'C:\path\to\industry-integrate-018\experiments\industry-integrate-018' -Check
# 实际启动，默认仅127.0.0.1:8818
.\start-chain.ps1 -BackendPath 'C:\path\to\industry-integrate-018\experiments\industry-integrate-018'
```

如需指定现有Python，增加`-Python C:\path\to\.venv\Scripts\python.exe`。也支持`INDUSTRY018_PATH`、`INDUSTRY_PYTHON`。打开终端完整会话链接；原会话凭证保存在当前标签页、从地址fragment移除，不保存到证据。

1. T5领取原10I装备拨款，再下单2 E2（付3I、托管2I）。
2. 每次点击“推进下一步”前读旁边说明；E5进度1/2，E6到账，页面进入T7时装备可用。
3. 到T7德军恢复阶段，启用场景假定后备池与独立2I账户，再申请1P接驳。推进到E7，T8人员到账可用。
4. T8德军恢复阶段支付1I照管，来自装备账户；之后推进至E8前送，T9在C10到账可用。
5. 继续逐步推进至T9德军恢复阶段，点击恢复G-I-01。消耗1P＋2 E2，步损1→0，RP不变。本轮停止继续推进。

阶段按钮不会自动领取拨款、下单、启用、申请、照管或恢复，也无批量推进。后端可能允许在下单/申请窗口直接推进；页面明确提示跳过会错失本场景后续资格，UI不替用户决定。

关闭：回启动终端按Ctrl+C，等待“已关闭本机监听和事务会话”。原求解进程可能打印KeyboardInterrupt，监听和子进程随后退出。关闭后进度不持久保存；刷新、切换模式不会重置实例或未确认请求。旧实例未完成的回执不能用新实例账本解锁。

`node serve.mjs`只是演示/历史静态预览。原`start-local.ps1`、`workbench_server.py`、`backend-017-lock.json`及017页面保持UI-005原字节；018有单独的`start-chain.ps1`和`backend-018-lock.json`。018目录传给017启动器仍被旧锁拒绝，未放宽旧锁。

## 接入与字段映射

`workbench_018_server.py`先核对固定提交的26个文件Git blob（含证据、接口、源码和原截图），再直接加载原`local_server`；原loader核验1624个运行文件。只调整静态GET路由，原`Session`及HTTP的POST、Origin/Host/凭证校验、OPTIONS、CSP全部沿用，不增加业务接口。

本机客户端`chain-client.mjs`从固定018客户端保留R1请求逻辑，展示拆到`chain-view.mjs`；视图模块不发请求、不写sessionStorage。七种操作均使用原四字段`requestId/instanceId/expectedVersion/operation`，独立的`industry018.*`键不与017混用。

| 后端字段 | 玩家展示 |
| --- | --- |
| `operations[op].enabled/label` | 七个按钮资格、当前事项和逐步推进说明；未确认时保持锁定 |
| `extensions.industry018.accountStatus` | 装备“尚未拨款”与人员“尚未启用”；不把兼容零值显示为已到账账户 |
| `order/production` | 实际生产结算次数、经过E、生产预留；无虚假倒计时 |
| `equipmentBatch/personnel.package` | 原A10接驳到账E/可用T，标为历史时点，不覆盖后来C10前送时点 |
| `personnel.sourceKind/trainingReceipt` | 场景假定后备池，没有实际训练回执；启用不是训练 |
| `equipmentBudget/personnelBudget/care` | 两账户拨款、可用、托管与支出分开；照管内部划拨只算一次支出 |
| `materials` | 当前归属、实物、可用、隔离子集、已消费历史，不重复累加旧记录 |
| `equipmentHandoffCapacity` | 已关闭E的独立交接工作点账；剩余不当作当前运力 |
| `personnel.quota/incomingP` | 独立4LQ及预留、不刷新；入库预留不算实物 |
| `shipment/transport/terminal` | E8前送、T9可用，SP/材料/预留/剩余；8W只计一次 |
| `impact/recovery/target` | 实际维护代价、库存变化、步损与RP、恢复次数 |
| `version/gameRevision/materialRevision/instanceId/handoffs` | 默认折叠的诊断区，不在玩家主流程显示内部阶段号或哈希 |

订单2 E2、3I+2I、人员期限和一次性拨款等固定说明依据018已验收API与README；页面明确把预计到账、费用预告与已提交账本区分。生产工期/进度来自实时扩展。人员未照管在E8结束留后方会隔离；已照管则读取`care.endEpoch`至E9结束。隔离仍占仓容。

收到COMMITTED/REJECTED先持久保存原请求确认与版本下限，再读取同实例的新账本。读失败保持七个业务按钮锁定，确认提交显示“已提交、账本待刷新”，仅恢复GET；未知结果才允许原四字段重试。模式切换卸载客户端但保留关联，旧版本响应与旧实例不能解除锁定。未知或缺失018扩展拒绝渲染，不套演示默认值。

## 验证与复跑

```powershell
$env:PLAYWRIGHT_MODULE='C:\path\to\node_modules\playwright'
& 'C:\path\to\.venv\Scripts\python.exe' tests/verify-chain.py --backend 'C:\path\to\industry-integrate-018\experiments\industry-integrate-018'
node --test tests/chain-view.test.mjs
npm test
# 另一个终端node serve.mjs，运行原模式回归，结束后Ctrl+C关闭静态服务
npm run test:browser
```

新测试只写本目录`UI006-VALIDATION.json`和`evidence-006`，不运行018原verify、不覆盖旧018/017证据。视图测试读取本轮实际浏览器采集的视图，生产页面不读取测试记录。

- **真实链路**：49个不同请求（43次逐步NEXT＋其余6种业务各一次），浏览器50次POST含1次原请求重复。T7/T8完整交接根与018逐字段一致；终态根49、游戏153，63单位，完整bundle/bundleJSON、industry、personnel和forward.capacity与018一致。动态请求UUID及祖先摘要差异单列，不声称完整root哈希相同。
- **请求恢复**：七种操作分别验证提交后读失败、全部业务按钮锁定、强制重复点击、刷新及仅GET恢复。另验未知下单结果原请求重试、关键阶段刷新、跨阶段晚到原请求、模式切换、迟到旧GET、持久版本下限与旧实例/新凭证。网络/读故障为明确SYNTHETIC注入，实际业务由真实018执行。
- **旧模式回归**：原56项单元测试及演示/012/013/016四套浏览器测试通过；E24无T25/E25操作、终局受阻保留。旧报告原字节不变，新回归摘要单独保存。
- **视口**：1440×1100、820×1180、1024×768分别核对布局和模式切换；关键操作也在平板尺寸执行。截图与视口报告独立保存。浏览器视口检查，非真机验收。

35项全局阻塞、德9/苏14 SP来源缺口保留。不更改Core、政策、预算、材料或事务后端；未合并、未部署、未开放公网。所有验证监听和worker在finally关闭。
