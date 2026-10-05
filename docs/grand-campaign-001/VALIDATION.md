# 验证记录 · GRAND-CAMPAIGN-001

2026-10-05，本机Windows/Node24、Codex内置真实浏览器。未部署，未新增资源；没有替代用户声明真机结果。

## 执行结果

| 范围 | 结果与证据 |
|---|---|
| 新T1 | 1280格、120唯一单位、相邻铁路/全图连接、堆叠≤2、120次Core部署及双方准备、完整性检查通过；`initial-scenario.json`可重生成 |
| 新机制 | `npm run grand:check`：6项连续闭环＋14项边界＝20项通过；`core-cycle.json`、`boundary-checks.json` |
| 旧流程 | `node --test tests/ui004-turn-loop.test.mjs tests/ui005-combat.test.mjs`，22/22通过，旧640/T16与战斗待决逻辑保留 |
| 缩放 | `node --test tests/camera-interaction.test.mjs`，7/7通过；旧默认2.5上限、拖动和指针锚点不变，新场景可选上限12 |
| 构建 | `node ai/local/build.mjs`及`tsc -p server/tsconfig.json --noEmit`通过；前端严格类型检查包含在构建内 |
| 浏览器最终机制 | 41条真实UI提交，T1→T4，4订单、1货运、1P/E恢复、2移动、1攻击和防守方反应，拒绝0 |
| 最终UI定向复核 | 修改近景缩放后新T1，1024×768近景选兵/规划/确认移动，768×1024生产下单；3条接受。不是触摸硬件测试 |
| 旧模式切换 | 同一浏览器退出新模式→原640完整战役，正常进入T1德军部署（苏军AI已接受33操作）；再返回新1280对局，只有1张活动地图、1280地形、0个旧地形canvas。`legacy-640-start.jpg` |

全局没有跑24回合战役或大批对局。5E无敌破坏静止维护是短对照，不代表长战役存活/整体平衡。E24、失守工业与断轨使用明确静态边界前提，不把它们冒充浏览器战役过程。

## 浏览器权威链

最终机制实例 `5a9454d4-2368-41c3-94b2-e8e2a1396090`，详见 `evidence/browser-authority.jsonl`（还包含之后最终UI实例，按instance区分）：

- T1：C29下E2和P各一单，12I→7I、48P后备→47P；G-026真实移动R17→T17占中央节点，攻击S-026，Core反应后NE，双方全部阶段完成。
- E1：两笔实物首次入仓，下一T可用。德军收入22I＝5×4＋中央2，目标只有一条收入；人员照管1I。`final-e1-ledger.json`保留来源、铁路、T/W及逐单位维护。
- T2：再各下一单，并预约首批1P＋2E2由C29→P29。苏军无订单仍能推进。
- E2：第二周期两单入库；第一批沿19条真实铁路边完成8载荷运输，T占152，目的W占8，与SP同一当次预算。前线1P＋2E2标T3可用。`final-e2-ledger.json`。
- T3：G-059在P29恢复阶段由损伤1→0，战力4/4→5/5；1P＋2E2消耗，共用恢复计数0/6→1/6，RP保持0。Core资格和host材料扣款在同一事务内。
- T4：该单位真实移动到Q30，继续行动；并非旧记录回放。

先前机制开发过程实例保存为 `browser-first-chain.jsonl`，46接受；另包含T4第二战DR、真实撤退和放弃推进闭合。该实例早于南部两单位T1位置修正和最终UI缩放，作为补充证据，不能替代最终41条机制链。旧截图保留，文件名以`final-`开头为后续复核；其中早期`final-tablet-1024x768.jpg`是尺寸切换后的未重新定位画面，近景问题修正后的有效证据为下列near文件。

## 真实截图

- [桌面远景1280格](evidence/final-desktop-overview.jpg)
- [桌面近景](evidence/final-desktop-1280.jpg)（文件名保留；画面为近景）
- [T1战斗](evidence/final-t1-combat.jpg)、[T3到账回执](evidence/final-t3-receipts.jpg)
- [T3恢复后](evidence/final-t3-recovered-near.jpg)、[T4继续移动](evidence/final-t4-continued-move.jpg)
- [最终1024×768近景真实移动](evidence/final-tablet-near-move.jpg)
- [最终768×1024人员下单](evidence/final-tablet-portrait-order.jpg)
- [开发过程第二战及后续](evidence/browser-t4-second-combat.jpg)

缩放按钮、部队下拉定位、路径格及确认动作均通过真实DOM操作；没有浏览器脚本注入状态。定位后平板选兵目标实测约53×65像素。新图取消SVG常驻变换栅格缓存，避免大倍数放大模糊；重新定位可适配视口变化。

## 性能口径

`final-service-performance.json`：最终机制链原子权威事务最大89.38ms；全部记录的服务进程RSS峰值170,496,000字节（162.60MiB），heapUsed峰值63,681,656字节（60.73MiB）。包含保留的本机会话；不是单局精确归因、HTTP全程耗时、限资源容器或持续压力测试。

`final-browser-performance.json`：1560×1244视口，单地图、1280地形节点、60个授权可见单位、0个DOM canvas，约9,591个当前DOM节点。JS堆采样约23MB（以JSON字节值为准），不是整个浏览器RSS或GPU占用。旧地形缓存切换时释放；没有为1280场景另增常驻整图位图。控制台未记录错误。没有FPS、真机/0.5CPU/512MiB达标声明。

## 边界与保留项

20项检查覆盖请求重放/冲突、旧版本拒绝、P/E与预算守恒、只读查询/RNG不变、敌仓拒绝、未到时点不能发货、运输预约和取消、断路保留材料、逐单位维护、工业失守停止旧收入/源、E24双方恢复及晚到材料不折VP、提交中途故障全回滚。事务幂等仅进程内，不是跨重启耐久事务。

整体24回合平衡、捕获仓重新授权/缴获、经济AI、保存/加载、多人、实际平板触摸/手势与长期资源开销仍未验证或未实现。它们不阻止本地人工新场景的上述闭环，不能标为已通过。
