# SUPPLY-UX-007 试玩入口

当前为候选，尚未部署。用户只有华为平板：**现在无需安装或下载**；独立在线方案见 DEPLOY007.md，批准并验证后将提供直接打开的HTTPS链接。

Windows有电脑时：首次双击 `install-windows.cmd`（需要用户级Python3.12和Node22+），之后双击 `start-windows.cmd`，看到ready后打开 http://127.0.0.1:8765。虚拟环境在 `%LOCALAPPDATA%\EF007\venv`，不改全局配置，不需管理员；Windows未实测。

维护者Linux本地：`python3 restore-fixtures.py` → `npx --yes --package typescript@5.7.3 tsc -p core/tsconfig.json` → `python3 -m pip install -r requirements.txt` → `python3 server.py`。

未来在线候选使用 `online.py`，不能把共享全局状态的 `server.py` 直接对公网开放。Docker/限额/费用/隔离边界见 DEPLOY007.md。它运行真实Python求解器与Node Core，未替换为模拟。

试玩三步：选择G-PZ-01 → 查看可点选路线并移动 → 阅读真实变化回执。每个片段的“这局怎么玩”可随时收起/重看；片段选择后点“重置此局面”才切换起点。地图横向滑动；撤退路线按所选单位逐格点选，包括起点；多单位先选执行单位再点路线。高级手填入口保留。反馈是当前视图结果，不是全知回放。

验证、SHA与证据见 HANDOFF007.md。以下保留EXP006历史说明，冲突以本节/EXP007文档为准。

---

# SUPPLY-EXP-006 玩家战后选择沙盘

需要 Node（本轮 v24.19.0）和 Python 3.12。从任务分支进入 `experiments/supply-exp-005` 后：

```sh
python3 restore-fixtures.py
npx --yes --package typescript@5.7.3 tsc -p core/tsconfig.json
python3 -m pip install -r requirements.txt
python3 server.py
```

服务仅在本机 `http://127.0.0.1:8765`。不需要线上快照、生产存档或 Core 源仓库；包含隔离 Core 源码；Git 交付按上述命令重建编译产物。完整运行依赖已固定的 NumPy/SciPy。无需现在参加测试。

## 三个入口

- `http://127.0.0.1:8765/?clip=prepare`：4B 备货起点。选择 G-PZ-01，查看候选或点地图写连续路径→移动，实际扣1 SP；也可保存储备。结束移动阶段后可选多单位发起真实攻击。
- `http://127.0.0.1:8765/?clip=isolation`：自然短缺后的T11。部分单位D≥2，总MP封顶1；条件候选不意味着能穿越隐藏敌军。结束移动阶段，G-I-02攻击I8可看到新旧补给不同战果。切旧模式须明确重置，是独立对照局。
- `http://127.0.0.1:8765/?clip=restore`：实验GH2在D10，起始因C10–D10未修而失联。点「修复该铁路」→放弃本方余下阶段→切到当前行动方→放弃苏军余下阶段。此时才结算，部分单位D从2降至1；再完整一回合可降至0。可提前以部分恢复状态进攻，或继续备货。该片段单独提高了既有产能/容量/W参数，见CONTRACT；不是默认平衡配置。

这里普通移动、攻击、修路及阶段结束均由玩家自主选择，调用真实 Core。战斗有选择时停下。点击“切换到当前决策方”，分配每阶损失、填写有序撤退路径，或选择推进／突破／重点突击。可选步骤可明确跳过；强制步骤必须完成。费用及接缝默认值见 CONTRACT006.md。没有“影子结算”按钮。新模式不运行旧补给扣罚；旧模式不扣新库存。

「切换到当前行动方」是本地热座操作；玩家界面按所选方过滤，不是线上房间鉴权。候选只列1–2步，未知路径标为条件。3秒探针用于验证超时保留原状态。服务重启会丢失当前进度，可显式导出全知研究回放；不要交给公平AI或生产存档入口。

## 验证与恢复

```sh
python3 -m unittest test006
python3 replay.py evidence/replay006-SECOND_ATTACK.json
```

回放包含起点、真实Actions、消费、后勤及实际步损。仅重放Core Actions会漏掉后勤伤亡，应使用以上适配层回放。`data/playable/`是六份新/旧模式可启动状态，历史 `data/recovered-attack-replay.json` 使用 EXP005 自动决策语义，须在固定 checkpoint 分支重放。test006 会生成 EXP006 完整回放 evidence/replay006-*.json；其固定合法起点、Action配方及哈希摘要在Git中。

`model.py`、`signature_model.py`、`route_signatures.py`、`bounded.py`、`network_model.py`与EXP004字节相同。改动集中在live.py/Core接缝/server/界面；Core差异见evidence/core-source.diff。固定来源db183c7733ae59d2f5a3bcb8f3f384357b7d59e6；未合并、未部署；远端同步状态见 HANDOFF.md。

可选重新编译：安装TypeScript 5.7.3，运行 `tsc -p core/tsconfig.json`。Git检出没有预编译产物，首次运行必须重建。`patch-core.py`是对干净基线应用差异的记录，不可对已经修改的src再执行。

浏览器复核需要获准的本地Playwright与Chromium：设置CHROMIUM_PATH后运行 `node browser006.cjs`。脚本在同一次执行环境启动loopback服务与浏览器。二进制不打包，也不为其他会话授予权限。

已保留：容量不足/未清走廊的失败救援、堆叠拒绝、增援阶段阻塞、测试脚本错误及浏览器移动端溢出修复记录。报告区分这些失败与最终通过证据。尚无真人试玩，不宣称平衡或体验已验证。
