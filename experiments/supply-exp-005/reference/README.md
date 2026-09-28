# SUPPLY-EXP-004 · 可恢复本地沙盘

解压到独立目录。Python 3.12；先 `python3 -m pip install -r requirements.txt`，再 `python3 server.py`。无需线上服务、生产存档或 Core 工程即可启动现有三个片段。已有依赖可直接运行 run.sh / run.cmd。

三个入口（同一服务，切换入口会明确开始新实验）：

1. http://127.0.0.1:8765/?clip=advance&viewer=S — T8 分散推进、多桥压力。点「推进到下次后勤结算」→「推进片段中的真实 Action」→再结算；看两桥共享与实收。可切德军看 A5 枢纽失联/恢复。这里 W5/W10/W13 枢纽及 2 SP 桥容量为实验配置。
2. http://127.0.0.1:8765/?clip=reinforcement&viewer=S — T10 增援。先结算→推进真实 Action→观察新增 ID 储备为零→结算；下一段到 T12 的格位变化仍保留库存。
3. http://127.0.0.1:8765/?clip=combat&viewer=S — T5 战损、消灭、撤退。先结算→推进真实 Action→看本方迁移和注销库存→再结算。Core 战斗早已在旧规则下完成；这不是新补给实战。

每次可选择 2B/4B，前者初始实际储备 B、后者 3B，容量分别 2B/4B，沿用 EXP003。连续结算到第 2/4 次容易看到维护不足；后期短缺单位变少可能是影子减员，不能解释为供应改善。重置与前进按钮用途不同，前进不重置库存。

证据/复现：

```sh
python3 -m unittest test004 test_exp003.Exp003Tests.test_signature_path_oracle test_exp003.Exp003Tests.test_fractional_need_oracle test_exp003.Exp003Tests.test_signature_keeps_bridge_detour
python3 cold004.py
python3 check004.py
python3 bridge004.py
python3 privacy004.py
python3 replay004.py
python3 topology004.py
```

旧测试模块中的“所有局面恒有 58 单位”断言仅适用于 EXP003，勿把旧整模块当成 EXP004 gate。以上选择的 oracle 对照保持有效。evidence/check004.json 保留最初的冷启动失败；cold004-after.json 是按需读取后的重复测量。重跑脚本会覆盖其对应文件，先复制证据可保留原测量。

真实重放：data/legal-actions.json 保存 957 条 Action，seed=3001；data/frames 保存逐份完整 Core 状态，frame-index.json 索引按需读取，legal-frames.json 是生成原件。verify-core-replay.mjs 核验中间哈希；generate-legal.mjs 重建原件，随后运行 `python3 index-frames.py` 更新逐份快照索引。二者需要同级 supply-exp-003-source（固定 db183c7）的 Core vendor/dist 和地图；生成器还需要 TypeScript 与 src/player-view/playerView.ts。源码来源是 jnmbys/eastfront-web-preview 的 core-baseline-002。运行沙盘/上述 Python 测试不需要这些源码。不得用其他运行产物替换后仍声称是同一重放。

浏览器：在获准的 Node/Playwright/Chromium 环境，设置 CHROMIUM_PATH 后运行 `python3 run-browser.py browser004.cjs`。此脚本同进程环境启动仅监听 loopback 的服务；浏览器二进制不随包附带。BROWSER_CAPABILITY.md 说明权限条件，不能代替其他聊天的授权。

REPORT.md 是本轮结论；CONTRACT.md 是增量合同；reference-exp003/ 是旧报告/测量，oracle/ 保留原精确小图。SHA256.json 固定所有文件。未合并、未部署；不连接生产存档/房间；线上版本未知。用户暂不需测试。
