# 研究聊天短表：AI-ADVANCE-AUDIT-013

B/C=1017 德军基线/候选；n 为零基 trace 序号（行号 n+1）。距离越小越近，同回合阶段末对齐，不能跨版本直接对齐分歧后的 n。

| 节点 | 行动 | 后果 / 证据等级 | 证据位置 |
|---|---|---|---|
| 8 局完整性 | 核验原 blob、事件/RNG、终态双回放 | 【直接】全部完整；首局退出码 1 不影响统计，缺失样本 0 | [integrity.json](integrity.json)，原 batch-run/resume.log |
| T2 首次分歧 n156 | B PASS；C MOT03 从 (10,1) 推进至 (11,1) | 【直接】距离 18→17；目的地邻接可见 ART01；三选项同距、按 ID 选 MOT | [C156](nodes/candidate-n156-check.json)、[B156](nodes/baseline-n156-check.json) |
| T2 苏军移动 n161/163/171 | C 对手看到 MOT，改以敌邻格寻路，I07/I12/TK03 靠拢 | 【直接】封住 MOT 周围；B 初始无可见敌军，走向 objectives；此时尚未新增掷骰 | [C161](nodes/candidate-n161-check.json)、[B161](nodes/baseline-n161-check.json)；原 C trace 行162/164/172 |
| T2 苏军战斗 C n192–193 | TK03 攻 REC02，2+3/DR，REC02 退到 (9,2) | 【直接】无损步，但比 B 多消耗两次 RNG；后续非同骰对照 | summary.json / battles；原 C trace 行193–194 |
| T3 首次持续落后 B n224/C n219 | B MOT/PZ04 移至 (12,1)；C MOT 留 (11,1)，结束移动 | 【直接】16 对17，此后所有可比阶段末均落后；C MOT 未移动、MP4，但六邻格全部敌占/ZOC，实际拒绝0 | [C199](nodes/candidate-n199-check.json)、[C219](nodes/candidate-n219-check.json)、summary.json / firstSustainedPhaseEndLag |
| T3 攻击 B n225/C n220–223 | B 攻 (13,1)；C 联攻 (11,0)，PZ01 推进，MOT 未前进 | 【直接】侧方攻击得分最高；MOT 前方单攻被评分排除，纵深未恢复；骰序已分叉 | [B225](nodes/baseline-n225-check.json)、[C220](nodes/candidate-n220-check.json)，summary.json / battles |
| 终局 | B I05@(18,-3)；C REC01@(15,-2)、REC02@(15,-3) | 【直接】最近距离10 对13，均未占首都；最近单位已更换 | summary.json / final；[逐回合最近单位](turn-leaders.md) |
| 归因及建议 | 推进放行可见敌邻接，后续移动却停步；建议仅为该新增邻接情形保留 PASS | 【推断】衔接缺口触发本例反应链；【未知】终局3格差距各因素占比、建议整体收益。未实施 | [详细解释、唯一建议与边界](README.md) |

结论：已定位首次持续落后的直接行动链；未证明终局差距只由推进或骰点造成。无新局、无扩样、无策略修改、无部署。
