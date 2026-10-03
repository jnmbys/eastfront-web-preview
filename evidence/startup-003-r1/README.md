# STARTUP-003-R1：WebKit 原生冷加载空纹理修复

已在原 Windows Playwright WebKit 26.5（build 2336）环境复现并定位真实缺图，R1 原生冷加载与串行回退通过零容差像素检查。华为真机仍为 **NOT_TESTED**；这不是对 MP-015 旧启动报错的根因判定，也不是华为验收完成。

先将原来的两次提交保存到远端 `startup-003-load-pipeline`，核对远端完整 HEAD `1183e8fa776623e06aa3758961749c53dff01eb2`（包含源码提交 `82ed4ad58213135d009fa7e31744043d6c586dd5`），再从该 HEAD 建立独立 `startup-003-r1`。旧报告、失败 PNG/JSON/日志、MP-015 证据和旧 ZIP 未改动。旧 ZIP SHA256 仍是 `feaac753f7e9c93b56ff7d59df76b518e9648f144a659c59b7844706c33a69da`。交付包、最终验证与源码完整 SHA 见本目录 `delivery.json`；保留该记录和 ZIP 旁的逐文件 manifest。

## 有证据支持的原因

这不是并发新增的错序或截图容差问题。原基线 `4db081bcfcd89c584fe7f53015b2a6ade63d87bf`、82ed4ad 旧候选及其 `?terrainLoad=serial` 在相同素材、新建冷缓存上下文中都失败；三个暖缓存结果完全相同。

`imageFromUrl` 同时启动原生 `decode()` 与 onload/Canvas 兼容路径。此 WebKit 的 `onload`、`complete=true`、非零 naturalWidth 可以早于可绘制像素。此时 `drawImage` 不抛错，却复制出全透明 Canvas。旧代码立刻将它作为成功资源返回并清空原图 src；光栅化消费空纹理，最终 surface 虽完成但真实缺图。地图就绪调用点未移动；等到最终截图再多等一帧也不能修复已经消费的空纹理。

证据链可独立复跑：

- [最小原生图片复现](decode-probe.json)：同一 grass.webp、禁止缓存、每模式 3 个新上下文。保留 src 模式的 3/3 onload 副本全透明，原生 decode 完成后同一图片均恢复 262,144 个可见像素及一致哈希。释放模式有 2/3 在**释放之前**已经全透明；`decoding='sync'` 提示也有 1/3 失败。无 decode / 等 decode 后复制的对照均正确。由此排除“仅释放后才损坏”的解释。
- [完整地图事件](webkit-matrix.json)：原基线 grass 在 128ms onload，129ms Canvas 成功/清 src，133ms 纹理消费时 visible=0，136ms decode 才完成。原基线、旧候选、旧串行分别消费了 7、9、5 张全透明地面纹理。
- 同文件 R1 的 dry_soil：257ms 复制，259ms 检出空 Canvas 并清理；264ms decode 完成才交付 HTMLImage，268ms 消费 262,144 个可见像素后释放。R1 消费的地面纹理没有全透明项。
- [原始完整分辨率 PNG 与差异数字](pixel-differences.json)：均为 2541×2294，5,829,054 像素。原基线冷/暖差 3,029,790 像素，旧候选差 3,024,789，旧串行差 2,892,126；最大通道差均 185。R1 默认与串行冷/暖对原基线暖缓存均 **0 个不同像素**。`*-diff.png` 是原始 RGB 绝对差，没有容差或平滑处理；数字检查包括 RGBA 全部通道。

## 最小修复与边界

产品代码只改 `src/render/terrainSurface.ts` 的 WebKit Canvas 兼容副本验收：读取最多 32 行一条的 alpha 数据，发现任意真实可见像素才接纳副本。全透明副本被清空并保留原图等待已有 decode、deadline 或后续回退。没有改素材、图层顺序、透明度、滤波、LOD、地图、Core、认证、协议或就绪标记。

有像素的 onload 副本仍可在 decode 拒绝、挂起或不存在时立即成功。真正的空副本不能触发 asset-complete；持续无像素仍在原期限报错并走独立 fetch/bitmap/blob-image 回退。没有添加等待时长、延长超时或删重试。取消仍清 handlers/src/timer；晚到解码不重新接纳。新增 5 项回归检查覆盖这些情况和只有最后一条带低 alpha 像素的稀疏透明素材。

现有桌面任务窗口 2、WebKit 队列 1、基础设施最多驻留 3 张、不可取消的原生 bitmap 槽位 2 均保持。新增 alpha 检查不保留全图 CPU 副本；[202 张现有 terrain PNG/WebP 审计](asset-visibility.json) 全部包含可见像素，最大单条临时 RGBA 为 98,304 字节。此假设针对当前固定素材；未来新增合法全透明 terrain 资源需要重新明确其语义，不能被此加载器当作正常可见材质。浏览器内部解码/GPU/缓存/RSS不属于这些所有权计数；清 src 不证明底层原生解码即时终止。

## 验证结果

WebKit 与桌面分别记录，不能互相替代或替代华为。WebKit 未注入 decode 失败来冒充原生门禁。

|检查|结果与证据|
|---|---|
|原生 WebKit 冷/暖，默认与 serial|`webkit-matrix.json`、`webkit-repeat.json`、`webkit-lifecycle.json`：两种模式各 4 个新上下文的冷/暖结果均匹配原基线暖缓存 SHA256 `54b4a71c077ba852a1cc30244d00eda50072a9847e5bec371ca533fe7b331358`|
|WebKit 慢响应、503 独立恢复、bitmap 拒绝后 blob-image|`webkit-lifecycle.json`：两模式全部零像素差；失败各多 1 个必要恢复请求，无吞错|
|WebKit 取消、重建、far/close/medium LOD|同文件：取消后 active/resident/ready=0，重建后 active/resident=0；两模式 LOD 各自哈希一致，重复请求已完成 LOD 不重建，dispose 释放 3 张 surface|
|桌面原基线/旧候选/R1/串行|`chromium-slow.json`：冷、暖、禁缓存慢响应的 RGBA 全部一致（软件 Canvas 固定渲染条件）|
|定向自动测试|95/95 通过；另外受影响的冻结边界检查 7/7 通过，两端 typecheck、server build 通过。历史 SHA 清单不变，R1 只给 terrainSurface 增加独立、明确的复核检查值|

本轮没有重新运行无关的全量测试，STARTUP-003 旧报告中的全量失败记录保持原状。最终候选源码为 `b9927e072d30fac8b732b815c0d817ce490d7d6e`；原生无插桩检查 `webkit-unmodified.json` 的默认/serial 冷暖共 4 项全部零像素差。连同前面的插桩检查，两种模式各有 5 个独立冷缓存上下文通过；最终 far/close/medium 哈希也与原证据中的基线暖缓存 LOD 相同。详见 `delivery.json`、`candidate-manifest.json`；验证进程已关闭，见 `process-cleanup.json`。

桌面在每个请求固定延迟 250ms、禁止缓存时的单次本地对照：

|模式|完整 medium 地形耗时|HTTP 请求/重复|逻辑加载/重复|任务峰值/驻留峰值|
|---|---:|---:|---:|---:|
|原基线|17.860s|46/15|46/15|1/1|
|旧候选|10.535s|32/1|32/1|2/3|
|R1|10.859s|32/1|32/1|2/3|
|R1 serial|17.517s|46/15|46/15|1/1|

R1 较原基线该样本约减少 39.2%。这不是中位数/P95，也不是 MP-015 的 143 秒 map-dom-ready 口径。当前任务不把原基线旧缺图时的更少绘制耗时作为 WebKit 提速承诺。

[分类汇总](summary.json) 提供请求/重复、加载累计、原生 decode Promise 区间、responseEnd→ready、bitmap、同步绘制、像素读回、CPU 分片和资源峰值；原 JSON 保留逐任务、逐请求和事件。原生 decode Promise 包含传输/调度，不是独立解码 CPU 时间；并发累计区间重叠，不能与总时间直接相加减。驻留峰值是交付图片 RGBA 估算，不是浏览器内存峰值。

## 复跑

所有服务仅绑定 127.0.0.1；脚本 finally 关闭 browser/server，不启动游戏联机服务或公网。

1. `npm ci --ignore-scripts --no-audit --no-fund`；`npm run build`。准备原基线 4db081bc 和旧候选 1183e8fa 的独立 checkout，各自 npm ci/build。可以用 `git worktree add --detach <新目录> <完整SHA>`；不要写入已归档目录。
2. 设置 `PLAYWRIGHT_MODULE` 为 Playwright 包路径；WebKit 使用与旧证据相同的 `PLAYWRIGHT_BROWSERS_PATH`（2336）。设置 `STARTUP003_BASELINE` 为原基线 dist、`STARTUP003_PIPELINE` 为旧候选 dist。默认本机路径为相邻旧工作区的既有 dist；可用环境变量替换。桌面设置 `STARTUP003_CHROMIUM` 为 Edge 可执行文件。
3. `node scripts/startup003r1/probe.mjs <新目录>/decode-probe.json` 复跑最小原生图片实验。`node scripts/startup003r1/browser.mjs webkit <新目录>/webkit-matrix.json` 默认比较 original、pipeline、pipeline-serial、r1、r1-serial，包含冷暖和 LOD；原基线暖缓存作为严格零差参照。
4. 只复跑 R1 时设置 `STARTUP003_LABELS=r1,r1-serial`、`STARTUP003_REFERENCE=<已完成matrix.json>`。`STARTUP003_REPEATS=2` 重复两个新上下文；`STARTUP003_SKIP_LOD=1` 可用于额外冷暖重复。取消这些两个参数，设置 `STARTUP003_SCENARIOS=cold,slow,failure,blob-fallback` 验证生命周期及回退。无容差放宽；原生测试不要设置 `STARTUP003_DECODE_CANVAS`。
5. 桌面设置 `STARTUP003_LABELS=original,pipeline,r1,r1-serial`、`STARTUP003_SCENARIOS=cold,uncached-slow`、`STARTUP003_SKIP_LOD=1`，清掉 WebKit 专用的 `STARTUP003_REFERENCE`，运行 `node scripts/startup003r1/browser.mjs chromium <新目录>/chromium-slow.json`。
6. `node scripts/startup003r1/native-smoke.mjs <新目录>/webkit-unmodified.json` 对当前 dist 做不插桩的原生 WebKit 冷暖校验，`STARTUP003_REFERENCE` 指定原基线 WebKit 暖缓存记录。输出路径必须不存在；已有证据不会被覆盖。
7. `python scripts/startup003r1/analyze.py`（Pillow/numpy）重算本目录 PNG 差异、事件与素材汇总。`node --test tests/safari-terrain-loading.test.mjs tests/startup003-pipeline.test.mjs tests/startup002-diagnostics.test.mjs tests/startup-progress.test.mjs tests/ui009r2d2-loader.test.mjs tests/ui009r2-startup-loader.test.mjs tests/ui009r2-terrain-surface.test.mjs tests/perf003-terrain.test.mjs tests/vs2-world-surface.test.mjs tests/vs2-surface-integration.test.mjs tests/vs2-infrastructure-lod.test.mjs` 为本轮 95 项集合。边界检查命令与日志见 `validation.json`。
8. 干净源码提交后运行 `node scripts/startup003r1/build-artifact.mjs`，本地生成 `.startup003/r1/startup-003-r1-candidate-<完整源码SHA>.zip` 及逐文件 SHA256 manifest。没有发布命令。

回退加载调度：页面加 `?terrainLoad=serial`（已有 query 用 `&terrainLoad=serial`），保留 R1 修复及 STARTUP-002 兼容路径。完整源码回退：`1183e8fa776623e06aa3758961749c53dff01eb2`；它会同时恢复本报告已证实的冷加载缺陷，应明确区分两种回退。所有提交带 `[CF-Pages-Skip]`，仅保存独立远端分支，不合并、不部署、不重开公网。
