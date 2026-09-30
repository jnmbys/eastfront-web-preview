# SUPPLY-VERIFY-016

2026-09-30。状态：**本机真实浏览器验收通过；现规格容器验证阻塞；未部署，不是生产完成。**

## 基线与环境

基线 `supply-integrate-015` / `a3346e4c34567811fb07652cb26b706833daa183`，独立分支 `supply-verify-016`。已读取 CONTRACT015、REPORT015、既有 012 限资源脚本和 013 部署证据。当前指定目录最初为空，无未提交修改可覆盖。固定提交完整递归树中没有 PROJECT_STATE、WORKER_PROTOCOL、AGENTS.md；已向用户询问准备环境的位置，未获补充。未假造这些文件的内容。

Git clone 两次连接重置；官方 codeload 固定提交归档下载成功。归档 `git add -f .` 产生的完整树等于远端 `5ddc4217f059a8f0e8da302e73d7e7fe31eb0b03`，再按远端 Git commit 元数据恢复对象，SHA 精确等于固定基线，建立浅仓库和独立分支。不是把自建快照冒称原提交。

复用 Node 24.19.0、内置 Python 3.12.14；项目依赖原本不存在，使用现有 lockfile 的 `npm ci --ignore-scripts --no-audit --no-fund`，项目 `.venv` 安装原锁定 numpy 2.3.5 / scipy 1.17.0（命中下载缓存）。未改版本、参数或超时。fixture 恢复输出 `All fixture and font hashes verified`，原 build.mjs 成功。没有规则或界面修复；新增内容仅本任务测试包装、报告、证据。

## 实际浏览器结果

入口 `http://127.0.0.1:8765/?supply=experiment`。使用 Codex 内置真实浏览器，1280×720；没有绕过 URL 策略，也没有改用伪 DOM 作为浏览器证据。

| 场景 | 实际操作和结果 | 证据 |
| --- | --- | --- |
| 新建、双方部署 | 新补给按钮建局；苏军 32/32、交接、德军 26/26，58 个单位全部真实点击位置和确认；完成阶段后进入德军补给/铁路 | 01–05 JPG；deployment-actions.json；deployment-final.txt |
| 装甲移动 | 合法检查点 75 加既有记录第一个 Action，revision 76；热座交德军；选择 G-PZ-01、开始移动、点 4,6、确认；3,6→4,6，库存 8→4，耗费 4，事务 0.5469263 秒 | 06 JPG；movement-ui.txt；movement-authority.json |
| 战斗与撤退 | 同一检查点加既有前三个 Action，revision 78；G-I-01 攻击 5,5；真实骰点 2+1=3，AR，库存 12→8；点 4,4 撤退并关闭结果，回到可继续战斗界面 | 07–08 JPG；combat-ui.txt；combat-authority.json |
| 推进和配送恢复 | 合法 checkpoint-66；选择 G-PZ-01 推进至 4,5；8 次原阶段按钮并正常热座交接；进入第2回合；切回德军查看实际回执，G-I-01 库存 8→12、欠账0；配送事务 0.6712692 秒 | 09–10 JPG；phase-actions.json；delivery-ui.txt；delivery-ledger-ui.txt；advance-delivery-authority.json |
| 旧模式与版本锁 | 关闭实验局后创建旧补给对照；真实部署 S-I-01；显示旧规则不扣实验库存。刷新后点新补给，明确拒绝“本局补给版本已锁定，不能中途切换。”；再点旧补给恢复，已部署仍在；离开等待成功回入口 | 11–12 JPG；old-mode-ui.txt；mode-lock-ui.txt |
| 默认入口 | 无 query 的 `/` 仍显示原新游戏/多人游戏入口；未开展多人测试 | 13 JPG；default-entry-ui.txt |

检查点分别由本地 `browser-fixture.py` 在 8766/8767/8768 加载，复用 015 verify-ui.py 的合法材料与 hash 断言；没有网络注入接口，不修改生产 Handler、投影、Core、execute 或 RNG。每个真实浏览器 Action 执行后，额外用冻结 execute 对之前状态执行同一条已接受命令，核对完整状态；参考执行耗时不算入产品事务耗时。13 条有记录的 Action（含旧模式一次部署）全部接受、完整状态相等、事务≤3秒，最大 0.6712692 秒。新局58次部署及2次结束部署另由可见UI验证，未声称其逐条完整状态对比。

初次定位中，AX 将 aria-pressed 按钮显示为 checkbox、summary显示为button，Playwright相应角色不匹配；读取实际DOM后采用原属性/文本定位成功。阶段脚本初次只识别“等待对方”，实际为“等待交接”，停住后按可见交接按钮继续。均为验收脚本定位问题，无产品代码修改。初次 about:blank 标签失效后，在同一内置浏览器创建新标签成功；未发生本地访问拒绝。

## 容器与剩余门槛

`docker version`：命令不存在；标准 Docker 路径不存在；WSL 未安装。无法在当前宿主运行 0.5 CPU / 512MiB 容器，未安装 Docker、未升配、未触发云测试。既有 `experiments/supply-ci-012/run.py` 仅针对旧沙盘上下文，不能原样运行后宣称验证本次主体镜像。本机健康检查200、实际配送和≤3秒记录保存在 environment.json；memory.peak 为空，**不能用本机数据或013旧镜像资源结果冒称新主体容器通过**。

没有重复全量回归；沿用015已有异常回滚/一致性证据。本次无故障注入、无Huawei真机/触摸验收、无完整战役或平衡验收。30分钟到期、重启丢局、无存档仍成立。Render只读工具提示未选workspace，因此当前服务配置未实时复核，未操作任何服务。

## 恢复和交付

本地运行服务为原 `experiments/supply-integrate-015/service.py`，只绑定127.0.0.1。PowerShell重启：设置 COOKIE_SECURE=0、BIND_HOST=127.0.0.1、PORT=8765、PYTHONUTF8=1、OPENBLAS_NUM_THREADS=1，再用 `.venv/Scripts/python.exe experiments/supply-integrate-015/service.py`。结束进程会丢失当前内存局；回入口重新建局，无存档恢复承诺。检查点仅供本任务包装复验，不向试玩者提供，也不是产品存档功能。

完整截图及UTF-8操作文本位于 evidence/，SHA256.json覆盖证据文件。发布差异和原版本回滚见 PREVIEW_PLAN016.md；仅准备，未执行。任务状态见 TASK_STATE016.json。远端保存使用 `[CF-Pages-Skip]` 提交到独立分支；不创建PR，不改main/source-main。
