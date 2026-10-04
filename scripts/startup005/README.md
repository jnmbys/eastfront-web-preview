# STARTUP-005 本地复跑

本脚本只使用临时 loopback HTTP 服务，不启动认证、隧道或联机后端。原004观察器及素材不变。所需运行时为 Node、Playwright、Edge 154 和 WebKit 26.5（本机 Playwright webkit-2336）。这不是华为设备模拟器。

从交付分支读取测试脚本；使用最终包解压出的目录作为 `browser.mjs` 第一参数，输出到新的目录，避免覆盖任何既有证据。`dist` 在本次交付时是源码 `380047b5dccd9cc247ac50d4fb3d81a2336df394` 的最终包字节。若重建，必须在该源码提交的独立工作区构建，不能用交付 HEAD 的 build 标识冒充原包。

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/jinyibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:STARTUP003_CHROMIUM='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/jinyibo/eastfront/startup-003-load-pipeline/.startup003/webkit'
node scripts/startup005/audit-input.mjs .startup005/replay-input
node scripts/startup005/browser.mjs ../startup-004-device-acceptance/.startup004/candidate .startup005/replay-baseline-chromium
node scripts/startup005/browser.mjs ../startup-004-device-acceptance/.startup004/candidate .startup005/replay-baseline-webkit webkit
node scripts/startup005/browser.mjs dist .startup005/replay-candidate-chromium
node scripts/startup005/browser.mjs dist .startup005/replay-candidate-webkit webkit
node scripts/startup003r1/native-smoke.mjs .startup005/replay-native.json
node scripts/startup005/diagnostic-export.mjs .startup005/replay-diagnostic
node scripts/startup005/verify-results.mjs .startup005/reverified-delivery.json
```

最后一条重新校验已交付的结果、逐文件清单及历史像素参考；新运行结果由各自脚本检查完成状态、近景挂载和像素。`native-smoke` 自行对比原生 WebKit 历史参考。`browser` 的新像素可与已交付 `verified-results.json` 对比。两种模式均使用新 context；全地图检查内页1302×607、DPR2.125。不能把时间数据当作设备或严格的性能对照。

针对修改的回归命令（源码构建后运行）：

```powershell
node --test tests/camera-interaction.test.mjs tests/perf003-terrain.test.mjs tests/startup-progress.test.mjs tests/startup002-diagnostics.test.mjs tests/startup005-diagnosis.test.mjs
node --test tests/safari-terrain-loading.test.mjs tests/startup003-pipeline.test.mjs tests/ui009r1-interaction.test.mjs
npm.cmd run typecheck
```

审计输入脚本检查原包和回执，不改旧文件。最终包构建脚本要求已提交源码、无已跟踪改动；创建ZIP/清单后拒绝覆盖同名ZIP。候选清单记录源码提交，后续报告和复核脚本修正位于交付提交，不改变包内字节。

`browser.mjs` 和 `diagnostic-export.mjs` 的 `lifecycle.json` 保存本次 PID、监听地址/端口、关闭状态；验证结束关闭浏览器和服务器。异常时不重新加载被测页面。没有自动连接设备或开启公网的功能。
