# INDUSTRY-INTEGRATE-012

本轮实际完成：**真实T5下单付款 → E5进度1/2 → E6完成唯一2 E2:L批次并交接A10 → T7可用。** 终态为`freeI=5, productionSpent=3, handoffSpent=2, escrow=0`；A10持有2 E2:L、P=0。没有发完整恢复包、向C10配送或执行恢复。

## 固定依据与批准

- 规则007：`90758efccda736e3524348d8876b892be3d7938f`；候选原字节SHA256：`41b0443a602599c8da167d4e36e840e77daffad6a5996fe05b219055031a327d`。
- 新批准：`LEADER-INDUSTRY-INTEGRATE-012-20261003`，独立`APPROVAL.json`及`launch.json`绑定候选、参数摘要、`012-main`实例、来源与真实T5存档。
- 起点：`german_recovery_T5`，revision109，SHA256：`db9f91bb6394928bc670a812107310b53b2626c01d5e2371731dd069ae87a980`。
- 复用011的单所有者锁、私有执行、幂等回执及单根发布方式。通过固定006准备器恢复其原Core/补给入口；原运行基线仍为`813b4072568352e95d0726fe5fe04060c889c554`。本轮**没有引擎补丁**，也不加载011材料优先/P/E恢复接缝。

007原候选保留空批准及未决字段，新参数只由本轮可信启动配置承载；请求不能提交价格、库存、epoch、授权或额外I来源。正常主实例每进程仅一个。拨款固定10I且只记一次，不继承旧I余额，不兑换SP/RP，不追加收入。

## 实际账本

| 事件 | 游戏revision | 可用I | 生产已付I | 交接托管I | 交接已付I | 进度 | 装备归属 |
|---|---:|---:|---:|---:|---:|---|---|
| 原始T5 | 109 | 0 | 0 | 0 | 0 | 无订单 | 0 E2、0 P |
| 一次性拨款 | 109 | 10 | 0 | 0 | 0 | 无订单 | 0 E2、0 P |
| 接受订单 | 109 | 5 | 3 | 2 | 0 | 0/2 | 未产出；生产暂存预留2 |
| E5合法结算 | 116 | 5 | 3 | 2 | 0 | 1/2 | 未产出 |
| E6产出、发运、收货同根提交 | 126 | 5 | 3 | 0 | 2 | 2/2 | A10入库2 E2:L；到账E6、T7可用 |
| T7德军恢复阶段 | 129 | 5 | 3 | 0 | 2 | 已完成 | A10可用2 E2:L，P仍0 |

E6私有处理顺序：E11最后一次工作、E12唯一产出凭证、E14仓位/服务预留及发运付款、E15到账。L=1按`due=dispatchEpoch+L−1`，因此E6发运同E收货，次T7可用。发布时原Core已经合法进入T7；先记`REAR_UNAVAILABLE`收货事件，再按真实Core当前turn开放，不能提前到T6使用。没有同E第二跳或前线运输接口。

`EXTERNAL_G_A10`是新增独立实验能力，覆盖出厂装载、地图外承运和A10卸收：

| E | 上限工作点 | 实际使用 | 提交后预留 | 未使用（当E到期） |
|---|---:|---:|---:|---:|
| E5 | 4 | 0 | 0 | 4 |
| E6 | 4 | 4 | 0 | 0 |

每E2占2点。本批2 E2占4点，未借用或更名SP rail/T/W额度；E5未用额度不结转。容量检查计入本行所有已用、其他预留；A10检查驻留装备加所有入库仓位预留，仓位转换为实物时删除同一预留，避免重复计量。生产暂存与A10容量各2 E2。

## 资格、原子性及受阻处理

每次发运和收货，`eligibility.mjs`调用未修改的原Core完整性/ZOC函数，读取全量权威当前状态，检查A10/0,9、控制、敌占及敌ZOC。批准的null控制仅是本实例G服务例外；不写control/homeSide，也不把玩家视野中的`known=false`误当作权威资格缺失或友方领土。缺字段、未知控制、敌控、敌占、敌ZOC均拒绝。

未能发运：产出仍归生产暂存，2I仍托管，无收货库存或本批运力使用。已经发运而收货失败：状态`HELD`，归同一shipment保管，A10仓位继续预留；2I已付和已用4点不退款，不能虚构到账。E5/E6窗口以外没有自动续期或重试承诺。

预算满足`10=freeI+productionSpent+handoffSpent+escrow`。装备满足`produced=productionStore+inTransitOrHeld+rear`；入库预留不是第二份实物。永久订单/批次/运输/收货ID绑定实例、候选/参数和授权；输出须关联已付生产凭证，仅一单一批。

每个真实E来自原`live.execute`合法阶段跨T和原SP结算记录，检查两个阵营的结算及唯一新增logistics epoch。订单接受、边界进度、材料与预算全部在私有根内改变，校验后一次发布。整个事务共用3秒，含Core、SP、资格检查及提交前检查；预热属于实例启动。提交前异常回滚整个域状态；错误请求可保留ID绑定元数据，不标成功。成功重试先返回永久回执，晚到请求不回滚较新状态。

## 证据与复跑

`EVIDENCE.json`包含本轮定向检查及实际账本；`TRACE.json.gz`保留真实起点、付款、E5/E6前后、T7及无订单对照；`VIEWS.json`保存代表视图。20条合法`END_PHASE`逐条与同起点无订单实例比较，完整游戏JSON（包括Core、SP、revision、日志和RNG）一致，且RNG保持起点值。没有重跑完整战役或011旧测试全套。

容量/仓位阻塞及敌方资格测试明确为`SYNTHETIC_FIXTURE`或`SYNTHETIC_TEST`；主路径没有实际遇到这些阻塞。故障、竞争、回执丢失试验从真实T5合法推进，故障/调度本身仍标为合成测试。失败视图保持失败前账本，不拿重试成功后的库存冒充失败结果。

环境：Python3.12、NumPy2.3.5、SciPy1.17.0、Node24.19.0及固定Git对象库。不要用`python -O`。

```text
python experiments/industry-integrate-012/prepare.py
python experiments/industry-integrate-012/verify.py
python experiments/industry-integrate-012/verify_finance.py
python experiments/industry-integrate-012/export_view.py --checkpoint T7
```

首次生成证据用`verify.py --write`；普通复跑核对保存证据和摘要。`--probe`只跑真实短路径和无订单对照，写入忽略目录。`prepare.py --check-existing`只核验已恢复依赖。`INPUTS.json`保存候选、原入口来源及版本摘要。

`verify_finance.py`及`FINANCE-VERIFICATION.json`单列4项快速付款/拨款回执核验：第二个请求引用已存在拨款也绑定成功回执，之后过期重试仍只读回执；生产扣费与交接托管的提交前故障全部回滚，重试只扣一次。首次记录加`--write`，不推进战役边界。

仅单进程内保证；原可丢弃求解子进程没有账本发布权。无持久化、HTTP、合并、部署、付费资源或运行默认切换。35项全局阻塞保留，不宣称工业经济平衡或生产到前线恢复循环已成立。
