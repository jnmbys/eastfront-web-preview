# SUPPLY-CI-017

**容器验收通过；隔离服务更新未获批准、未部署。** Render 工作区实时读取待用户确认，因此当前配置和 013 镜像保留情况仍未实时核实。不能将本结果写成生产已完成或 Render 已通过。

## 版本与执行证据

- 分支：supply-ci-017；干净基线/受测源码：`813b4072568352e95d0726fe5fe04060c889c554`。
- 通过的 Actions：[36728592646](https://github.com/jnmbys/eastfront-web-preview/actions/runs/36728592646)，验收驱动 SHA：`9034ac2617520a9c749cf0330f64b0395c29e0bf`。
- 实际受测镜像 ID：`sha256:cc5675d240625a956db4c02fab219c57c0e85bd368004fe4db67f81e421d53e3`；未推送镜像仓库，RepoDigests 为空；不提供可拉取镜像的虚假承诺。
- 仓库根构建上下文，原 015 Dockerfile；SHA256：`f3dfd04c5a687e17849e375de672874712df087cecb50b9a9e557f9656f4b0b1`。源码 checkout 前后未改动，Docker build --pull；基础镜像摘要及固定 numpy/scipy 安装日志均在 build.log。
- GitHub ubuntu-24.04 / amd64，cgroup v2。CPU `50000 100000`，memory.max=536870912，memory.swap.max=0，pids=128。构建过程使用 runner 正常资源，**运行与验收容器**限 0.5 CPU/512 MiB。
- 已注册工作流 `.github/workflows/mp005b-verification.yml` 仅在本分支替换为手动验收；触发仅 workflow_dispatch，job 另限制 ref=supply-ci-017；contents:read、无凭据持久化、无部署/镜像发布/服务更改步骤。未改 main/source-main。现存其他工作流 push 分支不包含 017。

## 结果

| 项目 | 实测 |
| --- | --- |
| 构建 / 冷启动 ready | 26.445s / 2.829s |
| 默认服务入口与资源 | /?supply=experiment、startupShell.js、main.js、styles.css、app/experimental/supplyClient.js 均 200 |
| 四个独立会话 | 建局 HTTP 0.844–0.959s；第 5 席位拒绝；版本锁定 422 |
| 代表性配送 | checkpoint-66 → 75，共 9 个真实 HTTP 动作；全部与既有记录 hash 一致、库存审计通过；最后 settled=true |
| 动作事务 / HTTP 最大值 | 1.967978s / 1.978926s；原 3 秒预算不变 |
| 会话隔离 | 其余三会话完整 state hash 不变 |
| 忙碌拒绝 | HTTP 503，0.001104s，未提交 |
| 超时回滚 | 在真实动作执行后的 projection 注入到原 deadline+0.03s 的延迟；503，HTTP 3.047062s；Core/RNG/库存/seen/journal/receipt/memory/viewer/seconds 全部不变 |
| 超时后恢复 | 后续 query 成功 200 |
| 服务启动 cgroup 峰值 | 124129280 bytes / 118.38 MiB |
| 四个填充会话峰值 | 160702464 bytes / 153.26 MiB |
| 含验收进程最终峰值 | 197230592 bytes / 188.09 MiB |
| 验收退出 / OOM | exit 0 / OOMKilled=false |

内存是 **cgroup memory.peak，不是单进程 RSS**。服务启动口径包含默认 service.py、预热求解进程及后代和短暂 docker exec 读取，HTTP 客户端在宿主；只测启动/静态资源，不宣称为满负载服务峰值。配送容器口径包含 HTTP 服务、同进程验收线程/客户端、四会话、检查点与断言深拷贝、求解进程及 Node 投影；不能把约 188 MiB 当成纯服务 RSS。CPU throttling、服务 memory.events（oom/oom_kill=0）和各容器 inspect 原样保存。目标容器未采集 memory.events，OOM 结论来自 Docker OOMKilled=false、exit 0 及完整验收完成。

超时 HTTP 返回约 3.047s 包含 deadline 检查前注入的 0.03s 以及 HTTP/调度开销，**不是把事务预算改成 3.047s**；该事务没有提交。回滚比较仅排除 HTTP 到达时更新的 touched 空闲时间戳。

默认服务验收时一直运行且 OOMKilled=false；测试调用 `docker stop --time 10` 后退出 **137**，说明清理阶段需 SIGKILL，不能写成优雅退出 0。它不是 OOM（inspect false，memory.events 全零）。本轮未修改停机实现；发布可能中断在途请求/丢失内存会话，方案已明确。两个本次命名容器均由脚本清理。

## 失败记录、边界与恢复

首轮 [36728280920](https://github.com/jnmbys/eastfront-web-preview/actions/runs/36728280920) 已成功构建/启动，但验收脚本误写 `/experimental/supplyClient.js` 导致 404。改为实际构建路径 `/app/experimental/supplyClient.js` 后重跑通过；首轮报告与失败日志一并入 Git。没有修改 016、规则、参数、RNG、3 秒预算、015 Dockerfile 或 runtime。

复用 012 runner/HTTP 检查结构与 015 协议/合法检查点；私有验收进程内注入，不提供公网注入接口，没有重演 58 单位部署或整局。主体浏览器结果沿用 016，本轮无新的浏览器/Render/真实平板通过声明。PROJECT_STATE、WORKER_PROTOCOL、适用 AGENTS.md 在已检出工作区未找到；未重建治理文件，使用 CONTRACT015 和本任务状态。

所有 Actions 报告、日志、资源指标、镜像 metadata 与运行 identity 已下载至 evidence/run-* 并纳入 Git，SHA256.json 覆盖下载文件；不依赖 7 天临时 artifact。复验：在此分支 Actions 的手动入口再次运行，仅会构建固定 016 并执行相同限额验收。GitHub runner 镜像随 runner 销毁；本地无需安装 Docker。

## 更新审批与剩余项

完整差异、固定源码、启动环境、平台重建复验与回滚流程见 PREVIEW_PLAN017.md。目标唯一为 eastfront-supply-sandbox / srv-dathekek1f9s7389ksvg，原 0.5 CPU/512 MiB、单实例、自动部署与 PR 预览保持关闭。

013 历史成功 deploy=dep-dauattnavr4c738ergg0，源码 aca1f4b9801ab7b7c7073ac7973bb028cd6df435。当前工具没有选定工作区；已请求用户确认 My Workspace（tea-daos1iugekts73erk8j0）。**在确认后须只读核实当前配置及该部署/镜像仍可用于回滚；当前不能宣称其可用性已验证。** 镜像不可用时暂停更新，不把源码重建冒称原镜像回滚。等待本次隔离服务更新批准，不部署、不创建 PR、不新增付费资源、不触碰生产。
