# SUPPLY-CAMPAIGN-012：现有独立服务更新方案（未执行）

本轮不部署、不创建服务、不改生产。方案只针对已有 `srv-dathekek1f9s7389ksvg` / `eastfront-supply-sandbox`，不使用其他服务或生产 WSS/Secrets。既有规格0.5 CPU/512 MiB、单实例、Singapore，自动部署和PR预览保持关闭。

## 固定版本与启动

- 完整战役运行源码：`aca1f4b9801ab7b7c7073ac7973bb028cd6df435`，基线 `f85a533df467b79686e550e7f5fd65b5ade00e11`。
- CI驱动提交：`e71b9f66e5fa5cc494c2bd7bbaca277b8b4aa82a`，工作流明确检出上述运行源码，不把证据交付提交当成受测代码。
- 继续使用 `experiments/supply-exp-005` 根目录；Docker context `.`、Dockerfile `./Dockerfile`，原 Dockerfile 与依赖版本保持。Docker Command 留空，原 CMD 为 `python online.py`。不要使用单局全局状态的 `campaign-server.py`，也不要重复早期失败过的带引号命令包装。
- 原环境保留：`BIND_HOST=0.0.0.0`、`PORT=10000`、`COOKIE_SECURE=1`、`OPENBLAS_NUM_THREADS=1`、`WEB_CONCURRENCY=1`、`PYTHONUNBUFFERED=1`、`PUBLIC_ORIGIN=https://eastfront-supply-sandbox.onrender.com`。
- 唯一新增开关 `ENABLE_CAMPAIGN=1`。未设置或为0时仍默认旧三片段入口；设置1时默认完整战役，同时保留短片段选择。
- `/healthz` 健康检查、HTTPS同源、单进程、4会话、全局忙锁继续使用。无磁盘、数据库、外部结算依赖、环境组或生产配置导入。

## 最小更新步骤（须另行授权）

1. 记录现有独立服务当前成功部署及环境；告知试玩者导出反馈，更新会丢失所有内存对局。核对服务ID、规格、实例数、自动部署off；若规格/费用变化则停止，不升配。
2. 将该服务Git分支设为 `supply-campaign-012`，保存配置时选择不自动部署；新增开关采用“只保存”方式。不得按分支最新HEAD盲目发布。
3. 在同一服务手动 **Deploy a specific commit**，指定完整运行SHA `aca1f4b9801ab7b7c7073ac7973bb028cd6df435`。若操作界面不能固定此SHA，停止，不能退化成Deploy latest commit或调用Hook。
4. 核对部署元数据的实际commit、资源和入口；构建的Render镜像标识另行记录。CI镜像未推送registry；Render将重建镜像，基础镜像tag未冻结为digest，因此不得声称二者字节相同。
5. 在目标Render实例验收后才邀请平板试玩；只通过CI不代表Render已通过。

## 兼容与会话影响

- `prepare`、`isolation`、`restore` 的加载/重置和旧规则对照继续使用原初始化；既有 `?clip=...`入口保留。没有重跑旧三片段的全量动作，原009/Render证据仍只是旧版本证据；新候选本轮覆盖加载/重置兼容。
- 完整战役沿用Core胜负、全局实验配置A和原3秒事务预算。没有AI，每个浏览器是一局可切换两方的热座，不是双人联网房间/对抗身份鉴权。
- 完整战役最多1000个接受的操作；短片段仍150；每局6MiB序列化状态阈值保持。达到阈值需导出反馈并重置，**不保证任意玩家路径均可在上限内结束**。011原227步完整生命周期证据复用，不重跑。
- 30分钟不活动过期；cookie最大寿命仍30分钟，服务重启、更新、回滚丢失全部会话。反馈是简报，不是可恢复存档；不得承诺连续长局进度保全。
- 本轮仅API及脚本语法检查；新增完整战役/短片段切换的真实浏览器和华为触屏仍待验。下一次邀请用户前先提供真实界面截图与三步说明。

## Render验收门槛与故障处理

保持0.5 CPU/512 MiB、3秒，不自动升级或延长预算。记录实际cpu.max、memory.max、memory.peak、memory.events与实例ID。验证HTTPS/Secure cookie/Origin、启动、四独立会话、真实部署Action、代表性配送、忙碌拒绝、完整状态含RNG/账本的超时回滚、重置与过滤；明确HTTP墙钟和事务耗时不同。

研究检查点只能在私有测试进程使用，不给线上接口增加任意状态注入或全知回放。不得给玩家返回CI夹具、路径、完整Core或其他会话。若目标配送超3秒、OOM、隔离或回滚失败：记录失败，暂停本独立服务，不扩大费用；修复后再单独申请验证。

## 回滚及关闭

既有成功运行源码：`9cf0e5fb7fac27e16b2700559716b590e81957b7`；既有成功部署 `dep-dathfiuk1f9s7389ono0`（来源 `7f2778bc:evidence/supply-render-deploy/deployment.json`，执行前核对当前可用历史部署）。在**同一实验服务**的Deploys对该成功部署Rollback；删除或设0的 `ENABLE_CAMPAIGN`，保留原环境、原Docker CMD和同源域名。也可将分支恢复 `supply-render-candidate` 后手动固定原SHA重建。不要移动main/source-main或生产发布分支。

若不能立即回滚，Settings → Suspend Web Service 暂停本服务；关闭自动部署不等于停止运行或停止计费。已发生费用不撤销。本轮没有部署或费用变更；历史$7/月计算报价及共享工作区构建/带宽关系直接复用7f2778bc，未重新读取账单，不能声称工作区费用隔离。
