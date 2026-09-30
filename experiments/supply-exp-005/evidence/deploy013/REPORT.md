# SUPPLY-DEPLOY-013：现有独立沙盘更新及线上验收

结论：固定候选已上线，当前验收无阻断，未执行回滚。真实入口 https://eastfront-supply-sandbox.onrender.com/ 。华为由用户自行打开验收，本记录不代称通过。

## 版本、部署与隔离

- Git受测源码：`aca1f4b9801ab7b7c7073ac7973bb028cd6df435`。
- 准备依据：`47ed24963a572d4e57315cf64da2ea1ecd093d77`；本交付分支 `supply-deploy-013` 仅保存证据，不移动运行源码、main/source-main。
- 新部署：`dep-dauattnavr4c738ergg0`，2026-09-30 06:40:54 UTC开始，06:41:42 UTC live；应用ready日志06:41:39 UTC。48.73秒是包含构建的部署时长，不称纯启动时间。
- 当前Render实例：`srv-dathekek1f9s7389ksvg-54dd656f5b-mt6g5`。部署元数据commit及实例环境RENDER_GIT_COMMIT均等于固定SHA；online.py、verify012.py的SHA256与Git文件一致。
- 服务仍是 `eastfront-supply-sandbox` / `srv-dathekek1f9s7389ksvg`；0.5c-512mb、Singapore、单实例、autoDeploy=no/off、PR预览off、无数据库/磁盘/生产Secrets/WSS。没有新建服务、升配、改正式游戏、调用Hook或创建PR。
- 分支改为 `supply-campaign-012`，但手动 **Deploy a specific commit** 选择的是 aca1f4b9，不是该分支文档HEAD。环境唯一新增 `ENABLE_CAMPAIGN=1`，先Save only，再固定SHA部署。
- 根目录 `experiments/supply-exp-005`，原Dockerfile，Docker Command仍为空，实际CMD `python online.py`，原同源PUBLIC_ORIGIN及Secure cookie保持。
- 沿用原计算服务；没有费用/规格变更。历史报价$7/月和工作区共享构建/出站额度关系保留，本轮未读取新账单，不声称新发生的构建/带宽用量免费。

## 实际Render实例内检查（并非CI推算）

`target013.py`是Web Shell中执行的包装；下载固定SHA中的两个既有研究检查点文件并校验SHA256，直接运行镜像中未修改的 `verify012.py`。它另起一个私有loopback测试服务，复用线上同一Handler/Action/solver，在实际Render容器资源限制下运行。**不是往公网会话注入状态，也不把这个私有测试进程冒充公网服务PID。** 公网API独立验证见下一节。

| 检查 | 结果 |
|---|---|
| 实际限制 | cpu.max=50000 100000；memory.max=536870912；memory.swap.max=0；pids.max=75478 |
| 首次观测峰值 | 139366400 bytes；已含页面访问/测量，不是纯启动峰值 |
| 四个有状态检查点会话时累计峰值 | 316731392 bytes |
| 整个目标验证累计峰值 | 390057984 bytes = 372 MiB |
| 代表性配送 | 原合法checkpoint117→128，11个真实Action，11个hash与011相同，T6→7实际配送 |
| 配送事务时间 | 2.12475秒；对应loopback HTTP含投影共3.15024秒，后者不是事务预算 |
| 其他10事务 | 0.91870–1.10408秒 |
| 预算和回滚 | 正常3秒；真实Core接受后注入延迟，超时整笔回滚，Core/RNG/seen/journal完全不变 |
| 会话与忙碌 | 四会话隔离、第五席503、持锁时另一会话503未提交、重置隔离通过 |
| 过滤 | G/S只返回本方单位，隐藏Core/journal/random，/replay为404 |
| 内存事件 | low/high/max/oom/oom_kill/oom_group_kill均0；测试退出0 |

峰值包括主服务、验收Python/Node/solver、Web Shell和检查点副本；不声称为纯服务峰值。测试结束后该验收进程已退出，未留下第二个长期服务。没有扩大CPU/内存或预算。

原verify012的scope固定字符串还写着“not full campaign or Render validation”，本次未修改该脚本文案；外层实例信息、cgroup读数、Render日志时间和实际执行入口明确本次是在Render执行的针对性验收，仍不代表完整战役重跑。超时为明确故障注入，不冒充自然负载超时。

原始结果 `render-target.json`；由实例stdout写入Render日志后用插件提取保存，时间为06:44:09 UTC。研究文件只在实验容器临时磁盘中，在线白名单不公开它们。

## 公网HTTPS服务检查

`http013.py`在该实例中请求实际公开HTTPS域名，走TLS和正式服务的cookie/Origin入口，并非localhost端口；不向公网接口注入任何权威状态。

- HTTPS /healthz就绪；会话cookie具备Secure、HttpOnly、SameSite=Strict、Max-Age=1800。
- 复用原011前60个Action：苏军32单位、READY、德军26单位、READY。全部接受，到revision60、T1 GERMAN_SUPPLY_RAIL，证明双方部署完成并进入战役；没有继续重跑整局。
- prepare、isolation各2个END_SIDE，restore一次修路及2个END_SIDE；共7个Action，三个片段各完成一次真实配送，均无错误。
- 三个短片段配送HTTP耗时2.462、2.530、2.447秒，是从Render发起的公网请求耗时，不代表华为校园网延迟，也不是单独求解器时长。
- 旧补给prepare重置通过；最后重置回新补给完整战役revision0。全部正常请求携带3秒预算。
- 原始逐次时长、错误字段、最终阶段及cgroup读数保存在 `https-results.json`。不是旧009/012 CI结果的复述。

## 浏览器与错误日志

真实Chrome打开实际HTTPS站点，默认完整战役、中文四项引导、苏军部署及可选格位显示正常。点“部署选中单位”，S-I-01实际置于K5，储备3/4补给点、欠账0，页面无行动错误。截图 `live-campaign.jpg` 保存的是该次真实结果。

切换“备货后推进”并重置，原中文引导显示，战役部署面板隐藏；随后恢复新完整战役revision0。`browser.json`、`browser-clip.json`保存观察。华为触控、真人体验与平衡仍未验。

部署后error级日志只有两条我们主动输出的DEPLOY013结构化验收结果；Render将其中error字段/预期超时文字识别为error级，两条报告本身均passed=true。没有其他服务error记录。Chrome控制台出现扩展content-script的metadata发送错误，URL为chrome-extension://，不是沙盘脚本异常；原记录保留。没有隐去预期超时或将这些日志直接当作服务失败。

metrics.json.gz保留平台采样，其中旧实例有滚动交接尾样本；instance_count一直为1，当前实例cpu_limit=0.5、memory_limit约512MiB。以实际cgroup memory.peak记录峰值，不用平台分钟采样最大值代替。

## 回滚记录与保留限制

部署前版本 `9cf0e5fb7fac27e16b2700559716b590e81957b7`、成功部署 `dep-dathfiuk1f9s7389ono0` 已确认，入口：
https://dashboard.render.com/web/srv-dathekek1f9s7389ksvg/deploys/dep-dathfiuk1f9s7389ono0

本次未发生阻断，**没有实际执行回滚**。如后续失败，只在此实验服务Deploys回滚上述旧部署，删除或设0的ENABLE_CAMPAIGN，保持原规格/单实例/自动部署off及原CMD。必要时恢复服务分支supply-render-candidate并手动固定原SHA。不能回滚则Suspend本服务；不改生产，不升配。此次重启清除内存会话已获用户授权。

继续保留：自然战役“非零库存战斗消灭”尚无自然覆盖（012仅受控接缝）；未重复完整自然终局；30分钟cookie寿命/空闲期限、1000动作/6MiB阈值；无存档，刷新过期、重启、更新会丢局。反馈导出不等于可恢复存档。本轮创建的两个公网测试会话将自然过期，测试未占满四席。

平板三步：①打开链接，保持完整战役/新补给/苏军；②在部署面板选单位和格位，点部署，分散放置以满足堆叠；③全部部署后结束阶段，切当前行动方继续，离开前导出反馈。优先在30分钟内完成一次短试玩，不承诺长局存档。
