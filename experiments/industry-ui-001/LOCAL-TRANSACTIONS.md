# INDUSTRY-UI-005 · 017-R1本机事务接入

固定UI基线：`a1158b3acf730f47704463c59248c779e76d8a7a`。固定事务输入：`afdde93c8b7bbbc5c5974f11e18bd275324e88a7`。独立分支 `industry-ui-005`，仅保存，不合并部署。

## 启动与关闭

这是可操作的本机工作台，依赖已准备好的原017-R1目录及其 `.runtime`。静态截图或 `node serve.mjs` 不提供本机事务。页面与业务接口均由同一个127.0.0.1端口提供。

Windows PowerShell，从本UI目录运行：

```powershell
# 先核对输入，不启动事务、Core或HTTP监听
.\start-local.ps1 -BackendPath 'C:\path\to\017-R1\experiments\industry-integrate-017' -Check
# 如现有Python不能自动定位，增加 -Python 'C:\path\to\.venv\Scripts\python.exe'
.\start-local.ps1 -BackendPath 'C:\path\to\017-R1\experiments\industry-integrate-017' -Port 8817
```

`-BackendPath`也可用环境变量`INDUSTRY017_PATH`指定，Python可用`INDUSTRY_PYTHON`。脚本优先使用后端Git公共目录旁的既有`.venv`，检查NumPy/SciPy，不安装依赖。原017的准备流程仍由其原文档管理；本UI不会运行prepare、改写原INPUTS或修改Core。

打开终端打印的**完整会话链接**。链接fragment中的临时凭证由原R1客户端消费并从地址栏移除；不把该链接当成分享链接。固定默认端口8817，允许指定其他本机端口，不能指定公网监听地址。端口占用时直接退出，不终止其他程序。

正常使用：支付1I照管 → 按后端按钮推进10次合法阶段（含原场景增援）→ E8结算提交后页面进入T9 → 在德军恢复阶段恢复G-I-01。正式预算、库存、步损和RP均等后端确认并读取账本后展示。E8后先进入T9铁路补给阶段，继续到德军恢复阶段才可恢复。

关闭：回到启动终端按 **Ctrl+C**，等命令返回提示符；服务关闭监听、等待事务队列结束，并关闭求解worker。Windows实测Ctrl+C会让原求解子进程打印KeyboardInterrupt；随后显示“已关闭本机监听和事务会话”，监听、主进程和子进程均已退出（PTY退出码1）。未改动原worker信号处理。关闭后本次进度不持久保存，这是原017限制；页面没有重置、补仓、补预算接口。刷新或切换工作台模式不会创建新实例。若后端重启而旧页仍有未核对请求，原R1继续锁定，不能把新实例账本当成旧回执；保留旧页面记录，不通过清空存储来绕过。

## 接入范围与R1约束

`workbench_server.py`核对`backend-017-lock.json`中的22个原文件Git blob，随后直接导入原`local_http`。原`paths.load_adapter`在创建会话前校验1579个runtime文件。`--check`同样校验这些文件，但不创建会话。

只增加静态GET路由：`/`为既有演示/历史工作台，`/operate/`为本机页面，`/local-client.mjs`直接返回原017-R1 `app.mjs`字节（Git blob `2e13de1fc8dadec4b2a8b56f5bdfb8e2fab08f80`），其他路径是列举的UI静态模块。原`Handler.do_POST`、`do_OPTIONS`、`check`、`send`和`Session`均继承或复用，未重写。API不增加路由。

Host必须是本实例的`127.0.0.1:端口`；写操作Origin必须同源，API必须有原会话凭证。保留原CSP、拒绝跨源预检和无CORS响应。历史模式不调用API，不导入本机客户端；切换模式采用页面导航，卸载原客户端。`local-nav.mjs`仅做导航和消息标题映射，不发请求、不改请求存储、不判断业务资格。

| 017-R1路径/字段 | UI使用 |
| --- | --- |
| `GET /api/state`，`industry-017-state.v1` | 当前实例、版本、回合阶段、两账户、材料、运力、维护代价及恢复结果 |
| `operations.CARE/NEXT/RECOVER.enabled` | 原客户端启用业务按钮；点击后立即锁定，账本不预加减 |
| `POST /api/operations` | 仅原四字段`requestId/instanceId/expectedVersion/operation`；不接收任意Core命令 |
| `GET /api/requests/{requestId}` | 按原请求关联查询，不能从历史检查点或合成样例构造操作 |
| `COMMITTED/REJECTED`与`resultVersion` | 先保存确认回执与版本下限，再尝试读取正式账本 |
| `industry017.pending.v1` | 原客户端保留请求和确认状态；未知结果重试使用原四字段 |
| `industry017.view-floor.v1` | 响应应用时检查实例/版本；迟到旧读和刷新不能回退账本 |

已确认提交但读失败时，页面醒目显示“**已提交、账本待刷新**”，业务按钮锁定、重试写入隐藏，只恢复GET读取。未知结果可查询或按原ID重试；两者不可混淆。新会话链接在仍有待核对回执时不能清除旧实例锁定。

费用来自实际账本：装备原10I账户可用5→4，生产3I、原交接2I、照管1I；人员原2I账户已付接受1I、接驳1I，不再扣费。照管内部转账不算新增收入。恢复消耗1P＋2 E2，G-I-01步损1→0、RP德8/苏12不变。E8的G-REC-02维护0.5→0SP、D2→2.5，G-I-01库存2→3SP、G-PZ-01库存6→5.5SP由后端实际账本展示。原35项全局阻塞、德9/苏14 SP来源缺口不变。

## 验证命令与证据

```powershell
$env:PLAYWRIGHT_MODULE='C:\path\to\node_modules\playwright'
& 'C:\path\to\.venv\Scripts\python.exe' tests/verify-local.py --backend 'C:\path\to\017-R1\experiments\industry-integrate-017'
npm test
# 另一个终端运行node serve.mjs，仅测试原静态模式；测试后Ctrl+C关闭
npm run test:browser
```

`verify-local.py`使用真实017-R1会话、真实HTTP和浏览器点击；所有测试监听127.0.0.1随机端口。测试结束（包括失败路径）关闭HTTP与会话worker。原017/R1验证脚本不执行、原证据不覆盖。新证据写入本UI的`UI005-VALIDATION.json`及`evidence-005/*.json`，截图写入`evidence-005/screenshots`。

- 完整链路：12个不同请求（CARE、10次NEXT、RECOVER）。根49/游戏153/63单位，完整`bundle`、`bundleJSON`、`industry`、`personnel`和`forward.capacity`同时等于固定016的recovered和017的HTTP-TRACE终态。请求UUID/实例UUID不同，不声称全root哈希相同；原永久回执不变。
- 重复点击与无乐观成功；E8已提交但响应丢失，刷新仅查询原请求；未知结果刷新后重试四字段完全一致，后端只执行一次。
- COMMITTED与REJECTED后连续读失败、强制按钮事件、刷新、模式切换、迟到旧响应、旧实例视图及更换启动凭证，均不能跳过锁定或版本下限。
- 请求/读失败、外来实例与拒绝前故障为明确标注的**SYNTHETIC故障注入**；成功链路和最终账本是真实本机事务。没有据此宣称真实网络事故或另一个正式实例。
- 1440×1100、820×1180、1024×768的本机页布局；平板尺寸执行故障恢复/重试交互，完整终态三尺寸截图。原演示、012/013/016与E24终局约束全部回归。**浏览器视口检查，非真机验收。**

原只读提取校验仍可独立运行`extract-012.py / extract-013.py / extract-016.py --source <固定源目录> --check`；本机模式不把这些离线记录作为事务输入。
