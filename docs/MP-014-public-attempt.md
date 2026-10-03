# MP-014：一次临时隧道桌面预检，因控制工具阻塞关闭

日期：2026-10-03。基线 `b3c8751de5a2319c9af4acd280c3dce4c5c8d0e7`；独立分支 `mp-014-public-preflight`。本轮按用户后续授权调整顺序：先通过临时隧道供桌面浏览器预检，不安装 localhost 证书信任。

## 结果

**公网匿名检查通过，真实桌面浏览器验收未完成，入口已关闭。没有华为记录或通过结论。**

固定包、认证边界、MP014 清单核验通过后，在 `LAPTOP-G2NEE96G` 原电脑执行 `pwsh -NoProfile -File scripts/mp014/start.ps1 -PublicTunnel`，仅启动一次。复用 cloudflared 2026.9.3，SHA256 `f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2`。唯一转发目标是 `http://127.0.0.1:4181`。本人在本机窗口输入口令；没有将口令、cookie 或 token 放进聊天、命令行或证据。

[匿名探测原件](../evidence/mp-014-public/anonymous-probes.json)：11 项均通过。Node HTTPS 使用默认证书校验，每次新建 TLS 连接，证书为 trycloudflare.com、WE1 签发，有效期至 2026-11-05；TLS 授权检查通过。登录表单 200、四条受保护 HTTP 路径 303 且重定向到原登录页；六条 WS 路径使用合法 16 字节 key，均拒绝为 403。只记录状态、时间、路径、关联 ID、CF-Ray 和公开证书元数据，没有 cookie 或载荷。

## 桌面预检的实际阻塞

内置真实浏览器导航、随后查询该标签页分别遇到控制连接超时。[原边界元数据](../evidence/mp-014-public/boundary-metadata.json) 确认请求正常到达登录表单并返回 200。归档时另发现 08:22:53.879 UTC 到达的一次正常登录 POST 被接受（login-success、303），但没有后续 authorized-upstream HTTP/WS 记录。保留这项服务器侧部分证据，不据此认定浏览器自动 cookie 或完整流程通过；浏览器控制超时也不能当作网站 500 或证书异常。

随后使用 [电脑操作技能](C:/Users/jinyibo/.codex/plugins/cache/openai-bundled/computer-use/26.930.21537/skills/computer-use/SKILL.md) 打开本机现有 Chrome。工具在读取新标签页时明确停止：无法足够可靠地确定 Windows 浏览器当前 URL 以执行安全策略，并要求结束本轮电脑操作。没有绕过这一控制限制、继续输入口令、手工注入 cookie，或关闭证书验证。

因此浏览器正常登录全过程、自动 cookie、对照启动、前台五秒、移动、JSON 下载和文本备份均**未验收**；一次登录 POST 成功单列为部分证据。这不是地图故障复现，也不是用户输入错误。本轮没有把实际入口交付为华为可用链接，没有安排平板盲测或更换域名重试。

## 关闭状态

工具停止后立即执行原 MP014 `stop.ps1 -FailedValidation`。见 [独立关闭证据](../evidence/mp-014-public/closure.json)：

- 隧道、认证/覆盖层、原夹具进程退出已验证。
- 本地 4180、4181、4184 无监听，状态 CLOSED。
- 公网探测取得 HTTP 502，状态 HTTP_UNAVAILABLE；在上述本地条件也满足后，整体 VERIFIED_AT_PROBE。只表示该次探测不可用，不代表永久失效或 DNS 已删除；本轮没有把 UNKNOWN 算作通过。

本机口令启动窗口也按已确认的 PID、启动时间和脚本身份关闭。浏览器工具已停止，未再尝试操作浏览器 UI。

## 保存与范围

[执行摘要](../evidence/mp-014-public/attempt.json)、[校验清单](../evidence/mp-014-public/checksums.json)。新增匿名探测工具 `scripts/mp014-public/probe-anonymous.mjs` 会在任一状态不符、证书或传输错误时立即调用 MP014 关闭脚本，并保存失败证据；禁止用来在本轮重开入口。

原 MP013、MP014 历史证据和修订清单保持原样。固定客户端、Core、协议、FOW、认证及生产服务没有修改，没有合并或新增付费资源。没有重跑无关全量测试，三项历史冻结红项仍保留。

后续仍需在可可靠操作的真实桌面浏览器完成正常登录和导出流程，再进行华为单次诊断。本轮一次授权已使用并关闭，不能自动重开或据无记录代报真机通过。
