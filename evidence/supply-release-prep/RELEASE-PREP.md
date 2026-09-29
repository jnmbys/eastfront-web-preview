# SUPPLY 独立服务发布准备（供最终批准，未部署）

核查日期：2026-09-29（Asia/Shanghai）。本轮仅核对已有CI证据、候选文件和官方文档；未运行Docker或重跑矩阵，未读取账户账单，未创建Render资源。准备文件保存于 supply-ci-009 的 evidence/supply-release-prep/，不触发009工作流。

## 1. 精确版本与证据

| 对象 | 固定标识 |
|---|---|
| 009证据交付提交 | `26f4f1910740c1714cc0a842d14db5014061a64f` |
| 实际执行的CI脚本提交 | `160dd3fe42c3d5a63002b6bc515f197efeffcf46` |
| 实际构建、运行的应用源码 | `9cf0e5fb7fac27e16b2700559716b590e81957b7` |
| Docker build context | `experiments/supply-exp-005` |
| Dockerfile | `experiments/supply-exp-005/Dockerfile`，Git blob `d6b31d347762298e11472023a1e622ac8aac149b` |
| online.py | Git blob `a138ddfe45d04429815b86fba236136645e667e9` |
| CI镜像ID | `sha256:f3ba29572848bcde5115c0509a61d7ec5ea8ca4ba745260047dbbe51e3efb839` |
| 受测报告Git blob | `e75953b86633c118cba33cc9dd6fa8192c182e91` |

运行：https://github.com/jnmbys/eastfront-web-preview/actions/runs/36501753309 。原始数据：`evidence/supply-ci-009/run-36501753309/report.json`。以上文件及报告已从固定远端SHA核实。构建22.53秒；CI最低通过档0.5CPU/512MiB，服务峰值199.67MiB，18次结算HTTP墙钟2.06–2.44秒。保留1CPU通过与0.1CPU失败的全部证据，3秒引擎事务预算不变。

CI镜像仅在临时runner上，未上传registry；该ID不是可拉取的镜像地址。拟采用Render从固定源码重建原Dockerfile，**并非部署同一镜像二进制**。原Dockerfile基础镜像用浮动tag，系统依赖也非完整锁定；即使源码相同，重建镜像ID可能变化。CI记录的基础镜像为：

- Node：`docker.io/library/node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`
- Python：`docker.io/library/python:3.12-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e`

不把这些digest说成Dockerfile已锁定。本轮不改Dockerfile。部署时记录Render实际digest、构建日志和deploy ID；有差异时仍需目标验收，不继承CI镜像通过结论。若要求逐字节同一镜像，当前材料不能满足，须另行批准构建、保存及复验不可变镜像。

## 2. 费用、账户读取缺口与生产关系

当前可用连接器无Render账户读取能力。未尝试获取凭据或探测登录会话；账户余额、付款方式、折扣、税、剩余额度、工作区归属均为**未核实**，不能给出账户实际应付总额。

官方公开价（美元，Web Service，不是Render Workflows）：

| 项目 | 拟用方案的公开计价 |
|---|---|
| 单实例0.5c-512mb／原Starter | $7/月，计算使用时间按秒折算 |
| 新Hobby工作区 | $0/月平台费，单成员 |
| 出站流量 | 新Hobby含5GB/月，超出$0.15/GB |
| 标准构建 | 新Hobby含500分钟/月，超出$5/1000分钟；采购单位/实际扣费以账单为准 |
| 本方案不选用 | 持久盘、数据库、自定义域名、独立IP、性能构建、日志外送，均不创建 |

因此，独立新Hobby、整月单实例、额度内、无税费/抵扣时为$7；这不是全包上限。准确账单=按时长计算费+实际构建/出站超额+适用工作区费用与税费−有效抵扣。不自行换算人民币、不假设存在赠金。旧Hobby/组织合同可能不同，不能用100GB旧额度套用新方案。

同一工作区内各服务共享出站及构建额度；付费计算实例不是这些共享额度的豁免。另建项目/服务不等于隔离账单。拟用**与生产不同的独立Hobby工作区**，不加入生产组织的合并额度、不移动任何生产资源。官方资料对“可创建额外工作区”与套餐工作区数量有不同层次描述，账户资格必须实查，不能承诺额外工作区一定可用且免费。若账户不允许此独立方案，停在批准前，不改生产套餐、不升级、不假设隔离已成立。即使工作区不同，同付款主体的欠费等账户风险也不能宣称完全隔绝。

用户只需查看一个页面：打开 https://dashboard.render.com/ ，选择**拟用于实验的工作区 → Billing**。若只有生产工作区，就查看该页并说明“尚无实验工作区”；不要新建服务或改套餐。需要的字段：

1. 顶部工作区名称、Plan（含legacy标记、组织归属，如显示）。
2. Monthly Included Usage：出站流量和pipeline minutes的已用/总量、计费周期。
3. 当前账期费用明细/预计账单：计算项目与服务名称（是否包含 `eastfront-server` 等生产项目）、超额单价，如页面显示。
4. Credits/余额及到期日、付款方式是否已配置、税费/折扣（仅有无和金额）。
5. 构建消费上限/额度共享说明、额外工作区资格若该页显示；不显示即记录未知，不要求为了补齐再找多个页面。

可提供此页截图并遮住卡号、地址、邮箱等；不需要Token或密码。Billing可能不显示未来未创建服务的报价或组织共享条款，因此这些仍在最终创建表单/账户权限核对时确认，不能由截图缺失推定为零费用或已隔离。

## 3. 已备妥配置（尚未提交给Render）

完整字段见 `service-config.json`，它是审核用配置清单，不是会自动创建资源的Blueprint。

- 独立Docker Web Service `eastfront-supply-sandbox`，拟选Singapore；实际名称/区域可用性待账户确认。单实例0.5CPU/512MB，固定一个Python入口进程，不使用gunicorn多worker或横向扩容。
- Git仓库 `jnmbys/eastfront-web-preview`；发布分支拟为 `supply-render-candidate`，**批准后**才创建并固定到受测源码9cf0e5fb…；不得绑定main/source-main或持续变化的证据分支。
- Root Directory与build context均为 `experiments/supply-exp-005`，Dockerfile Path为 `./Dockerfile`（相对于root）。保留原Dockerfile、真实Python/SciPy求解与Node Core。
- Auto-Deploy=Off；PR previews=Off；不建立Blueprint同步、Hook或自动扩容，不采用After CI Checks Pass绕过低档红色结果。
- 环境只设 `BIND_HOST=0.0.0.0`、`PORT=10000`、`COOKIE_SECURE=1`、`OPENBLAS_NUM_THREADS=1`、`WEB_CONCURRENCY=1`、`PYTHONUNBUFFERED=1`。不关联任何环境组或Secret，不连接生产WSS、数据库或Pages。
- Docker Command已准备一个短shell包装：先校验 `RENDER_GIT_COMMIT` 等于受测SHA，再从Render自带的 `RENDER_EXTERNAL_URL` 设置 `PUBLIC_ORIGIN`，最后exec原 `python online.py`。URL非HTTPS onrender域时启动失败。这样无需猜测尚未分配的域名；包装未在Render执行，属于部署待验项。
- 同一HTTPS域提供页面、字体、/api及真实结算，使用默认onrender域与TLS。健康检查GET `/healthz`；健康成功只代表进程已启动，不能替代三个片段验收。
- 应用已有4会话、30分钟TTL、全局单事务锁、8处理线程、20KB请求体限制保持不变。CI的128 PID/no-swap参数不等于Render提供相同控制；实际限制部署后记录。
- 不挂盘。重启/暂停/发布会丢失内存会话，测试前提示导出；零停机发布可能短暂存在旧新容器，不在有人试玩时发布，不承诺会话跨发布延续。

## 4. 批准后的创建步骤（本轮未执行）

1. 补齐Billing核对，确认实验工作区与生产额度独立、$7计算报价及额外费用可接受。未确认则不点击创建。
2. 创建只指向 `9cf0e5fb7fac27e16b2700559716b590e81957b7` 的发布分支并核验HEAD；已有同名分支不覆盖，须先核对。记录Dockerfile blob。
3. 在实验工作区 New → Web Service，选择此公开仓库及固定发布分支；填写上述清单，复核单实例、0.5c-512mb、Singapore、Auto-Deploy Off、无Secret/附加资源。**创建按钮将启动构建并产生费用**，只在最终批准后执行。
4. 保存service ID、实际域名、构建/部署日志、源码SHA、基础镜像digest与可见镜像标识。启动包装拒绝错误SHA；若部署版本不符，不开放试玩。需要手动重发时使用 Deploy a specific commit 填上述完整SHA，禁止Deploy latest和Hook。
5. 完成下列目标验收；通过后先交付真实页面截图和三步操作说明，再提供平板试玩链接。不得用CI通过宣布Render、真人易用性或平衡通过。

## 5. Render验收门槛与记录

验收由执行者完成，用户不需终端、安装或源码。复用009动作和契约，不修改规则/预算。

| 验收 | 记录与通过要求 |
|---|---|
| 来源与HTTPS | deploy SHA=9cf0e5…；根页面/API同域；Secure/HttpOnly/SameSite cookie；跨源POST拒绝；无生产WSS请求；/replay等非白名单不可访问 |
| 启动与三片段 | 记录启动墙钟；prepare/isolation/restore各3次同序列，记录每步request ID、版本、实际结果；对照009的39动作/18结算，不以静态数值代替 |
| 四会话隔离 | 四个独立cookie上下文；A操作/重置不改变B/C/D状态摘要；容量拒绝不创建第五局；会话过期旧POST不重建旧局 |
| 时间 | 正常动作仍为3秒整次引擎预算；逐次记录结算成功/失败及HTTP墙钟min/median/max，公网耗时与内部预算分别报告。正常矩阵必须完成，不能把HTTP耗时直接称求解器耗时 |
| 峰值内存 | 记录Render Metrics数值与采样间隔，并尽可能读取同容器cgroup memory.peak（含Node/solver）；记录实际memory.max、cpu.max、swap/pids值。图表采样峰值不能冒充精确峰值；拿不到cgroup则标明限制，不宣称精确峰值已验。无OOM/重启，峰值低于实际内存上限 |
| 忙碌及回滚 | 复用四路同步请求验证busy503无提交；利用已有budget字段缩短至0.001触发测试超时，核对状态/版本/资源前后不变，再恢复默认3秒重试无重复提交。测试参数不改变服务器3秒上限；若当前场景未触发真实超时，记未验而非假通过 |
| 重置及反馈 | 每片段一键重置，初态/选择正确；导出仅含本局选择/结果；引导可关可重看，保留自由路线和战后操作 |

真实目标运行若超时、内存不足或启动失败：保存日志、停止本次开放试玩，暂停实验服务。**不自动升至1CPU/2GB，不放宽3秒预算**。后备规格须另行费用批准。源码不公开提供权威全状态；HTTP状态摘要校验与009测试进程的完整事务校验要分开记录，不能混称完全等价。

## 6. 关闭与撤销

- 首次部署验收失败、无已验上一版：仅在实验service ID对应的服务设置中Suspend Service；永久撤销则Settings → Delete Service并确认该实验名称。记录停止/删除时间与后续账单，不动生产工作区或服务。
- 后续版本回退：Deploys选择该实验服务最近已验成功部署 → Rollback；核对源码、配置和健康，重新建试玩会话。首次发布没有可用历史镜像，不能承诺回滚到CI临时镜像。
- 暂停/删除不抹去已产生的计算、构建、带宽或税费，也不自动取消其他工作区费用；关闭自动部署本身不会停止运行/计费。此方案无磁盘/数据库等需要另外清理的收费资源。
- 不使用Blueprint，因此没有自动同步重新创建已删除服务的问题。若发布分支不再使用，可以保留作审计；无需改main/source-main。

## 官方依据与本轮限制

- https://render.com/pricing （2026-09-29搜索可读取价格表；正文提取动态表格不全，账户价仍未核实）
- https://render.com/docs/compute-plans （0.5c-512mb与原Starter映射）
- https://render.com/docs/outbound-bandwidth （额度工作区共享）
- https://render.com/docs/build-pipeline （构建额度、超额、workspace级消费上限）
- https://render.com/docs/faq （按秒计费与费用类型）
- https://render.com/docs/platform-features-by-plan 与 https://render.com/docs/team-members （工作区能力；账户资格待核）
- https://render.com/docs/render-dashboard （Billing入口）
- https://render.com/docs/deploys （关闭自动部署、固定commit、Docker Command）
- https://render.com/docs/environment-variables （Render自带URL与commit环境变量）
- https://render.com/docs/service-metrics （平台监测）
- https://render.com/docs/rollbacks 与 https://render.com/tutorials/firstdeploy/what-to-learn-next （撤销）

本轮没有账户访问、资源创建、服务部署、镜像发布、生产改动、PR或Hook调用。没有要求安装软件或下载文件。未做Render/华为实测，未宣布预算或性能通过。最终批准仍需账户费用/隔离信息及明确创建授权。
