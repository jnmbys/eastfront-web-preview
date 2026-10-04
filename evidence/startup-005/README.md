# STARTUP-005 华为近景定位和缩放修复

**已修复可证明的近景阈值不可达问题；华为近景后台未完成的内部原因仍未确定。** 004 的近景已经启动，并推进到地面图片可用、投影结束。最后可定位的区间是随后栅格化及其调度/暂停检查，尚未走到近景画布写入或完成通知。不能据此宣布 CPU 死循环、解码或并发是根因。本轮没有重新要求用户操作，也没有重开公网。

## 输入与现场事实

从证据提交 `07187cf9e1214aa8507c3c2b4da9ca1444992f0e` 建立独立 `startup-005-close-diagnosis`。004 实际测试包为 R1 源码 `b9927e072d30fac8b732b815c0d817ce490d7d6e`，原 ZIP SHA256 为 `78c8169d8dd264d37fb93a07d33bb0810cd84a80111f723797466719df4d5d38`。逐文件核验 380 个文件的长度和 SHA256，004 的 `src/public` 与 R1 一致。详见 [input-audit.json](input-audit.json)。

已读取同一次启动的三份原始 JSON，逐一校验回执长度和 SHA256；四张 PNG 逐一解码并校验原始文件及 RGBA。前三张是同一远景，最后一张是中景，均为 2541×2294；没有近景截图。[screenshots-read.json](screenshots-read.json) 保留明细。Canvas 导出不包含单位、迷雾或浏览器界面，不能将它当作整个屏幕。原始勾选和用户观察保持原样，以实际 `lod` 区分覆盖范围。

设备为 OpenHarmony 6.1 / ArkWeb 6.1.0.120 / HuaweiBrowser 6.1.8.301，CSS 视口 **1302×607，DPR 2.125**。这是 ArkWeb 的现场观察，不是桌面 WebKit。实际缓存为新页面、未清缓存、状态未知；三份记录相同 timeOrigin，只有一次启动。串行真机没有执行。

以下相对时间均减去 004 的单机启动标记 `27608.3 ms`，不是导航总时长：

|现场证据|启动后时间|支持的结论|
|---|---:|---|
|远景完成|26.2260 秒|首个地形完成|
|地图 DOM / 控件可用观测|26.4949 / 26.4950 秒|与全部地形完成分别记录|
|中景完成|148.5675 秒|第二张地形可用|
|下一批 assets|148.6670 秒|顺序构建进入近景资源阶段|
|下一次 building / 第三次 projection 结束|148.8233 / 148.8387 秒|近景九张地面材质已成功加载并完成投影|
|第二次导出|252.4868 秒|仍在 building，挂载中景，图片活动 0|
|最后导出|535.9388 秒|状态相同，没有近景完成事件|

### 近景是否创建并启动

是。真实链路是 `boot → ProgressiveTerrain.request(far) → startNewGame → resume/continueAll → medium → close`。`continueAll` 会把未完成 LOD 全部入队，**不需要先放大进入近景**；缩放只调整优先级及选择已完成的缓存画布。004 先完成 far、medium，随后又成功加载九张地面材质并执行第三次 projection，因此 close 已进入构建回调。旧代码没有回调开始时间，能证实的启动区间是中景完成后至下一批 assets 之间，即 **148.5675–148.6670 秒**，不虚构精确时刻。

### 卡在什么区间

`createVS2WorldBaseLayer.paint` 的顺序是地面图片加载/取像素 → `runTerrainWork('projection')` → `rasterizeVS2WorldSurfaceAsync` → `raster-canvas-write` → 细节/森林/城市/基础设施 → surface 完成。

最后 JSON 的 12 条图片记录为中景末尾三张基础设施及近景九张地面材质，均成功；累计图片完成 60、活动 0、失败 0。最后计时是第三次 projection，之后没有 close rasterize、canvas-write 或完成事件。结合调用链，未完成区间落在 **近景栅格化的 await，包括首次调度、checkpoint 和计算批次**。这排除了“根本未请求近景”和“仍在等待这九张地面图的请求/解码/像素可用校验”的解释，也不支持“画好了只漏发完成通知”。后续森林/城市加载尚无推进证据。

旧 `runTerrainWork` 只在 finally 发计时，没有开始或中途计数，不能区分正在缓慢计算、浏览器定时调度延迟、暂停 checkpoint 或某个批次阻塞。近景像素步长 1、中景 2，栅格像素约为四倍；这只说明工作量差异，不证明长等待的原因。两段页面隐藏及中景时期 recovery 请求保留在原记录中，也不能单独定因。

### 为什么无法显示近景

004 的可信触摸输入共 30 条，缩放从 1 到 2.50，并发生平移，故不是手势完全没生效。`zoomMapAt/pinchMapViewport` 将用户缩放硬限制为 1–2.5。默认和 serial 都调用这段代码。

现有 LOD 使用 `max(560, viewportWidth - 面板占用) × (√3 × 42 / viewBoxWidth) × 用户缩放`。远景 `<56`，中景 `56..96`，近景 `>96`。实际 viewBox 宽约 2540.5686；收起面板可用宽 1278，最大值仅 **91.4850**，展开面板 1022 时约 **73.16**。无论 close 是否构建完成，都达不到 96。004 的早期估算 91.5055 使用了近似宽度，本轮按实际 SVG 数值复核，不修改旧证据。

适配缩放与用户缩放并未被重复相乘：SVG viewBox 自行适配，保存的相机值是用户倍率；DPR 不进入 LOD 判定。另一个已记录的限制是 LOD 用宽度估算，并非实际高度约束后的像素尺寸。本地同尺寸 SVG client 为 1264×413、fitScale 约 0.18009768；2.5 时实际六角宽约 32.75 CSS 像素，LOD 估算却为 91.485。此次沿用既有 LOD 估算策略，没有重设计阈值。资源未就绪只令 `best()` 暂时挂载已完成的低 LOD，**不限制相机缩放**。

## 最小修复和必要诊断

候选源码为 **`380047b5dccd9cc247ac50d4fb3d81a2336df394`**。

- 在原上限 2.5 的基础上，计算能够达到 97 估算像素的上限，并向上取整到 0.1。现场收起面板为 2.7，展开为 3.4；宽屏原本可达时仍为 2.5。按钮、滚轮、双指共用同一上限，保留焦点和平移；面板改变时不强制缩小当前倍率，FIT 仍回到 1。
- 新增一个最新 pipeline 的三个 LOD 状态及 queued/selected/building/complete 时间，最多 4 条当前工作和 12 条已结束工作。每个约 6ms 批次只更新计数，不追加日志；记录 `stage/state/steps/yields/workMs/lastAdvancedAt`，明确区分 checkpoint 与 yielding。`steps` 是生成器推进次数，不是像素数。若主线程完全阻塞，页面本身也无法实时导出，不能用缺少 JSON 反推具体循环位置。
- `?startupDiag=1` 在地图上提供当前 JSON 下载；每次点击现取快照并刷新文本。记录相机实际值、请求 LOD 与挂载 LOD，便于区分“已请求 close，但还在显示 medium”。无轮询、网络收集器、像素副本或素材 URL 明细扩张。

没有修改渲染算法、素材、地图、Core、认证、协议、MP 查询或 FLOW。R1 空 Canvas 校验、HTMLImage/fetch/bitmap 回退、超时、解码、图片释放、请求复用及并发/驻留上限均保留；单 builder、最多三张完成的 LOD surface 不变。没有提前通知完成、替换近景内容或减少画质。

## 本地复现与最终包检查

原基线和最终候选均使用 004 原观察器与 HOME→单机真实链路，内页为现场 1302×607 / DPR 2.125。每个模式用新浏览器 context，明确为本地空 HTTP 缓存；这不能替代华为真机。默认与 serial 的原基线都能完成近景后台构建，却只能放大到中景，因此 **华为后台长等待未在本地复现，不能归因于并发**。

|引擎和模式|原包最大缩放/挂载|最终包最大缩放/挂载|最终图片任务峰值/完成数|
|---|---|---|---|
|Edge 154 默认|2.5 / medium|2.7 / close|2 / 83|
|Edge 154 serial|2.5 / medium|2.7 / close|1 / 125|
|WebKit 26.5 默认|2.5 / medium|2.7 / close|1 / 83|
|WebKit 26.5 serial|2.5 / medium|2.7 / close|1 / 125|

最终完整核对见 [verified-results.json](verified-results.json)、[final-chromium](final-chromium/result.json)、[final-webkit](final-webkit/result.json)。两组实际服务的 381 个文件都逐一匹配候选清单。新诊断可观测 close raster 的 steps 随时间增长，结束时 active 为空、三个 LOD 完成。图片任务数是 loader job，不是网络连接或驻留内存测量；本轮未新增真机内存结论。

最终 close RGBA 与各自引擎已有近景参考完全一致：Chromium `749dc3d7cb2067c1e36722c2296cc40e565c040bbaa1442a88194ad15a797e2e`，WebKit `780d7831ce00b7ad50bce6d9da453065b53f4de68b78d43dc2d72859deaf00da`。跨引擎不互比像素。复用未修改的 R1 原生 WebKit 冷/暖检查，默认及 serial 共四项中景 RGBA 均为原参考 `54b4a71c077ba852a1cc30244d00eda50072a9847e5bec371ca533fe7b331358`；没有替换 decode、drawImage 或图片加载行为。原始 PNG/JSON 保存在 [final-webkit-native.json](final-webkit-native.json) 附近。

[final-diagnostic](final-diagnostic/result.json) 验证了真实 JSON 下载、点击时刷新、连续两份时间递增、文本与下载内容相同，以及面板切换/FIT。35 项定向回归和 50 项兼容回归全部通过，包含顺序与像素、暂停恢复、取消与资源释放、相机焦点、R1 解码回退及冻结边界；web/server 类型检查通过。日志为 `final-targeted-tests.log`、`compatibility-tests.log`、`final-typecheck.log`。

这里比较的是功能和像素，**没有给出启动提速结论**。最终部分浏览器检查并行运行，耗时受本机竞争影响；不将这些计时与 004 的 535.94 秒、MP-015 的 143 秒或早先人工慢响应测试比较。

`candidate-*`、`webkit-native-cold-warm*`、`diagnostic-*-final` 是源码提交前的开发检查，内置 build 仍显示 004 HEAD；它们保留供追溯，不能作为最终包身份。`final-*` 才是源码 380047b 的最终包检查。最初诊断按钮受工具栏裁切的脚本失败保存在 `diagnostic-export-r1/failure.json` 和 PNG，改为独立浮层后通过；这不是 004 华为后台问题。最初回归的旧冻结清单和浮点精度断言失败保存在 `initial-targeted-failures.log`，新增005专属哈希审阅、以 1e-12 检查焦点数学误差后通过，没有降低像素校验或改旧基线。

## 候选包和回退

[candidate-manifest.json](candidate-manifest.json) 保存完整源码 SHA、ZIP SHA256 和 381 个逐文件 hash。ZIP 位于本工作区 `.startup005/startup-005-candidate-380047b5dccd9cc247ac50d4fb3d81a2336df394.zip`，SHA256 **`e9b9ffb31dfb50081f1f89eb968f008759c61c8e1cc7401d0f30a7d24ba48ab8`**。ZIP CRC 及全部条目与清单一致，原 R1 ZIP 再核验未变，见 [archive-integrity.json](archive-integrity.json)。相对原包只改五个应用 JS 和 build.json，增加一个诊断模块，素材和其余字节均保持原样。

`?terrainLoad=serial` 保留相同候选字节、缩放修复和 R1 解码修复，只切换请求调度。它不是整个005改动的回退。完整回退使用原 b9927e 的 R1 ZIP；空 Canvas 修复仍在，但会恢复 2.5 上限。不能回退到存在原生 WebKit 像素失败的旧003候选。

尚需华为确认的只有候选缩放可达的实际操作及长等待时的新关键状态；见 [下一次真机操作卡](device-card.md)。本轮未进行华为复验或串行真机性能比较，不宣称完整验收通过。

复跑方法见 [scripts/startup005/README.md](../../scripts/startup005/README.md)。所有验证服务只绑定 loopback 并在 finally 关闭；最终进程/监听核验见 [closure.json](closure.json)。没有使用或关闭 MP-018 实例，没有合并、部署或重新开放任何公网入口。
