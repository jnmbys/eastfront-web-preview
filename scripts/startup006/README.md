# STARTUP-006 独立华为近景观察

只使用005原包：源码 `380047b5dccd9cc247ac50d4fb3d81a2336df394`，交付 `a17478d2848235c0128d4875fc6d86725169d4a2`。不运行构建、不修改候选字节。外层仅观察和保存，认证模块直接复用既有实现，未改认证或游戏协议。

1. `python scripts/startup006/prepare.py` 校验原ZIP、CRC、路径及381个条目后解压到全新 `.startup006/candidate`；存在则拒绝覆盖。再次核验使用 `node --input-type=module -e "import {verify} from './scripts/startup006/integrity.mjs'; console.log(verify())"`。不更改机器的脚本执行策略。
2. `node scripts/startup006/server.mjs` 仅启动本任务的 loopback 4300/4302。4301认证边界及隧道暂不启动。独立进程和目录不占用其他任务实例。
3. `local-check.mjs [新证据目录]` 使用已安装Playwright/Edge，逐一比对381个HTTP文件、匿名认证边界、正常默认加载、JSON/PNG回执与下载、短预算截止及合成异常。仅桌面夹具可使用 `localBudgetMs`，公网固定300000ms。原失败保留，新检查使用新目录。
4. 必须等用户明确说开始，才能 POST loopback 4302 `/authorize-public`。此前 `/open` 返回409，不创建隧道。随后请用户在本机4302页面输入本人保留的临时口令；不读取其他实例的口令或Cookie，不把口令写入命令、聊天或文件。
5. `node scripts/startup006/probe-public.mjs` 核验实际匿名HTTPS边界后，才提供实际设备入口。严格默认模式；`terrainLoad`参数被拒绝。公网 `/s006/claim` 只能成功一次，并在异步读取请求体后再次检查，避免并发重复启动。
6. 开始按钮被领取后启动五分钟墙钟上限，记录实际可见时间；后台隐藏也不会延长截止。每15秒现取有界005状态并保存JSON，最多40个快照。阈值指标、近景完成、实际画布分别展示。首次挂载完成的close画布自动导出PNG并校验服务器回执；也可手动保存当前景别。标签本身不能证明像素内容正确。
7. 出错或用户结束时导出当时诊断；到达预算时停止交互、取消采样并移除游戏iframe，保存截止快照。最后的通信/落盘不是继续观察；超预算快照显式标记且不用于A/B通过判断。服务器从领取起315秒强制关闭，额外15秒仅供结束保存。用户也必须遵守五分钟前台上限，主线程若完全阻塞，脚本无法保证当时导出；此前已落盘快照仍保留。
8. 设备最终JSON落盘后2.5秒自动关闭本任务服务器/隧道；超时或失败也不追加串行。`node scripts/startup006/close.mjs [新关闭证据路径]` 独立核验PID、监听及两条公网路径。超时、DNS/TLS错误、无响应均为UNKNOWN；502只说明探测时刻不可用。尚未开公网则记NOT_OPENED，不探测虚构地址。
9. `node scripts/startup006/analyze.mjs <原JSON> <新分析JSON>` 离线验证回执及PNG文件，分别给出A、B的证据状态和相邻同一工作ID的计数差。仍需人工检查真实PNG和用户画面反馈；计数停顿不证明死锁，yield未恢复不证明调度原因，checkpoint结合active=false才支持观察时暂停条件成立。

环境参数沿用005：`PLAYWRIGHT_MODULE` 指向本机Playwright模块，`STARTUP003_CHROMIUM` 指向Edge可执行文件。无需安装、升级或使用任何生产联机服务。
