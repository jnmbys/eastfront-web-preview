# 证据索引与引用边界

检索日期：2026-10-01。代码事实固定到 `813b4072568352e95d0726fe5fe04060c889c554`，不是随时间变化的主分支。项目年份、每回合日数、格距未确认。

## 源码与契约

| 证据 | 支持的结论 |
|---|---|
| [defaultScenario.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/scenario/defaultScenario.ts#L38) | 32×20、turnLimit16、18/20仅候选、双方入口、五批苏军增援；初始名单在同文件上方 |
| [defaultRules.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/scenario/defaultRules.ts#L129) | 铁路4/5、RP8/12、恢复吞吐与距离；同文件模板给定战斗阶数与RP价格 |
| [recovery.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/rules/recovery.ts#L107) | 恢复完整验证及只修一阶/扣RP；源码全局检索RP写入仅初始化和消费，无周期收入 |
| [reinforcement.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/rules/reinforcement.ts) | 永久槽ID、延期、东侧入口、ZOC/堆叠、无RP付款的部署 |
| [RulesEngine.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/engine/RulesEngine.ts#L184) | 有可部署苏军增援时阻止Ready跳过 |
| [turn.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/rules/turn.ts) / [victory.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/rules/victory.ts#L121) | 德苏阶段顺序、完整回合边界与最终德军回合末判胜 |
| [铁路修复修订](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/docs/DIGITAL_RAILWAY_REPAIR_AMENDMENT_DR_002.md) / [rail.ts](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/core/source/src/rules/rail.ts) | 全方一次网络修复计划与工兵机会成本，不能照搬旧lane/railhead修路 |
| [live.py](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-exp-005/live.py#L71) | 3秒事务、请求去重、SP行动消费、仅turn递增时结算、整包回滚 |
| [legalmap.py](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-exp-005/legalmap.py#L32) / [campaign-config.json](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-exp-005/campaign-config.json) | B按类型4或8q；初始3B/上限4B/增援0；来源和运力是未平衡实验配置 |
| [数学底层契约](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-exp-005/oracle/CONTRACT.md) | q/SP、生产源未用额度不结转、库存/共享约束/有理数债务、有限逐层优化口径 |
| [CAMPAIGN010](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-exp-005/CAMPAIGN010.md) / [CONTRACT015](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-integrate-015/CONTRACT015.md) | 完整战役恢复原终局；旧短片段和正式适配差异；热座、信息投影与回滚边界 |
| [CAMPAIGN011](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/experiments/supply-exp-005/CAMPAIGN011.md) / [MP-002](https://github.com/jnmbys/eastfront-web-preview/blob/813b4072568352e95d0726fe5fe04060c889c554/docs/MP-002.md) | 本地事务测量限制；现有多人全快照、往返和重连边界，均不是工业性能实测 |
| [只读019研究](https://github.com/jnmbys/eastfront-web-preview/blob/b4a30a7c6958db1246a8c031850c4f936d1ceb61/experiments/supply-rules-019/CHOICES019.md) | 后续独立分支的源码核对/局部合法账本：开局维护33/38SP与来源24SP、清债但无攻击库存、炮兵直接攻击限制。未将该分支合入本工作树 |

规则确认的优先次序：该基线实际执行代码 → 对应完整战役接缝/契约 → 更早文档。发生冲突如实列出，不自行改写运行规则。未找到现实时间/公里的证据，不代表项目从未在别处讨论，只表示本次可读基线不能确认。

## 可靠历史来源

**H1 — Mark Harrison, “Industry and the Economy”, 作者研究稿（版本2009-08-17，发表于战时苏联研究文集的章节草稿）。** [华威大学作者存档PDF](https://warwick.ac.uk/fac/soc/economics/staff/mharrison/public/industryeconomy2010.pdf)。正文第6–7页：量产、标准化与长期批次；第9–10页：撤迁、运输争用及复产差异。研究援引档案和相关史学著作，属于学术研究，不是一手工厂日报。本文只用它约束“既有体系扩产/复产有时间和资源代价”，不从宏观总产量推导师战斗数值。具体七周复产案例不能外推成绿地建厂工期。

**H2 — United States Strategic Bombing Survey, Summary Report (European War), 30 September 1945。** [UNC ibiblio / HyperWar全文转录](https://ibiblio.org/hyperwar/AAF/USSBS/ETO-Summary.html)。原报告第6–7页航空工业、第12–13页铁路与水路、第16页总结；是战后官方调查的一手综合材料，网页为大学托管转录。可支持闲置产能/设备重组与运输瓶颈的区分；涉及1944–45的发现不能直接套作1941东线常数，航空实例也不等于坦克厂工期。没有以该报告为由加入战略轰炸系统。

以上史料未给出本项目格距、回合长度、I兑换率、P包规模、产线工时、运输负载换算或施工报价；这些均为设计抽象。未直接引用长段原文，也不将商业游戏机制当作历史证据。
