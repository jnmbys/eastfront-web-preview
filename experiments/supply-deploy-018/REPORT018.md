# SUPPLY-DEPLOY-018 — 预检已执行，更新尚未开始

## 当前进展：人工控制台接手（2026-10-01）

用户已改为人工操作控制台、工具核验；此前恢复浏览器连接的要求被此流程取代，不再重试浏览器或要求重新登录/批准。用户截图与实时 MCP 读取核对了原分支、rootDir、Dockerfile/context 及空 Docker Command；尚无配置保存或新部署。

013 仍是最新成功且 Live 的部署。官方 pricing 保留规则最低为最近 5 个构建，结合当前部署历史，推断一次新构建不会使 013 超出保留范围。这是基于平台规则的可用性判断，不是实际回滚演练或专用 artifact-availability API 结果；当前 Live 条目未显示 Rollback，旧成功条目显示可用。新部署后须再次核对 013 的回滚入口。证据见 evidence/manual-console-preflight.json。原批准不变，接下来逐项修改并回读，最终仅部署固定 016 SHA。

用户已批准执行 583d179ffabd146d18d1d40577516bb012a09387 中 PREVIEW_PLAN017.md，且确认工作区 tea-daos1iugekts73erk8j0。批准固定部署源码 813b4072568352e95d0726fe5fe04060c889c554；同范围无需再次请求部署批准。本任务仅操作 eastfront-supply-sandbox / srv-dathekek1f9s7389ksvg。

2026-10-01（Asia/Shanghai）实时预检结果：

- Render MCP 确认服务身份、工作区、仓库与方案一致。当前分支 supply-campaign-012，rootDir=experiments/supply-exp-005；Dockerfile=./Dockerfile，context=.，command override 为空。
- 仍为 Singapore / 0.5 CPU / 512 MiB / 单实例；autoDeploy=no、trigger=off、PR previews=off。已暴露的配置未发现范围外差异。环境变量值未读取，不宣称全部配置已核实。
- 013 deploy dep-dauattnavr4c738ergg0 仍为最新且 live，源码 aca1f4b9801ab7b7c7073ac7973bb028cd6df435。已确认运行状态，但尚未验证控制台回滚操作可用性或镜像保留保证。
- 现有 https://eastfront-supply-sandbox.onrender.com/healthz 返回 200、ready=true。这只是 013 的健康证据，不是 018 上线通过。

## 阻塞与未执行项

控制台标签页跳转 Render 登录页；Edge 连接失败，内置浏览器页面创建/绑定/截图先后超时。已读取故障恢复指引并尝试保留/重新连接标签页，仍不能交互。未获得截图，不编造 UI 验收。具体结果记录于 evidence/access-blocker.json。

现有 MCP 工具没有根目录、Dockerfile、分支修改或回滚操作；trigger_deploy 也没有固定 commit 参数。标准本地 Render CLI/API 认证不可用。因此不能通过一次无参数 trigger_deploy 实现获批更新，也不能用未核实的回滚条件冒险部署。

已请用户在内置浏览器登录 Render，控制台打开请求已提交（queued）。这是登录/连接阻塞，**不是请求重新批准部署**。尚无 Render 服务写入、新 deploy ID、018 镜像或线上验收；无需恢复 013，因为一直保持原版本。没有新增资源、修改环境、生产服务、main/source-main，也未重跑全量测试。

## 恢复后继续

1. 读取响应正常且已登录的控制台，核实环境变量、013 回滚入口/镜像可用性及最新服务配置；若不可用或发现范围外差异，按用户要求暂停说明。
2. 核实通过后直接执行原批准方案：改为仓库根、015 Dockerfile、supply-verify-016，手动指定完整源码 813b4072568352e95d0726fe5fe04060c889c554；保持规格、单实例及自动部署关闭。
3. 记录新 deploy ID、平台新构建镜像/日志；执行方案中的 HTTPS、浏览器及实际新镜像内定向验收。失败恢复 013，不放宽预算或增加资源。
4. 成功后交付实际实验入口 https://eastfront-supply-sandbox.onrender.com/?supply=experiment。**此刻尚不能把该路径标为 018 已上线试玩。**

预检原始响应、健康结果、访问阻塞、任务状态均随本独立分支保存。017 的容器通过证据仍有效，但不替代平台新镜像复验。

## 用户登录后续验（取代前述待登录状态）

用户确认已在内置浏览器登录。标签清单出现目标服务控制台标题和完整目标 URL，绑定 tab 3 成功；登录阻塞已解除。随后 DOM 快照、截图、文档明确支持的 CDP DOM.getDocument 以及同一浏览器新建目标控制台标签均超时。没有获得页面内容、回滚按钮或截图证据，不据标题猜测操作位置。

重新通过 Render MCP 读取，服务仍是原分支/根目录，013 deploy 仍 live；没有执行任何服务写入或新部署。当前阻塞是浏览器控制连接失效，不再要求重复登录，也不要求重复批准。需要恢复响应正常的浏览器控制连接后继续原方案。证据见 access-after-login.json、service-after-login.json、rollback-after-login.json。

## 再次继续后的连接检查

用户重开后继续。内置浏览器标签清单为空，新标签创建成功，但导航到目标 Render 服务仍在 20 秒后超时。未执行服务写入；不再重复同一失败操作。已询问是否改用 Edge，仅改变浏览器通道，不改变已批准部署范围；选择前未切换浏览器。证据见 access-resume.json。

用户随后明确同意改用 Edge。调用 Edge 新建目标控制台标签返回 nodeRepl.fetch request failed（21.65 秒），没有取得可操作的页面。两条浏览器控制通道均不可用；停止重复尝试，继续前须恢复浏览器工具连接，不能再把阻塞误报为未登录或未批准。没有 Render 写入、新部署或回滚。

## Root / Dockerfile saved by user

Render readback confirms empty rootDir, experiments/supply-integrate-015/Dockerfile, context dot and empty command. Branch still supply-campaign-012. No new deployment; 013 remains live. Resource size, one instance and auto-deploy off unchanged. Next: branch configuration. See evidence/manual-config-step1.json.

## Branch saved by user

Render readback confirms supply-verify-016 and all approved build settings. 013 remains live; no new deployment. Environment values still require manual verification before fixed-SHA deploy. See evidence/manual-config-step2.json.

## Environment verified before deployment

User-provided Dashboard screenshot confirms all seven required environment values and ENABLE_CAMPAIGN=1. No environment edits. Screenshot and machine-readable transcription are saved in evidence/environment-verified-user.png and environment-verification.json. Build configuration and environment checks are complete; fixed-SHA deployment has not started. Rollback retention remains a policy-based inference, not an executed rollback test.

## Live deployment; acceptance still incomplete

User triggered a specific commit deployment. Render confirms deploy dep-dav1e1npn0mc739lk1ng is live at 2026-10-01T08:18:26.325882Z, source 813b4072568352e95d0726fe5fe04060c889c554. Build logs confirm checkout of that full SHA. Same service, 0.5 CPU / 512 MiB, one instance, auto-deploy off. Old 013 dep-dauattnavr4c738ergg0 is now deactivated; rollback has not been executed and its Dashboard rollback control still needs visual confirmation.

Render built a new image, not the CI-tested image. Logs save Node and Python base digests and successful layer export/push; they do not expose a final image ID/digest, which remains unverified. Runtime health source aca1f4b... is the frozen rules source, not the deployed application SHA.

External HTTPS checks passed: experiment HTML and four JS/CSS resources, versioned health, new/old creation, Secure/HttpOnly/SameSite=Strict cookies, mode-lock Chinese rejection, a legal initial deployment, old-session revision/mode isolation, both viewer switches, Origin rejection. All test sessions were closed. This is not browser evidence or a private container test. Deployment action HTTP seconds: 1.676323699999557; server transaction seconds: 1.2796260670293123. No checkpoint injection or runtime code changes.

Platform metrics for new instance sq6dm report startup sampled memory maximum 122580990 bytes (~116.9 MiB), with 0.5 CPU limit and ~512 MiB limit. After-smoke samples max 118865920 bytes. These are platform instance samples, not process RSS, cgroup peak, or a guarantee of no transient peak/OOM. Sampled instance_count remains one; deployment overlap includes old-instance time series. App logs fetched through the check contain no error/OOM/failure message; exited-process/OOM counters are not exposed here.

Outstanding: user browser acceptance on new deployment; private actual-image representative delivery, four sessions, busy refusal, and 3-second rollback; process/harness memory and exit/OOM counters; 013 rollback-control confirmation. These are pending, not passed. No rollback has been required by the checks executed so far.
