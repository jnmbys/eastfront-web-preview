# AI-PERF-007 — 测量语义已修正，约 1 秒的运行时来源仍未定

## 暂停交接（2026-09-29）
- 状态：诊断交接完成，性能追查暂停、待命。实现与8项测试/构建 checkpoint 为 f2eaff3852f8b30fcc2f020b52eb9f7806f79971；本次仅更新此摘要，不重测、不生成新报告。
- 旧约1秒指标**不能作为实际呈现时延结论**。原始记录保留于57a690f9的 evidence/ai-perf-preview-006；测量缺陷及已有对照直接引用下文，不覆盖历史数据。实际呈现是否延迟、是否来自浏览器调度仍未知。
- 保留预览发布6502e06d0e15ce9956a867a637b9f0b48569af6a；预览分支证据tip为57a690f9f120db5a075f01b3e8ce33eac7972607。不为诊断单独部署，不主动改策略。
- 恢复条件：取得可关联同一输入的事件派发/处理完成/浏览器渲染调度追踪；若要下实际屏幕呈现结论，还需可信呈现时间戳或同步录制输入与画面的测量，注明采样精度。工具等待、页面可见性及自动化派发时间线须可分辨。具备能力后再安排恢复任务，不因本交接自动开始测试或发布。
- 恢复时最短复现（待执行）：①固定Chrome版本、1363×936、前台可见与seed17，打开既有固定预览 https://9dfd4603.eastfront-web-preview.pages.dev/?aiPerf006=1&aiSeed=17 ，德军campaign开局，同时开始上述关联采集；②AI部署时放大一次、拖动(400,450)→(500,490)，等待接受33且AI空闲后重复同一操作，逐事件区分派发、同步处理完成、RAF机会及实际呈现；③退出并重开确认接受0、无旧任务污染，保存原始追踪与诊断。此线上版本仍为旧诊断，事件关联以外部追踪为准；需要PERF007探针时另行安排可测的运行环境，不擅自更新预览。
- 待验：约1秒来源、新探针真实浏览器配对、实际呈现时延、移动/战斗对照、触控/捏合及华为真机。先完成最小空闲/部署对照再决定后续，不重复全矩阵。取消/重开既有通过证据见下文；若恢复工作改动取消或调度再回归。

## Checkpoint / scope
- 源码基线 a0c1485d9841eaea1ec6ed2bd9b97a569ff5c9cb；独立 ai-perf-007，起始远端该分支不存在。
- 管理协议读取自 c7531c70fab4b7c7402cd2f7d927c2134adee228。未发现适用 AGENTS.md。
- 复用浏览器证据 57a690f9f120db5a075f01b3e8ce33eac7972607 / evidence/ai-perf-preview-006；线上发布仍为 6502e06d0e15ce9956a867a637b9f0b48569af6a。本轮不部署。
- 仅修改 src/local-ai/performance.ts、对应诊断测试及本目录。main.ts、相机、渲染、Worker 调度、取消客户端、AI 策略、Core、RNG、规则均未改。不减少行动。

## 已证实的测量问题
1. 旧捕获监听器先按按钮 ID 分类，再看事件类型：无按键的 pointermove 悬停在 zoom 按钮上也算 zoom；pointerup、click 亦进入同一类别。旧 EventQueue 实际是 performance.now() - event.timeStamp，不是硬件输入排队时间的独立测量。
2. 每个事件先写 EventQueue，随后 pending.has(name) 合并 RAF。部署诊断导出均为 6 个 zoom 时间戳差、4 个 zoom RAF 样本；两组数组不能按索引配对。退出后的累计报告还包括适应地图，不能混用两个导出时点。历史没有 event type/id，不能反推哪个 1 秒样本属于 click，也不能把大时间戳差直接归到悬停。
3. 捕获阶段请求的 RAF 测的是 capture→该回调机会。缩放按钮同步修改 transform，但旧探针没有记录处理完成点。拖动处理还会 queuePan→requestAnimationFrame(flushPan)：捕获探针先排入同一帧，可能在地图写入之前运行。此指标既不保证处理完成，也不是 paint/compositor/display 呈现时间；双 RAF 亦不会补足实际呈现证据。
4. performance.now() 两端同页时钟，约 1 秒 capture→RAF 差不使用 event.timeStamp，因此“输入时间戳域错误”本身不能解释该差值。timestamp→capture 假定同域，仅过滤负值/≥60秒，无法检测所有时钟偏移。Worker sentAt 使用各自 timeOrigin+now，含序列化/调度，不能拿来代替输入时延。
5. 旧报告只有导出时 visibility=visible，捕获时跳过 hidden；没有两端可见性/中间变化、连续帧节奏或自动化派发时间线。不能排除中途节流/云端调度，也不能仅凭导出 visible 排除它们。
6. 工具调用墙钟等待未直接相减进入页面公式，但工具产生的事件时间戳、事件间隔、截图/观察的自动等待可能影响运行。当前接口不提供派发细节或浏览器调度 trace，不能宣称“确定是自动化固定等了 1 秒”。既有超时也不自动等于游戏阻塞。

## 必要对照：复算而非扩测
运行 audit.mjs 从固定 Git checkpoint 读取原始 JSON，输出 reanalysis.json，不复制/改写旧证据。Chrome 云端 1363×936、seed17；候选 3 轮、旧状态栏控制 3 轮；各 1 次空闲对照。原组别顺序未随机化。

| 场景/指标 | 可靠结论 | 不能据此断言 |
| --- | --- | --- |
| AI 部署，6 轮 | 每轮接受33、拒绝0；pre-exit zoom计数6/4不一 | 不能逐事件配对、不能作呈现性能 A/B |
| AI 空闲，双方各1次 | 接受均33→33，think帧均34→34；新增 zoom捕获→RAF最大1007.9/1008.3ms | AI正在计算不是必要条件；并非证明AI从不影响界面 |
| 部署 mainLongTask | 候选峰值68/74/59ms；控制52/无记录/50ms | 不能完全排除未覆盖时段、布局/GPU/浏览器等待 |
| viewUpdate / mapUpdate | 6轮峰值分别≤43.4/9.1ms，包含范围由源码定义 | 不是布局绘制或屏幕响应时间；父子跨度不可相加 |
| exitHandler 同步工作 | 候选7.1–9.3ms，控制8.4–9.2ms | 不是点击→首页呈现，未与事件ID配对 |
| 移动/战斗 | 本 checkpoint 无同条件 UI 响应对照 | 不使用旧策略70.4ms替代；本轮未扩测 |

结论：已定位“指标不具备所宣称含义”的测量缺陷；尚未定位 1 秒回调等待来自浏览器调度、自动化影响还是其他未测过程。未证实实际画面也晚 1 秒，没有依据修复游戏调度/渲染。

## 最小诊断修正
保留原 opt-in ?aiPerf006=1 / aiSeed 与 perf006 导出名，报告内部 version=AI-PERF-007。旧聚合输入字段不再输出，避免继续误用。游戏分段 stages 保留。
- 按钮只采 click；wheel 与按键 pointermove 仅采地图，排除 hover / pointerup 重复分类。drag 是候选指针移动，不保证已越过拖动阈值，不声称触控/捏合完整覆盖。
- inputs 逐事件保存 id、type、name、原始 event.timeStamp、captureNow、timeOrigin、isTrusted（不是人工操作证明）、范围检查后的 timestampToCaptureMs。相同 RAF 批次仍逐事件计算差值，不按类别错配。
- RAF 保存回调参数与回调入口 now、两端 visibility 及期间变化标志。回调参数与回调入口不是同一概念；不把两者差或长间隔解释成呈现延迟。
- handlerCompletion 明确 unmeasured；现有 exitHandler 仅同步跨度。没有伪造“处理结束”微任务或“已呈现”点。
- 最多128样本、32待回调样本；超限 droppedInputs 可见。没有连续 RAF 心跳/面板重绘，避免为诊断增加游戏工作量。停止将待测样本标 stopped；代次隔离阻止旧回调进入新局报告。
- 新诊断未经线上/真实浏览器实跑，不能据离线合成测试宣布 1 秒消失。schema变更需下次预览构建诊断消费者读取 inputs；历史COMPARISON仍保留为原始记录。

## 环境缺口与停止条件
本轮核对当前云端工具文档：有 DOM 只读观察、交互、截图和控制台日志；没有可调用的呈现时间戳、浏览器 trace、逐帧显示采集或自动化输入派发时间线。截图自带等待且无对应呈现时间，不能替代该测量。本轮不部署新探针，不注入页面脚本绕过接口。
因此停止浏览器场景扩测：不重复6轮、不补移动/战斗的相同歧义数字、不让用户重复整套验收。浏览器调度根因、实际画面响应、华为真机均未验证。后续需具备输入/处理/渲染关联 trace 或同步视频的受控环境，才有条件决定游戏修复；不能为压低RAF数字改行为。

## 验证 / 失败 / 复用
新跑：TypeScript local target 编译、npm run build 通过；4项 PERF007 定向测试 + 4项现有诊断/取消边界测试通过。后者包含真实 Node Worker 部署到接受3后终止、disposed client 拒绝迟到消息及新客户端隔离。未重跑全量58项；复用 a0c 的固定seed重放/策略证据（本轮无相关源码变更）。
复算 cancel-candidate 与 cancel-candidate-later.report 完全相同；既有云端退出重开、停止接管记录仍来自57a690f9，不标成本轮重测。
失败保留：首次边界测试缺少 dist（清洁环境尚未执行build）；执行build后通过。审计脚本首次假定空闲before已有zoom行，第二次取错later包装层；均为脚本读取错误，修正后复算通过。详见各日志。

复现（仓库根目录）：
```sh
npm ci --ignore-scripts
node node_modules/typescript/bin/tsc -p ai/local/tsconfig.json
cp -r vendor .ai003-dist/
npm run build
node --test ai/tests/perf007.test.mjs
node --test --test-name-pattern='disposed client|diagnostics bounded|input probes|terminate during' ai/tests/perf006.test.mjs
node evidence/ai-perf-007/audit.mjs
```
审计需要本地存在57a690f9对象（完整clone已含）；其数据和本轮reanalysis均在Git，不依赖聊天缓存。部分旧测试会重写旧证据路径；不要将无关旧证据变化纳入提交。

## Handoff
仅以 [CF-Pages-Skip] 保存 ai-perf-007；无预览分支更新、无PR/Hook/部署。回滚诊断只需恢复源基线 performance.ts 与对应测试；无需回滚线上版本。下一步先补测量能力，尚无游戏修复建议。
