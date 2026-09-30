# SUPPLY-CAMPAIGN-011：同一战役的战斗与补给连续性

基线 `8e2fe1249fd2ffeae765137bd225a4272cb7374d`，独立分支 `supply-campaign-011`。未发现既有011 checkpoint，首轮从该基线创建；此后 checkpoint 只续接同一局。此次仅增加验证脚本与证据，无运行接缝修复，无Core、RNG、公式、配置改动；不部署，不连接生产或AI。S-AI-1仍只是原Core控制方ID。

## 固定实验假设

沿用 `campaign-config.json`，SHA256 `eb6279d4f809ac7c39f122f7b12664830f370a932810772acb92122fb6e1d5a0`。数量单位均为1/4补给点：初始3B、上限4B、增援零库存；德军源A5/A10/A16各32；苏军源AF4/AF10各24，AF16/AC10/AC11各16。德军枢纽A5/C10/A16；苏军AC10/AC11/AF10；枢纽初始8、容量32、W96、quota40、floor4、配送范围8；普通边40、桥24，T2200，full/A/last/GS。沿用普通配置，未采用恢复片段的高容量；这些是未平衡的实验假设，不是推荐战役参数。

## 单局真实动作与账本索引

`evidence/campaign011/run.json.gz` 是一局从空部署到原Core终局的227次事务Action及每次hash、收费、事件、变化、连续账本；固定人工编写序列，seed17。对应228条Core Action（其中1次无可选防御反应由既有接缝自动PASS_REACTION）。无中途夹具替换、库存注入、手改回合或重掷骰子。部署布局与修路动作是测试输入，不改变全局参数。

| 事务revision | 实际覆盖 |
|---|---|
| 1–60 | 58次初始部署、双方显式就绪；3B库存各授予一次 |
| 62–63 | G-PZ-01 C8→D8、G-I-01 C7→D7；装甲库存24→20，步兵移动不耗储备 |
| 65 | 两单位攻击E8，装甲20→16、步兵12→8；固定骰子产生DR |
| 66–67 | 强制S-I-01撤退E8→F8；选择PASS_ADVANCE；待决步骤阻止END_PHASE |
| 75起 | 15个连续配送epoch，每回合递增一次；227次同请求重试不重复扣费/配送 |
| 118 | T6真实RAIL_REPAIR修A10–B10和B10–C10，遵从原Core两边额度 |
| 128 | T6→7配送：G-MOT-01短缺5/8→0、收到8并支付维护8；恢复者不是T1攻击者 |
| 227 | T16 GERMAN_ENTRENCHMENT触发原Core终局，SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT |

实际6个增援均以零库存进入。119次补给损失步骤、39个单位消灭，与ledger.loss及Core事件逐项对应；被消灭单位立即退出库存集合，不再收到后续配送。此次被消灭单位库存均为零，非零销毁库存见010夹具证据，不能当作本局覆盖。最终守恒：初始900+投入1493=维护2173+行动12+销毁0+剩余208。

75次增援入口请求被STACKING_LIMIT拒绝，全部原状态返回；这是保留的合法失败证据，不通过改堆叠/容量规避。没有本局自然3秒超时或求解失败。单次战斗没有产生CRT战损分配；本局尚未覆盖战斗致损/消灭、主动推进、短缺恢复后再次交战或多轮攻防，不据此宣布持续进攻或平衡通过。

## 验证与复用边界

`verify_campaign011.py` 从空部署逐Action回放同一序列，比较所有状态hash；核对每个老单位的真实损失事件与最终step/alive、每次存活库存集合、注销集合、行动扣费、配送tick及守恒。补给损失必须严格等于本轮ledger.loss，防止原补给损失再叠加。数值旧扣罚的冻结实现证据：movement.ts仅在无expSupply时减旧移动罚值，combat.ts仅在无expSupply时乘旧攻击罚值；unit.ts一次投影新因子。既有炮兵/合成兵种资格判断保持原样；本局没有证明所有短缺攻击分支。

回放在同一局首次配送前，以0.001秒故障注入确认整包状态不提交；正常事务仍为3秒。010已有冲突ID、错误控制方、草稿修改后故障回滚、信息过滤与旧补给对照证据直接复用：`evidence/campaign010-validation.json`、`campaign010-seams.log`、`campaign010-atomic.log`、`campaign010-http.log`、`campaign010-old.json`。不重跑010，不将战斗夹具冒充本局。首轮标准输出campaign011-run.log仅保留片段，完整结果、75条失败请求及每轮账本以run.json.gz为准。

## 资源与测量限制

首轮227动作耗时236.198秒；15次含配送事务中位1.002秒、最大2.506秒（包含Node/Core/同步开销，不是纯MILP时间）。预算保持3秒。首轮RSS采样误把PID命名空间内PID用于宿主/proc，462848字节为**无效读数**，原始数据保留，不能引用为内存峰值。首次hash回放虽227步全通过，但本环境缺失/proc/.../children，101.289MiB仅为主进程峰值，仍不能作为完整进程树峰值；保留replay-first.json。最终改用宿主PPid关系重建子孙集合，经单独80MB子进程分配自检后重新回放采样；正确结果见replay.json及summary.json。

最终采样每100ms累计本Python验证进程与现存子孙（Python求解worker、Node）的RSS；共享页可能重复计数，短峰可能漏采，包含验证/JSON开销，不等于cgroup峰值。采样开始于模块导入后，不覆盖冷导入峰值。环境为本地共享Linux沙箱：Python3.12.14、Node24.19.0、NumPy2.3.5、SciPy1.17.0，OPENBLAS_NUM_THREADS=1；cgroup 8 CPU/8GiB，无另设0.5CPU/512MiB限额。不是Render或512MiB性能验收；完整战役资源结论不得借用009短片段结果。

## 最短复现与下一步

复用010已初始化的依赖，在 `experiments/supply-exp-005` 运行：

```sh
OPENBLAS_NUM_THREADS=1 python3 verify_campaign011.py
```

从头生成同一动作配方：`OPENBLAS_NUM_THREADS=1 python3 campaign011.py`；若存在data/campaign011-checkpoint.json.gz会续接原局。研究账本全知，不能作为公平玩家接口输出。实际UI入口仍为 `python3 campaign-server.py`，本轮没有网页或在线服务更新。

下一步需在同一局加入多轮真实交战及战斗损失分配，再评价短缺恢复后的进攻连续性；不为满足这些路径调整容量、RNG或公式。触屏、完整战役线上资源与平衡均待验。

## 最终验收数值

两次独立适配层回放均227个hash逐一一致，最终hash为 `f8336aee0043be0ef6ac863c63fc093861bd1ee777462c2b652e3effcfb982c9`。正确内存采样回放耗时150.343秒、采样1336次，完整进程树RSS采样峰值240.305MiB（251977728字节）；该次配送事务最大1.484秒，全部事务最大2.223秒。所有实测批次合计：含配送事务最高2.506秒，任意事务最高2.721秒，均小于固定3秒。75次堆叠拒绝和两次资源采样缺陷保留；最终回放/账本核验无失败。详见 `evidence/campaign011/summary.json`。
