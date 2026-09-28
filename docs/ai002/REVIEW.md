# AI-002 — 公平 AI 强制行动与完整对局 checkpoint

基线：`core-baseline-002 / db183c7733ae59d2f5a3bcb8f3f384357b7d59e6`，Tree `24d999cfa2e7a4b6c6ff46da229a3afe5937e6ef`。
隔离分支：`ai-002-forced-flow`；未合并、未部署。当前 checkpoint 的 Commit / Tree 可用 `git rev-parse HEAD HEAD^{tree}` 取得。

## 已有能力与本轮变化

| 项目 | 审查结果 / 本轮变化 |
| --- | --- |
| 座位调度 | 复用 FairHost：先调 pending 决策所有者，否则 activeSide；双方各一个 controller。不新增第二套调度。 |
| 增援 | 新增公开时间表的到期槽位、本方已执行增援回执和公开东部入口；真实 DEPLOY_REINFORCEMENT 提交。回执在宿主重建、反馈历史截断及单位被消灭后仍有效。GERMAN 不接收 Soviet 剩余槽位。 |
| 撤退 | 新增观察候选搜索：授权单位、公开地图、本方占位和已识别敌军的公开 ZOC 类型规则。按提交次序更新本方拟议位置；最长 2 格、最多 128 候选、4096 分支节点预算。保留长、短、空路径候选，只有原引擎判断最大合法距离及无法撤退后果。 |
| 损失 | 原分配已支持；补充确定性的均匀分配候选，实测跨单位承担损失，保留旧的轮换贪心候选。 |
| 可选后续 | 增加授权单位的正常推进、一步突破和对已识别相邻目标的 Schwerpunkt 候选。最小代理仍可合法 PASS；验证策略实际执行它们，不伪造 pending。 |
| 有界恢复 | 沿用同一观察下拒绝去重、16 条本方反馈、8 次连续拒绝即停止和总行动上限。拒绝时权威状态/RNG 不变；不传原始 issues、details 或合法性查询结果。 |
| 终局 | 固定种子自然推进到现行第 16 回合 GERMAN_ENTRENCHMENT 的终局检查，没有引入规则研究中的时点实验。 |

修改只在 `ai/` 与本任务文档/证据内。Core 源码/测试、vendor、生产前后端、协议、美术、补给规则和 v2/v3 未改。

## 公平性审计

- 策略只收到显式白名单 PlayerView、公开规则、本方到期槽位/公开入口、本方隔离反馈及独立代理种子。新增公开模板字段仅 `type`、`exertsZoc`，没有附加敌军 templateId。
- `deriveSovietReinforcementSlots` 只由可信宿主调用；已审查其仅展开 scenario.reinforcements。剩余槽位只扣除同一 controller 已接受的 DEPLOY_REINFORCEMENT。只发槽位 ID，不发 actionLog。
- **不调用** `computeLegalSovietReinforcementEntryHexKeys`、`getMaxLegalRetreatDistance` 或真实预览供策略选动作；它们读取隐藏敌军，会成为信息探针。候选不是合法动作清单。
- 真实引擎执行意图。一次接受/拒绝本身仍是既有行动反馈；原始敌军身份、最大可撤退距离和拒绝详情均被截断。没有通过重复预览查询额外信息。
- CONTACT / Last Known 原权限不变；不将其猜造成有身份的单位。双方隐藏敌情成对状态保持相同输入、候选和执行前意图。权威结果可以不同。
- 原全知评估入口保留且明确标记；公平模块依赖图仍仅允许自身模块和纯 hex 几何。该接口不是任意恶意 JavaScript 的进程级安全沙箱。
- 公平 DTO 新字段仅用于未发布的 AI 适配层；未改网络版本或生产客户端。旧调试/headless API 不变。

## 最终验证

| 门禁 | 结果 |
| --- | --- |
| AI 编译及契约负例 | 通过 |
| 最终完整 AI 套件 | **29/29** |
| 原 Core 完整测试 | **97/97**，运行一次，无断言放宽 |
| 相关 Web 回归 | **72/72**：FOW001/002、MOVE-001R1、COMBAT-UX3/3.1 |
| Core / Web / Server typecheck、build | 全部通过 |
| Core 重建产物与 vendor | **76/76 字节相同**；受保护运行时代码无 diff |

本轮没有重复 Web 全量 637 项及 28 个 Core smoke；这些未变范围的基线证据仍在 `evidence/corebaseline002/`。不将基线通过冒充本轮重新执行。无浏览器或华为测试，无生产操作；COMBAT-UX3.1 华为多人验收继续挂起。

### 可重放的完整对局与实际战斗

| 固定场景 | 接受 / 拒绝 Action | 结束 |
| --- | --- | --- |
| 生产地图，Core seed 17、Agent 101/202 | 221 / 0 | 第16回合 GAME_OVER；第4回合真实增援；重复运行轨迹和最终状态完全一致 |
| seed 8246，实际撤退→推进→突破→放弃重点突击 | 159 / 12 | GAME_OVER；换 Agent seed 777/999 后相同行动及最终 Core 状态/RNG |
| seed 8246，两个受损步兵的 D3R 损失分配 | 159 / 12 | GAME_OVER；三步损失跨单位执行，继续撤退 |
| seed 8246，无路可退 | 158 / 12 | GAME_OVER；真实空路径 RETREAT、额外损失由 Core 执行 |
| seed 8253，重点突击第二场战斗 | 162 / 12 | GAME_OVER；子战斗及后续选择关闭 |

微型战斗地图无活动铁路入口，其 12 次拒绝分别发生在第4至15回合增援阶段：候选入口被引擎拒绝，随后 READY 被原引擎允许延后；不是跳过可部署增援。所有已接受 Action 均从初始 fixture 原样重放，最终状态完全相同。最后一次返回 GAME_OVER 的已接受 Action 计入接受数。

额外专项：隐藏 ZOC 的成对真实战斗在撤退前输入相同；开放路线首次成功，隐藏全封锁样例两次拒绝后空路径成功。空路径在实际存在路线时被拒绝，随后正常路径成功。原有 8 次拒绝停止、恶意身份/输出拒绝、终局不再调用策略、跨座位/对局历史隔离、失联记录及非法突破状态停止断言全部保留。

## 开发失败及修正记录

- 初次编译的 PASS_BREAKTHROUGH 字符串被数组推断拓宽，TS2322；补 `as const`，未改运行规则。
- 初版撤退搜索把前8次重试都耗在被隐藏 ZOC 挡住的长路径上，宿主安全停止。现按路径长度交错候选并预留空路径；仍不承诺找到所有可行路线。
- `refinement.log.gz` 保留一次真实测试失败：原 elite+inf fixture 的 CRT 只有 D1R，无法断言“跨两个单位承担损失”。根据当前单位参数和固定种子，改为两个已受损步兵，实际 D3R；保留并强化跨单位断言，未改 CRT、种子算法或生产规则。
- `initial-demo-legacy-label.json` 是开发初期输出：行为已到终局，但旧 AI-001 文案和漏计最终接受 Action 的显示尚未更新。最终计数以本文件及最终 trace 为准。
- 本轮没有发现新的 Core 缺陷；无独立 Core 修复混入。

## 复现

```bash
git switch ai-002-forced-flow
npm ci
npm ci --prefix core/source
node ai/build.mjs
node --test ai/tests/*.test.mjs
node ai/demo.mjs
npm test --prefix core/source
npm run typecheck
npm run build
npm run server:build
node --test tests/fow001-player-view.test.mjs tests/fow002-fog.test.mjs tests/move001r1-state.test.mjs tests/combat-ux3.test.mjs tests/combat-ux31.test.mjs
```

`ai/tests/flowHarness.mjs` 是可信测试驱动，策略函数只接收输入 DTO；审计/重放代码与策略隔离。场景初态及种子在 `flow.test.mjs` / `helpers.mjs`，轨迹含 observationKey、座位、阶段、意图、结果、规范 Action 和最终哈希。归档轨迹为 `evidence/ai002/*.json.gz`；重跑测试会在同目录生成未压缩证据。

## 下一步与限制

**具备开始接入本地 Human vs AI 的流程前置条件，不代表人机对战已经可用。** 尚需人类/代理轮次桥接、UI 生命周期与取消、存档恢复/观察历史重建，以及对 AGENT_STOP / REJECTION_LIMIT 的明确人工接管反馈。本轮没有 UI、训练、策略评分或服务部署。

最小代理默认不主动组织进攻/机动/铁路修复/恢复；战斗专项策略仅证明行动链可执行。当前支持每方一个 controller、当前规则最长2格撤退；不支持任意多人联合控制或未来新增强制阶段。固定排序、128候选和8次重试可能错过复杂堆叠/隐藏阻挡下的合法组合，此时明确停止，不放宽规则、窥探状态或无限重试。接 UI 时必须保留该失败出口，不能承诺任意局面自动完成。

回退仅需切回基线 `db183c7733ae59d2f5a3bcb8f3f384357b7d59e6`；未更新生产引用，无线上回滚操作。
