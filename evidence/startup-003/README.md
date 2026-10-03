# STARTUP-003 候选与验证记录

独立分支 `startup-003-load-pipeline`，基线 `4db081bcfcd89c584fe7f53015b2a6ade63d87bf`。交付状态为**独立候选，未通过全部验收**：桌面像素检查通过；WebKit 原生冷加载像素门禁未通过；华为真机未测。没有合并、推送、部署或开启公网。

MP-015 的约143秒 `map-dom-ready`、42个图片任务和峰值1来自既有真机记录。本轮使用同一640格地图、生产视觉种子17、medium完整地形构建作为计时区间，正常基线46个任务。两者不是相同计时口径，不能声称把华为143秒降至下表时间。原启动报错未复现，也没有确定其根因。

## 调用链与重复请求

`main.prepareTerrain → ProgressiveTerrain.request → buildCachedTerrainSurface → VS2 worldBase.paint → paintInfrastructure`。初始画面仍等待完整surface；没有改动 main、就绪标记、联机查询或LOD选择。

1. 地面按 `VS2_WORLD_MATERIAL_IDS` 原顺序加载9张，提取CPU像素；随后投影、光栅化和细节绘制。
2. 森林按实际规划的去重、排序ID加载，再处理覆盖和合成。
3. 城市按原规划、去重、排序ID绘制，Far仍使用原有轮廓。
4. 基础设施保持原来的河流小/大分组、道路、铁路、逐桥桥面及覆盖顺序。这里的同一河流材质、桥面/道路/铁路覆盖会重复加载；原代码每次绘制后立即释放。同一次完整medium构建有31个不同ID，46次逻辑加载，15次重复。

必要重试仍保留：HTMLImage失败后独立 `fetch(cache:reload, terrain-recovery=...)`，再尝试bitmap和blob-image。超时后的独立请求不能复用失败Promise；浏览器资源时间线中同一路径出现两次不一定是无谓重复。跨LOD重新提取已释放的纹理、LRU逐出后重新加载、主动重建也保留；没有新增跨地图/跨LOD的长期解码缓存。

## 实现与边界

- 地面、森林、城市采用两张滑动窗口：窗口同时计算加载中和已完成待消费图片，首图慢不会无限积累后续结果。完成次序可变，消费/绘制次序不变。
- WebKit分类、现有共享队列和单任务限制保留，窗口为1。没有新增华为UA推断或提高超时。
- 基础设施仍串行绘制，最多3张LRU图片复用，加载新图前逐出；整个阶段的 `finally` 释放全部图片。任务数46→32，仍有1次受容量限制的重载。
- `ProgressiveTerrain.dispose()`传递取消；图片清除src、事件和计时器，fetch请求abort并拒绝晚到结果，bitmap晚到关闭，blob URL回收。旧AbortSignal没有 `reason`/`throwIfAborted` 时也可用。
- 原生bitmap解码不能取消：新增全模块上限2，超时/取消不会提前归还槽位；占满时走已有blob-image回退，晚到关闭后才归还。测试覆盖5次连续超时只启动2个原生bitmap，后续正常恢复。
- 地面CPU纹理仍为9张、7.75 MiB；最终LOD surface最多3张，与基线相同。实测交付图片驻留峰值1→3，桌面解码RGBA估算峰值最高1.25→2.5 MiB；不是浏览器RSS/GPU/网络缓存峰值。清除src和请求abort不能证明某台浏览器已停止底层网络或解码。

回退入口：页面URL加 `?terrainLoad=serial`（已有query用 `&terrainLoad=serial`）。它恢复单张消费和基础设施逐次加载，保留STARTUP-002回退/期限及新的清理和bitmap上限。若要源码完全回退，使用上述完整基线SHA；没有自动切换或远程开关。

## 前后数据

下表为单次本地样本，不是中位数/P95或真机承诺。桌面为Windows Edge/Chromium，固定软件Canvas用于逐像素比较；WebKit为Windows Playwright WebKit，不是Safari或华为。浏览器精确版本、逐资源与逐任务时间见各JSON。

|场景|基线→候选构建耗时|HTTP请求/重复请求|逻辑任务/重复任务|
|---|---:|---:|---:|
|桌面冷缓存|5.80→5.48秒|31/0→31/0|46/15→32/1|
|桌面暖缓存|5.56→5.42秒|0/0→0/0|46/15→32/1|
|桌面每个未缓存响应延迟250ms|13.73→10.79秒（约21%）|31/0→31/0|46/15→32/1|
|桌面禁止缓存，每次响应延迟250ms|17.78→10.84秒（约39%）|46/15→32/1|46/15→32/1|
|桌面首张草地贴图延迟超过15秒，恢复成功|21.05→20.91秒|32/1→32/1（各1次必要恢复）|46→32|
|WebKit原生，每个未缓存响应延迟250ms|17.44→17.31秒|31/0→31/0|46/15→32/1|
|WebKit固定onload/Canvas回退，禁止缓存且每响应250ms|21.61→18.18秒（约16%）|46/15→32/1|46/15→32/1|

桌面峰值加载任务1→2，WebKit仍为1。单个慢首图仍能占据关键路径；没有通过改变期限制造加速。失败场景分别注入首次草地图503、bitmap拒绝和真实15秒直载超时；独立恢复没有删掉。bitmap无超时/拒绝时的API调用耗时单独记录。

加载、解码、绘制和资源峰值详见 [summary.json](summary.json)。例如禁止缓存的桌面样本：逻辑加载累计12.09→8.40秒，同步drawImage累计5.9→3.6ms，调用次数均1427；WebKit固定回退的累计加载12.83→8.92秒，drawImage累计80→66ms，少14次兼容Canvas复制。并发任务累计时间不能与总耗时直接相减。HTMLImage直载不暴露独立解码CPU时间，报告提供响应结束到图片完成的区间及匹配数量（包含事件调度），没有把资源下载耗时假称为解码耗时。

## 画面与清理结果

桌面所有正常、慢响应、失败回退及串行回退的最终RGBA哈希一致；Far/Medium/Close各自也与基线一致。图层算法、素材字节、地图连接、单位、规则、视觉参数均未修改。取消中途加载后任务/驻留图片归零，重建可成功；LOD缓存命中不重复构建，dispose释放3张surface。

**WebKit原生冷加载像素门禁失败，不能称为验收通过。** 既有基线自身冷暖也不同；第二组原图比较中，基线与候选冷加载有3,038,945/5,829,054像素不同、最大通道差176，差异显著，不能当作容差噪声。基线自身冷暖有3,010,136像素不同，候选自身有3,013,518像素不同。原生暖缓存两者零差异；注入decode拒绝、固定走既有onload/Canvas回退时，冷暖及无缓存慢响应均零差异。观察与解码/回退时序有关，但未证明根因，未修改产品的解码选择来掩盖它。保持WebKit单任务兼容路径，候选应继续停留在验收阶段。

- [WebKit逐像素记录](webkit-pixels.json)、[原生冷基线](webkit-native-baseline-cold-cold.png)、[原生冷候选](webkit-native-candidate-cold-cold.png)、[固定兼容回退候选](webkit-canvas-candidate-cold-cold.png)。
- `webkit-native-initial.json`保留首次原生对照；当时“所有哈希相同”的断言失败，错误日志是 `webkit.log.gz`，不是成功报告。`webkit-native.json`补充原图和返回资源类型。
- `chromium.json`含全部场景、取消/重建、LOD及回退；`webkit-canvas.json`是明确注入decode拒绝的兼容回退夹具，不能冒充默认WebKit或真机结果。
- 性能主对照先于最终bitmap槽位保护；`provenance.json`保留两版编译模块哈希，`chromium-final.json` / `webkit-final.json`与最终槽位专项测试核对最后版本，不把前一版文件冒称最后版本。

## 检查与复现

两端typecheck通过。全量694项首次685通过、9失败；固定基线定向复查4项同样失败：UA002/UA003/UA003R1的既有main字节记录，以及缺少固定MP包的MP013本地集成夹具。没有改动这些旧记录或MP固定包。

其余5项冻结检查由本次获准修改的渲染字节触发。历史冻结清单保持不变，通过 `startup003-source-sha256.json` 对明确列出的7个渲染文件应用本轮检查值，其余路径仍执行原冻结值。覆盖后定向7/7通过。渲染、STARTUP-002兼容、回退、启动、像素/顺序及生命周期定向87/87通过；最终bitmap保护另做30/30专项，最后的字节门禁8/8通过。具体日志及最后复测结果见 [validation.json](validation.json)，没有宣称最后又跑过一次全量。

复现只绑定127.0.0.1，测试服务器和浏览器在finally关闭：

1. `npm ci --ignore-scripts --no-audit --no-fund`，`npm run build`。`node scripts/startup003/build-artifact.mjs baseline`创建独立的固定基线checkout并构建；将输出路径设置为 `STARTUP003_BASELINE`。
2. 设置 `PLAYWRIGHT_MODULE` 为可用的Playwright包路径，桌面可用 `STARTUP003_CHROMIUM`指定Edge/Chromium可执行文件；WebKit使用对应Playwright运行时及 `PLAYWRIGHT_BROWSERS_PATH`。
3. `node scripts/startup003/browser.mjs chromium <新输出路径>`；WebKit同理。不要覆盖已归档结果。`STARTUP003_SCENARIOS=uncached-slow`选择无缓存慢响应；`STARTUP003_LABELS=baseline,candidate`选择比较对象；`STARTUP003_SKIP_LOD=1`仅用于补充复测，常规全流程不要设置。
4. `STARTUP003_DECODE_CANVAS=1`是**仅测试进程的decode拒绝注入**，用于兼容回退对照；产品不读取此环境变量。取消设置后再测原生WebKit。
5. `node scripts/startup003/summarize.mjs`生成分类摘要；`compare-webkit.py`用Pillow/numpy重算PNG差异。最后代码提交后，`node scripts/startup003/build-artifact.mjs candidate`生成带完整源码SHA的本地ZIP及逐文件SHA256清单。

`provenance.json`核对未改动的范围；MP-015证据、固定包相关脚本、main、联机查询、素材、Core、地图与规则保留。构建交付记录及完整提交SHA见 `delivery.json`。
