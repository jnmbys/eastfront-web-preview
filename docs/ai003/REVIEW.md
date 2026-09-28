# AI-003 — 本地 Human vs AI 实验入口

状态：独立工程候选；不合并、不部署。实际浏览器验收受环境策略阻塞，不能标记已验收可玩。

基线：`ai-002-forced-flow` / `a8f9dadd7252f7572440b3767d5a11b7ccb7c094`，Tree `a68a3d2b35f4f61134fdc9205c28db5c4bf5b227`。工作分支 `ai-003-local-human`。远端基线一致，main/source-main 未纳入或更新。源码 checkpoint 以本分支提交为准，可用 `git rev-parse HEAD HEAD^{tree}` 取得完整标识。

## 变化与边界

- 专用构建 `node ai/local/build.mjs` 开启本地实验入口，可选德军/苏军、完整战役或流程场景，固定提示“实验 AI：流程验证，策略尚弱”。正常生产构建开关为 false，实验构建独立输出，不通过 URL 偷开生产功能。
- Worker 持有 FairHost、权威状态与规则引擎；最小策略仍只收到本方授权观察、公开规则、隔离历史和独立代理随机源。FairHost 新增可信人类提交桥，继续交给原引擎执行，并执行完整性检查。SHA256 由 Node 实现换为等价浏览器实现，摘要结果不变。
- Worker 根据 pending decision owner 调度，否则才按 activeSide；每次一个 Action，AI 回合与人类回合不并发。主线程只接收现有授权 PlayerView、查询模型、战斗摘要和安全状态，不接收 GameState、actionLog 或 RNG。复用 NetworkPlayerSession 作为授权视图适配器，但 LocalAiClient 不建立 WebSocket、不开多人连接、不挂远程网络恢复监听。
- 抽出原 playerSnapshot 纯函数；原 applyIntent 的已接受结果处理提为 recordAcceptedIntent，供本地复用授权事件与摘要。远端仍执行原 dispatchGameAction 一次；没有改协议或决策权限。
- Worker 隔离运算，40ms 有界调度间隔；主线程可继续处理镜头。新局、退出、pagehide 终止 Worker，epoch 和 generation 拒绝旧任务回包；提交单飞，revision/所有权/授权目标检查不绕过。冷启动先复用既有地形加载流程。
- AGENT_STOP、AGENT_ERROR、8次拒绝上限暂停并保留权威状态。明确确认接管后切换到该座位授权视图，重建 presentation/result cache；进入手动模式，后续换座位也需确认，不自动暴露另一方。完整性错误不允许接管绕过。复制诊断只含模式、座位、计数、原因、revision。
- Worker 崩溃或30秒无回应：终止 Worker 并冻结最后授权画面，可复制诊断后新局；此类运行时故障不承诺恢复内部状态。AGENT_STOP/拒绝上限则保留 Worker/状态并支持接管。
- 明确暂不支持存档/加载；刷新会结束当前局，未添加不完整存档。没有 UI 训练、策略提升、补给重置、美术候选、Core/vendor 修改、MOVE 改动或 v2/v3 设置改动。

## 场景与真实 Action

| 入口 | 建立方式与覆盖 |
|---|---|
| 完整战役 | 现行生产地图/规则，从部署开始；复用最小确定性策略 |
| 人类进攻 | 两阵营固定合法战斗初态；实际 ATTACK 后 AI PASS_REACTION/RETREAT，回交人类 |
| 脚本 AI 进攻 | 两阵营观察候选中选一次 ATTACK；人类实际防御反应、损失等，后续恢复调度 |
| 第4回合增援 | 从正式部署通过真实 Action 回放到 turn4；实际 DEPLOY_REINFORCEMENT |
| 推进/突破 | 固定战斗初态，真实 ATTACK → PASS_REACTION → RETREAT 建立 pending；人类 ADVANCE_AFTER_COMBAT → BREAKTHROUGH → PASS_SCHWERPUNKT |
| 终局 | 真实完整回放至现行第16回合德军构筑阶段；实际 READY_FOR_PHASE_END 进入终局；未修改终局规则 |
| 停止接管 | 验证策略主动 STOP；额外测试8次拒绝上限，保持原状态并显式换座位 |

战斗场景初始单位、补给标记与战斗阶段是明确的测试夹具，复用生产地图，不声称从正式部署移动到该阵位；所有待处理战斗阶段由真实已接受 Action 产生，没有手写 pending 或跳过完整性检查。脚本进攻不是战略能力。详细轨迹见 `evidence/ai003/action-traces.json.gz`。

## 验证层次与失败记录

最终计数见同目录 `RESULTS.md`。AI-002 原公平、完整对局与隔离测试复用并实际回归；新测试覆盖本地 authority、真实 Node Worker 消息、实际 LocalAiClient + NetworkPlayerSession 桥、冷启动/取消。Node Worker 使用小型 self/postMessage shim 运行同一 Worker 模块，**不是浏览器 Worker 验收**。

首次构建 TS 类型/导出问题、客户端编译清单遗漏、冷入口测试读取未生成 main.js 的夹具路径均有原始日志并已修复。完整 Web 首轮 583/637，通过实际修复后重新验证；没有用重复运行碰运气：

1. Worker 工厂移出 main.ts，旧 VM 截取 UI 函数不再遇到 import.meta；生产 Worker 仍为模块 Worker。
2. 本地状态更新只针对本地 transport，普通 UI 测试和远端不要求本地函数；pagehide 注册放在既有启动测试截取边界之外。
3. startup-progress VM 夹具显式提供新构建开关 false，所有原断言保留。
4. ua002/ua003/ua003r1 冻结清单仅更新 `src/main.ts` 的授权入口集成哈希；ua003r1 同时更新两个嵌套清单及 startup-progress 夹具哈希。没有改 Core、地形、模型、镜头、规则哈希，也没有删除或放宽行为/隐私断言。

产物审计检查70个 Worker 可达模块、无 Node 导入/Socket、完整模块路径、实验/生产开关、空多人服务配置、connect-src self。静态审计不等同运行验收。

**浏览器阻塞：** 获准 cloud Chrome 经 browser-client 访问 `http://127.0.0.1:4193/` 返回 `net::ERR_BLOCKED_BY_CLIENT`；无可用端口桥接能力。仅尝试一次，未换浏览器或网络通道绕过，未发布来规避。本轮没有浏览器双阵营实际点击、拖动/缩放性能实测或华为实测；保留 `browser-block.json`。接收方需在允许访问本地服务的浏览器完成上述场景后才可验收可玩。

## 复现

```bash
git switch ai-003-local-human
npm ci
npm run typecheck
node ai/local/build.mjs
node ai/local/audit.mjs
node ai/build.mjs
node --test ai/tests/*.test.mjs
npm run server:build
node --test tests/*.test.mjs
PORT=4193 node scripts/serve.mjs .ai003-preview
```

打开本机 `http://127.0.0.1:4193/`，分别选择两方，依次运行场景。战斗沿用现有攻击、确认、损失/撤退、推进/突破和结果记录操作；停止场景点“明确接管”并确认座位。换阵营/新局使用“退出 / 新局”。不要刷新来修复停止；不要连接生产服务。构建生成 ai003-build.json 记录当前 SHA 与工作区是否脏。

## 下一步与回退

工程上已补本地交互桥；**仍需获准浏览器实际验收，不宣称人机对战已经验收可用**。最小代理仍主要完成部署/强制行动/结束阶段，不会主动组织基础机动、目标选择和进攻；下一步应在现有公平输入上增加基础移动/进攻评分与有界候选，不借真实合法性 oracle 探测隐藏信息。存档若后续支持，必须包含双方各自知识/历史、增援回执、代理决策计数/随机状态、战斗 RNG 和宿主状态。

无生产改动，无线上回滚步骤。独立工作树切回基线 `a8f9dadd7252f7572440b3767d5a11b7ccb7c094` 并重建即可回退。
