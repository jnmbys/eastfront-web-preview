# MP-005A — Snapshot Payload Audit checkpoint

结果 **B：审计 + 离线协议演进设计**。生产逻辑未修改，当前线上消息大小/延迟未因此改变。
独立分支：`mp-005a-snapshot-payload-audit`。不整合 source-main，不部署 Pages / Render。

## 基线与测量边界

- 本轮起始本地和远端 source-main 均为 `69ad789a23e3899e1dd251b9ab7ef3e43a3cb5ad`，Tree `8dca261c08a228db5ae8e0797c7a9c53336d2b3f`；起始工作区 CLEAN。
- v24.19.0, linux/x64, AMD EPYC 9V74 80-Core Processor。本地 Node 内存 authority；正式 Scenario 固定测试 seed 17；不连接公网、不创建线上房间。
- 一组完整部署序列：苏军 32、德军 26 次，操作方/等待方各一份，共 116 部署快照。另覆盖初始、阶段交接、移动、多攻击者战斗、防守反应、resync，以及受控 CONTACT→Last Known / 隐藏炮兵夹具；合计 142 授权快照、68 accepted actions。
- 所有字节是 **UTF-8 JSON 应用消息（含信封）**；不是 WebSocket 帧、TLS 或公网压缩字节。每个字段计 JSON value 的完整 UTF-8；不重复累加父子字段；键名、冒号、逗号、大括号等剩余成本单列。逐行和等于完整消息。
- performance.now 测本机同步 CPU。两种 codec 同一批对象预热 3 遍，正式每消息各一次，交替先后顺序；记录每样本及中位/最大值。不计规则/投影、网络、WebSocket、浏览器验证、UI 刷新、布局和绘制。不进行跨时钟相减。
- 已有公网 238KB、ACK→快照约 993ms 和服务端发送调用约 16.43ms 仅作为任务背景，未混入本轮对照；没有重做握手、真机或公网部署计时。发送调用/本地回调不等于数据已离开服务器或到达客户端。

## 生成与消费路径

1. `server/match.ts:playerSnapshot` 对 server assignment 调用 derivePlayerView，显式 allowlist 返回授权 DTO。
2. `server/gameplay.ts:queryModel` 构造 BrowserRenderModel，再将 playerView / hexes / edges 指向该 viewer 的授权投影，并过滤只读选项、battle history 和私人决策。授权 events 则由 applyIntent 根据该 viewer 的前后视图过滤。
3. `server/authority.ts:snapshot` 同一消息再放一份独立 playerSnapshot 到 view；model 已经含 playerView，且另含 hexes / edges。操作方和等待方各生成一次，不能共用两玩家的 view。
4. `server/runtime.ts` JSON.stringify 一次；JSON 没有对象引用，进程内别名在序列化时成为重复数组。现有压缩路径仍在，本轮不修改它。
5. `client.ts` 原生 message JSON.parse 后校验 envelope/version、match/viewer，存 view 和 snapshot。`networkSession.ts` 按 matchRevision/serverSequence 应用 view/model，恢复 drafts、发布授权 events；renderModel 会用 view 替换 model 中的 playerView/hexes/edges。
6. 上层地图/Fog/Counter/Presence/部署面板共享 BrowserRenderModel。现有 MatchSnapshot 和 BrowserRenderModel 将三个重复字段声明为必填，format 固定 snapshot-v1，protocolVersion 固定 2。**当前消费路径的覆盖行为不等于协议允许缺失或把必填数组清空**；不依靠宽松 JSON 解析器绕过契约。

## 字段审计

代表样本：苏军第 10 次部署、revision 10；操作方 244,171 B，等待方 225,594 B。双方各用自己的完整授权 DTO。

| 不重叠分类 | 操作方 B | 占比 | 等待方 B | 占比 |
| --- | --- | --- | --- | --- |
| 地图 hexes + edges（三份） | 220,260 | 90.21% | 220,260 | 97.64% |
| units（两份）+ counters | 13,751 | 5.63% | 6 | 0% |
| identified/contactHexKeys（各两份） | 192 | 0.08% | 8 | 0% |
| CONTACT / Last Known（各两份） | 8 | 0% | 8 | 0% |
| 部署 roster / zone / 状态 | 8,601 | 3.52% | 3,953 | 1.75% |
| combat（本例 null；含 history） | 4 | 0% | 4 | 0% |
| 授权表现事件（本例 []） | 2 | 0% | 2 | 0% |
| 其余字段、信封及 JSON 语法 | 1,353 | 0.55% | 1,353 | 0.6% |

关键独立字段（下面是嵌套明细，不再与上表重复相加）：

| 路径 | 操作方 B | 等待方 B |
| --- | --- | --- |
| payload.view.hexes | 37,370 | 37,370 |
| payload.view.edges | 36,050 | 36,050 |
| payload.view.units | 5,775 | 2 |
| payload.model.playerView.hexes | 37,370 | 37,370 |
| payload.model.playerView.edges | 36,050 | 36,050 |
| payload.model.playerView.units | 5,775 | 2 |
| payload.model.hexes | 37,370 | 37,370 |
| payload.model.edges | 36,050 | 36,050 |
| payload.model.counters | 2,201 | 2 |
| payload.model.deployment.roster | 4,257 | 3,462 |
| payload.model.deployment.zoneKeys | 4,243 | 391 |

一份 hexes=37,370 B，一份 edges=36,050 B；每条消息各带三份，地图合计 220,260 B。**测量后确认重复地图最大**，不是先验假设。

### 内容用途与恢复要求

| 内容 | 客户端用途 | 重连 / 恢复 / 动态性 |
| --- | --- | --- |
| hexes / edges | 地图几何、地形、道路/铁路、控制信息、命中和规则选项展示 | 完整恢复需要；hex.control 按授权观察遮蔽，铁路 repairedBy/destroyed、bridge.destroyed 属于状态，不能把整个数组永久缓存为静态地图 |
| view.units / friendly / counters | 授权己方与识别敌军；模型、Counter、选中及命中。friendly 是既有己方数据契约 | 位置、步损、资源标记、可见性会变化；本轮未证明可删任何必填子字段 |
| identified/contactHexKeys | Fog 输入、识别/接触范围 | 每次用当前完整授权视图替换；不能降低更新频率 |
| contacts / lastKnown | 当前接触与失联情报标记 | 属于各 viewer 的授权知识；不能从对方缓存补足或永久保留旧条目 |
| deployment.roster / zoneKeys | 己方部署列表、placed 状态、选位；MP-003 部署本地选择不再 QUERY | roster 随己方部署改变、阶段结束为 null；zone 本序列不变并不证明跨阶段、scenario 不变 |
| combat.history / battle / pending / reaction | 已披露战斗记录、当前私人决策、合法选项 | 部署阶段 combat 为 null（不是隐藏的全局日志）；战斗样本出现 history，按接收方授权过滤；重连必须还原当前待决策上下文 |
| events | 经过 viewer 隐私过滤的动画/提示 | 普通 action 发送当前事件；resync 时 []，不重放断线动画；本方案原样保留 |
| status / canAct / forcedAction / revision / sequence | 权威交互屏障、自动强制动作意图、顺序与缺口检查 | 必须保留；ACK 不替代 snapshot，不改变单位位置 |
| resources / victory / phase | HUD、回合、资源和正式胜负显示 | 只含授权资源，不删除、不由客户端推导 |

原始 GameState、Core actionLog、RNG、全量 combatTransactions **不在快照中**，体积贡献为 0；不能用删这些本来就不存在的数据解释收益。

### 相邻 revision 不变内容与增长

不变体积采用“同一路径最大相等 JSON 子值”的不重叠和，省略父键语法，属于保守统计，不是已实现 delta 大小。

| 部署组 | 样本 | 不变 value 字节占比：中位 / 最大 | 消息 B：首条 → 末条 |
| --- | --- | --- | --- |
| 苏军部署：操作方（苏） | 32 | 99.02 / 99.11% | 231,622 → 274,339 |
| 苏军部署：等待方（德） | 32 | 99.91 / 99.91% | 225,591 → 225,594 |
| 德军部署：操作方（德） | 26 | 98.17 / 99.06% | 226,978 → 261,433 |
| 德军部署：等待方（苏） | 26 | 99.92 / 99.92% | 274,339 → 274,339 |

- 苏军操作方 units+counters 从 1,357 B 增至 43,614 B；可见性列表从 32 B 增至 520 B。roster 的 false→true 字符串反而略缩小，地图相同。
- 德军操作方 units+counters 从 1,367 B 增至 35,495 B，可见性列表从 32 B 增至 384 B；双方均没有部署动画事件增长。
- 苏军部署期间德军快照几乎不变；德军部署期间苏军仍必须收到自己已有 32 单位的完整授权状态。等待方绝不能通过“复用操作方 view”减量。
- 非部署样本证明：侦察移动后某 hex.control 从已授权的 SOVIET 变为 null，CONTACT 消失、Last Known 出现；战斗 history 和私人反应随所有权改变。**不能据部署期不变，把 map/visibility/history 当成全局静态内容。**

## 离线提案的体积估算

单消息去重：新格式只去掉 model.playerView、model.hexes、model.edges；保留 payload.view 的全部内容及 model 其余字段、events 和所有元数据。客户端仅从**同一条完整授权消息**重建这三个字段，不使用跨 revision、跨 match 或跨 viewer 缓存。详见 [协议设计](PROPOSAL.md)。

| 部署组 / 每接收方 | N | 原 B 中位 / 最大 | 提案 B 中位 / 最大 | 逐样本减量% 中位 / 最大 |
| --- | --- | --- | --- | --- |
| 苏军部署：操作方（苏） | 32 | 253,095 / 274,339 | 96,294.5 / 108,585 | 61.95 / 63.79 |
| 苏军部署：等待方（德） | 32 | 225,594 / 225,594 | 78,419 / 78,419 | 65.24 / 65.24 |
| 德军部署：操作方（德） | 26 | 244,192 / 261,433 | 89,190 / 99,173 | 63.48 / 65.1 |
| 德军部署：等待方（苏） | 26 | 274,339 / 274,339 | 108,585 / 108,585 | 60.42 / 60.42 |

这是假设未来新增格式后，实际离线编码得到的 JSON 大小；当前客户端不能直接消费，不接入生产。消息数量仍为每 accepted action 各接收方 1 snapshot；本组 68 次 action 均如此，查询消息 0。没有省略必要快照或改变 ACK。

## CPU 对照（本地 Node，ms 中位 / 最大）

| 部署组 | 现行 stringify | 提案 pack + stringify | 现行 JSON.parse | 提案 parse + 深拷贝重建 |
| --- | --- | --- | --- | --- |
| 苏军部署：操作方（苏） | 0.81 / 1.6 | 0.26 / 2.34 | 1.49 / 2.43 | 2.53 / 5.4 |
| 苏军部署：等待方（德） | 0.68 / 0.94 | 0.21 / 0.3 | 1.36 / 1.76 | 2.26 / 3.56 |
| 德军部署：操作方（德） | 0.73 / 0.88 | 0.23 / 0.47 | 1.4 / 2.26 | 2.3 / 3.19 |
| 德军部署：等待方（苏） | 0.8 / 1.1 | 0.28 / 0.41 | 1.58 / 3.7 | 2.52 / 4.79 |

服务端序列化工作减少；**客户端解析+重建更慢**：为保留现有 JSON.parse 后的对象隔离，原型 structuredClone 三份字段，不能用共享可变引用悄悄改变语义。单次耗时可能含 GC / 调度，未采集 GC trace，不能归因。以上不含浏览器的消息校验、snapshot 应用和渲染；未做真实链路对照，**延迟改善未证明**。

## 验证与范围

- client build / server build：PASS（为本轮生成与 source 一致的测量输入）；未修改生产代码，不机械重跑两端 typecheck 或完整历史测试套件。
- 审计内断言：142/142 snapshots 重建后 deepEqual 原始 JSON DTO；model 别名相等；checkSnapshot 在原始/重建 DTO 上均通过；隐藏部署额外检查了对方未放置 roster IDs 也不存在。
- CONTACT→Last Known、观察丢失导致 control 遮蔽、隐藏炮兵及私人反应、正式多攻击者 ATTACK / PASS_REACTION、当前 revision 的 resync 均包含。
- 离线脚本回归：4/4 PASS；UTF-8/additive accounting、错误别名拒绝、独立对象恢复、观察丢失/resync/viewer 切换无旧状态残留。
- 不声称本轮重新验收了真实断线重连、Action 重复/非法、sequence 缺口或公网浏览器；相关生产路径 **零修改**。未来格式接入前必须补混合版本与完整网络恢复测试（PROPOSAL.md）。
- 未改冻结哈希、Core / src / server / assets / package / 工作流。Safari、MP-003、MP-004、PERF-002/003/004 均保持基线原文件。
- 浏览器 / 公网 / Huawei / Safari/iPad 性能验收：未执行 / PENDING。

## 复现和证据

`MULTIPLAYER_SERVER_URL=wss://eastfront-server.onrender.com/ws npm run build`
`npm run server:build`
`node --test tests/mp005a-audit.test.mjs`
`node scripts/mp005a/audit.mjs`
`node scripts/mp005a/report.mjs`

[audit.json.gz](audit.json.gz) 保存每个样本的完整字段字节表、版本/sequence、CPU 原始数值及测量源文件 SHA256。压缩只是保存报告，**不是应用层网络压缩**；不存 token、房间码、完整视图、隐藏敌军标识、单位坐标或 canonical GameState。[validation.txt](validation.txt) 保存本轮构建/测试日志。

## 未解决与下一步最小任务

本轮达成停止条件 B；没有有效的 protocol-2 删除字段路径，未做生产修复。公网 ACK→snapshot 的剩余等待仍未定位到传输链路某段，不能归因于代理、地区或浏览器。

下一步仅需审查本单消息格式设计；若获授权，增加双版本协商与单消息恢复 adapter，验证混合旧/新客户端、真正 sequence gap / reconnect、完整决策与双方隐私，然后再在相同浏览器/网络采集至少 10 次部署的真实耗时。不要直接跳到 delta、静态地图引用或迁移服务。

友军格移动点击冲突、骰子展示、其他性能任务仍保留。

No Core rule changes. No gameplay rule changes. No FOW privacy changes.
No production application protocol schema changes. Server authority preserved.
