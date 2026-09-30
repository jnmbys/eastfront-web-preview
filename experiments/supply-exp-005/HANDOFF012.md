# SUPPLY-CAMPAIGN-012 试玩准备

基线 `f85a533df467b79686e550e7f5fd65b5ade00e11`；本轮运行候选 `aca1f4b9801ab7b7c7073ac7973bb028cd6df435`。**可以进入独立服务更新审批/线上验收；尚未部署，不能宣布Render、华为或完整战役平衡通过。**具体操作与撤销见 [UPDATE012.md](UPDATE012.md)。交付提交只追加CI报告与文档，实际受测代码固定为上述候选。

## 011受控销毁接缝收口

使用已有 `test006.initial(CASES['SECOND_ATTACK'])` 夹具，加入完整战役模式标志 `campaign_config`；沿用 `evidence/campaign010-combat.json` 固定前7个Action，含实际攻击、反应选择、推进、突破、再次攻击及结束推进。未改生产初始化、Core、RNG或实验配置；没有挑未来骰点、搜索种子或继续重跑011失败分支。

真实战斗造成 S-TK-01 库存24（6补给点）、S-ART-02 库存12（3补给点）销毁，共36个四分之一补给点。检查：真实UnitDestroyed事件、Core alive=false、退出存活物流集合、retired各一次、destroyed_sink各一次、其余单位库存仅有真实攻击扣费、没有转移。守恒和每次Action重复处理通过；销毁后再次sync同一Core frame不重复销毁；7动作逐hash回放通过。

**分类严格为“受控接缝验证”。**夹具继承原片段库存/容量，并非全局完整战役初始化，也没有把其容量写回配置A。011自然战役中“携非零库存被战斗消灭”缺口仍保留；同单位已覆盖的是储备恢复后再攻，不增加欠账归零/攻击减效解除的覆盖声明。75次脚本拒绝沿用旧归档，未重试或修策略。

初次验证脚本错误地断言死亡单位ID应从Core字典删除，触发 `('S-TK-01','still in Core')`；依据既有Core alive语义及011 check_losses，更正为死亡标志和存活物流集合注销检查。只修测试断言，未改Core或销毁实现；不是战斗规则故障。

证据 `evidence/campaign012/controlled.json`，最短复现：已有项目依赖下 `OPENBLAS_NUM_THREADS=1 python controlled012.py`。仅重放7步，不重跑战役。

## 完整战役在线适配

`online.py`增加显式 `ENABLE_CAMPAIGN=1` 开关，复用原四会话/同源HTTPS/全局求解锁和真实Action入口；默认不开启时仍为三片段。新界面保留三片段选择，战役部署面板在片段模式隐藏，继续旧补给对照。没有用静态模拟代替Python结算。

完整战役操作上限1000（原短片段仍150），6MiB阈值不变，固定3秒预算。会话仍只在内存：空闲过期、cookie到期、重启/更新均可能丢失进度，**不提供恢复存档**。原cookie30分钟最大寿命未改，连续长局亦受其影响；不能把当前版本称为可靠长时存档服务。此限制及后续Render/浏览器/华为验收应在邀请试玩前说明。

Dockerfile、requirements、Core树、live.py、campaign.py、campaign-config.json、model.py、bounded.py及RNG均未改；没有增加付费服务、调用Hook、改生产或部署。

## CI针对性实测

[Actions 36676198920](https://github.com/jnmbys/eastfront-web-preview/actions/runs/36676198920)，驱动提交 `e71b9f66e5fa5cc494c2bd7bbaca277b8b4aa82a`。标准ubuntu-24.04，contents:read，25分钟总超时、单并发，仅012分支和验证路径push触发，无生产Secrets、镜像发布或付费runner。Artifact保留7天；原报告与日志已复制入Git长期保存，并核对ZIP SHA256。

| 测项 | 实际结果 |
|---|---|
| Docker build | 23.875秒；原Dockerfile成功 |
| 原CMD冷启动至healthz | 2.222秒，一次冷启动 |
| 启动cgroup峰值 | 118063104 bytes / 112.59 MiB |
| 四个空部署会话峰值 | 150536192 bytes / 143.56 MiB |
| 四个合法checkpoint117会话峰值 | 178728960 bytes / 170.45 MiB |
| 全部针对性检查峰值 | 254205952 bytes / 242.43 MiB（含测试驱动/检查点副本） |
| CPU/内存/交换/PID | NanoCpus=500000000，Memory=MemorySwap=536870912，PidsLimit=128；无额外swap空间 |
| 代表性配送 | 合法checkpoint117续接原11动作至128，T6→7配送；11个hash逐一与011一致 |
| 事务耗时 | 普通动作0.741–0.883秒；配送1.602秒；配送HTTP总耗时2.420秒 |
| 超时回滚 | 保持3秒预算；真实Core接受后注入延迟，事务最终拒绝；状态/RNG/journal/seen全部不变 |
| 忙碌/隔离 | 故障延迟持锁期间另一会话503不提交；四会话互不污染；第五会话503 |
| 重置/过滤 | 三片段和新旧战役加载重置通过；重置不影响其他会话；G/S只见己方单位；全知/replay为404 |
| 容器状态 | 测试退出0，OOMKilled=false；报告保留全部11动作及预期超时错误 |

配送只取代表性一个epoch，不推断所有后期对局都能在同资源内完成。超时是明确标注的故障注入，不是自然高负载超时；不使用0.001秒替代正常预算。检查点仅注入测试进程内存，线上没有状态导入端点。CI测试容器挂载只读证据且无外网；发布容器不挂载测试数据。

Dockerfile Git blob `d6b31d347762298e11472023a1e622ac8aac149b`，SHA256 `729cf4920229583adac7d212451295489878b709ca3a57c930270b67aa63e7a1`。实际CI镜像 `sha256:20a98412cf7444c212b285009d5d593564c3577ba58c197ecef4819432235ec7`；仅本次构建产物，未推送registry，也不是Render镜像。

`evidence/campaign012/ci/` 包含原 report.json、targeted.json、build/targeted/container日志、SUMMARY及PROVENANCE。`local.json`是本地针对性调试结果，8CPU/8GiB共享cgroup峰值不可归属本进程；不将其当作512MiB资源证据。

## 剩余边界

没有重跑011整局、旧测试矩阵、0.1CPU/2GiB或性能优化；复用已有完整生命周期、旧补给及失败路径证据。未做新的完整战役真实浏览器/华为验收、目标Render实测，未验证任意长局和四个最坏终局内存。启动方案、重启丢局、短片段兼容边界、回滚到原9cf0e5fb和暂停服务步骤已备妥。下一步另行批准更新**现有独立服务**后进行目标验收，资源或3秒预算不达标即暂停，不自动升配。
