# SUPPLY-DEPLOY-008 — BLOCKED / 发布准备交接

日期：2026-09-29（Asia/Shanghai）。本轮不是完成发布验收。

## 固定候选与结论

- 仓库 jnmbys/eastfront-web-preview；任务分支 supply-deploy-008（此报告所在远端提交是交接SHA）。
- 运行源码固定 SUPPLY-UX-007：**3aeb7a253dba12fceeaa3906d5162d4a4bb33e7e**，tree d8c700d7f5b4b2d4dfa37a08a8438f591101d15c。
- 复用 experiments/supply-exp-005/Dockerfile，blob d6b31d347762298e11472023a1e622ac8aac149b；本轮未修改Dockerfile、应用、规则、求解器或3秒预算。
- 管理分支远端仍为 c7531c70fab4b7c7402cd2f7d927c2134adee228，与UX007读取的 PROJECT_STATE / WORKER_PROTOCOL 相同；不重复审计，不更新Leader状态。
- 当前无 docker/dockerd/podman/nerdctl/buildctl，无 Docker/Podman 套接字，无已配置 DOCKER_HOST/CONTEXT/TLS 环境。机器可运行普通Python/Node，但这不构成容器能力。
- **镜像未构建、未启动；镜像ID不存在。最低能运行规格、峰值内存与限资源耗时均未确定。** 没有以静态检查或旧本地测量替代这些验收。
- 可用接口中无Render账户读取工具；没有已授权可用账户连接。未访问账单/生产配置，未尝试获取或要求聊天明文凭据，未申请开通服务。

新证据：evidence/deploy008/CAPABILITY.json。UX007已通过的浏览器与接缝记录只作历史证据，本轮未重复运行或计入008通过项。旧RSS为null，不改成0。

## 解除阻塞所需执行环境（交给有能力的Worker，不要求平板用户安装）

需要一个既有、获准的Linux x86_64执行器：Docker Engine/兼容容器运行时实际可用，具备构建与启动权限（可rootless），支持cgroup v2的CPU、内存、swap和进程限制；可从官方镜像仓库、npm、PyPI取得构建依赖。可用至少2 CPU / 4GB宿主内存以给限额测试和浏览器留余量；磁盘足够容纳两种基础镜像、依赖及构建缓存，运行前记录实际空闲容量。具备HTTP测试客户端及获准的Chromium/Playwright。

宿主规格是**测试环境条件**，不是应用最低配置。不可把生产机器临时变成压测机；不用生产密钥、数据库、WSS或共享资源卷。不要在当前环境只装一个Docker CLI就声称已具备daemon/容器权限。

以下命令为待执行指令，**本轮未执行**：

```sh
# 在已固定到上述源码SHA的独立检出里
cd experiments/supply-exp-005
docker build --pull --progress=plain -t eastfront-supply:ux007 .
docker image inspect eastfront-supply:ux007
# 一次只测一个规格；先测1 CPU/2GB，再测0.5 CPU/512MB、0.1 CPU/512MB
# 不挂载任何生产目录；HTTP仅绑定测试机loopback
docker run -d --name ef-supply-008 --cpus=1 --memory=2g --memory-swap=2g --pids-limit=128 \
  -p 127.0.0.1:8765:10000 \
  -e PUBLIC_ORIGIN=http://127.0.0.1:8765 -e COOKIE_SECURE=0 \
  eastfront-supply:ux007
curl --fail http://127.0.0.1:8765/healthz
# 测量结束、容器仍运行时记录整个cgroup峰值，覆盖Python/求解子进程/Node
docker exec ef-supply-008 cat /sys/fs/cgroup/memory.peak
docker inspect ef-supply-008
# 只停止并删除此实验容器；日志先保存
docker rm -f ef-supply-008
```

每一规格记录镜像ID、基础镜像digest、宿主CPU/内核/架构、Docker/cgroup版本、实际CPU/memory/swap限制、启动到健康耗时、memory.current采样与memory.peak、OOM/退出码。仅docker stats低频采样不够证明峰值。限CPU是配额约束，不是目标云机性能仿真。

测试矩阵：每规格3次全新容器启动；4个独立cookie jar同时保有会话；三个片段分别重置后跑3次真实结算，记录单次耗时/范围/超时率。restore要包含修路、两轮配送及债务恢复，不能只用健康检查。串行执行与并发到达分开统计；忙碌503是拒绝服务本次操作，不当作求解成功。

维持3秒整次预算：验证busy不提交、强制极短预算超时后revision/资源/账本不变、重复ID不重复扣费、2会话彼此不变、重置仅作用自己的会话；收集真实Node/Core/Python结算证据，禁止开启玩家全知回放来方便验证。需要内部状态核验时使用隔离测试进程，不能加入公网调试接口。

“最低配置”只在已测试的矩阵范围内给出：所有短片段结算和事务/隔离测试通过、无OOM，记录可见内存余量与所有超时。若最低档失败而高档通过，保留失败日志；不改预算、缩场景或改变配送规则求通过。如果所有档都失败，停止推荐配置，交付原因。任何本地结果都不标为Render实测。

## 具体但尚未获准执行的发布方案

| 项目 | 方案 |
|---|---|
| 运行源码 | 3aeb7a253dba12fceeaa3906d5162d4a4bb33e7e；镜像构建后另记不可变image digest，目前没有 |
| 平台 | Render，单独Docker Web Service，候选名称 eastfront-supply-ux007 |
| 待测/预算方案 | **1c-2g：1 CPU / 2GB，单实例**；这是保留余量的待测方案，不是已证实可运行或最低规格 |
| 公开计算费依据 | 官方定价页搜索结果在2026-09-29返回 $25/month、1 CPU、2GB；不是用户实际账单报价，不含税、构建/带宽超额或其他工作区费用 |
| 额度隔离 | 独立实验工作区，先以账户只读核实可建性、计费/构建/带宽隔离；未核实前不得创建服务或使用生产工作区免费额度 |
| 网络与状态 | 同源HTTPS、PUBLIC_ORIGIN=实际实验域名，COOKIE_SECURE=1、PORT=10000；个人热座会话、4席、30分钟闲置、单进程串行求解；不接生产WSS/数据库/密钥 |
| 发布控制 | 关闭自动部署/PR预览/扩容；只手动发布获准SHA/镜像；不调用Hook，不改main/source-main |
| 撤销 | 若以后首次发布失败，停止并删除仅该实验服务；后续版本失败则切回其已验镜像；不触及生产。导出的本方反馈另存，会话重启不保留。停止/删除后的费用以平台账单为准，不承诺退款 |

官方依据（2026-09-29复核）：
- https://render.com/pricing — 1c-2g / 1CPU / 2GB / $25月度计算费，动态全文未完整呈现表格，使用官方页面搜索结果；正式开通时再次核对结算页。
- https://render.com/docs/compute-plans — 当前规格/计划ID；沿用UX007同日官方资料。
- https://render.com/docs/free — 同一工作区共享750免费实例小时，耗尽暂停该工作区免费Web服务。因此“独立服务”本身不证明与生产额度隔离。

## 验收状态与下一步

| 验收项 | 本轮状态 |
|---|---|
| 容器能力确认 | 已完成；能力缺失，原始结果已保存 |
| 镜像构建/启动 | BLOCKED，未执行 |
| 冷启动/4会话/3片段峰值与限资源耗时 | BLOCKED，未测 |
| 容器内忙碌/超时回滚/隔离/重置 | BLOCKED；UX007既有本地通过不能替代 |
| 账户/生产额度隔离 | 无可用只读接口，未核查 |
| 云端性能、HTTPS、华为、真人易用性 | 未执行；本轮也未授权部署 |
| 规则/运行候选 | 保留原SHA不变，无新增规则或数值 |

下一步：把此固定候选交给具备上述容器能力的执行器完成资源矩阵；取得最低档证据并核实账户额度后，再向Leader提交真实可批准的上线规格。当前不向用户发试玩链接、不要求下载/安装、不创建任何付费资源。
