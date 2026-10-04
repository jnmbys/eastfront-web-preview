# STARTUP-006 华为近景复验记录

当前状态：**本地准备阶段，尚未进行华为采样。A阈值可达和B真实近景内容均未作真机判定。** 公网须在用户明确开始之后开放；本地桌面结果不代替华为。

固定源码 `380047b5dccd9cc247ac50d4fb3d81a2336df394`，固定交付 `a17478d2848235c0128d4875fc6d86725169d4a2`。直接解压005原ZIP，SHA256 `e9b9ffb31dfb50081f1f89eb968f008759c61c8e1cc7401d0f30a7d24ba48ab8`。CRC及381个文件长度/hash通过，候选联机地址为空；见 [package-verification.json](package-verification.json)。没有构建、修改素材或混入其他候选。

默认模式仅一次。以开始按钮的单机启动为事件时钟起点，分别保留首个地图DOM、控件可用、初始视口/DPR/面板/相机、近景阈值指标、close完成事件及实际挂载画布的PNG。close标签、requestedLod与complete均不能单独代替真实内容核验。

采样最多五分钟前台观察，采用五分钟墙钟截止，不因隐藏页面延长。约15秒采样一次有界计数；预算内结果与结束通信分开。停顿只能报告在相邻快照之间未观察到推进；不能由此认定死锁，也不能把所有等待叫作网络等待。

桌面预检原失败保留在 `preflight/failure.json`：下载按钮位于折叠区域，校验脚本未展开导致超时。正常默认加载和截止保存已完成；该失败不代表候选加载失败。修正脚本操作后使用新目录复验。

最终本地预检 [preflight-r1/local-desktop.json](preflight-r1/local-desktop.json) 已通过：381个HTTP字节校验、匿名/授权边界、默认模式真实close画布、JSON和PNG回执及下载、1.5秒本地截止夹具、合成异常立即保存。截止及异常后都已移除候选iframe，没有重试加载。默认记录的实际视口1302×607、DPR2.125，收起面板后2.7倍，阈值指标98.804；近景PNG RGBA与005 Chromium参考相同，见 [pixels.json](preflight-r1/pixels.json)。这些均为桌面记录，不是华为通过结论。

预检服务已关闭并核验无残留监听，见 [preparation-closure.json](preparation-closure.json)；随后启动待命实例，只绑定4300/4302。最终外层脚本清单、待命PID及公网未授权状态保存在 [prepared.json](prepared.json)。最后一项服务器更改仅补充并发领取时的二次检查，重启后再次验证未获用户明确开始时 `/open` 返回409；没有创建隧道。

005及004的原包、源码和原始证据保持不变。未合并、未部署、未更新生产或新增付费资源。后续真实观察、关闭状态和未完成项将写入本报告；复跑及关闭流程见 [scripts/startup006/README.md](../../scripts/startup006/README.md)。
