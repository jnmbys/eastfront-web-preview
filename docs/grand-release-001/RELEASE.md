# GRAND-RELEASE-001 发布单（尚未上线）

基线 `2a6580bccc86c8d14e75bff81847092c71066bfe`。分支 `grand-release-001-preview`。本单所属最终提交是候选源码；构建目录内 `release-build.json.source` 必须与发布选定的完整 SHA 一致，dirty 必须为 false。没有修改战斗、经济、军官或视野规则。最终干净提交构建产物另存本工作目录 `.release-artifact/web-assets.zip` 与 `CHECKSUMS.json`；Git 中 `build-files-precommit.json` 明确只是提交前诊断构建，不作为发布版本。

## 本机试玩

正常入口 http://127.0.0.1:4245/ ，真实中期入口 http://127.0.0.1:4246/ 。仅本机环回监听；两局隔离，进入默认暂停，德军对苏军 AI。同账号第二端也是共同指挥德军，不是双方真人对战。

从本工作目录启动：`pwsh -File experiments/grand-release-001/start.ps1`（端口占用即拒绝，不替换其他服务）。关闭前点击暂停、保存，看到“已保存”后执行 `pwsh -File experiments/grand-release-001/stop.ps1`；仅核验并停止本候选进程。已启动时无需再运行启动脚本。

存档在 `%USERPROFILE%/.eastfront/grand-release-001/4245`、`4246`。旧 4243/4244 与存档原样保留；回退直接使用旧入口，不将新格式文件复制到旧服务。地图细化仍可在设置中关闭。

## 五分钟操作卡（一次连贯试玩）

1. 进入/继续游戏；需要新局时点“新游戏”，阅读覆盖提醒后确认。
2. 底部选军团，指定任务与目标、委托执行；顶部继续，观察行动后暂停。
3. 点“军厂”，展开一条已启用生产线调整；零工厂项目在“未启用／添加生产线”。国家库存每类只列一次。
4. 点车辆或待办查看补给瓶颈，切换建设，定位真实对象。普通远景设施按城市汇总，放大或进入补给图再展开。
5. 保存至出现成功时间；设置中短暂断线重连/读档，确认时间、任务与生产保留，再继续。

桌面与 1024×768 横屏已检查。上述也是后续手机/平板的一张操作卡；本轮没有 Huawei/iPad 真机或趣味性验收。

## 拟用托管资源与费用

已按本人授权只读查看 Render My Workspace（tea-daos1iugekts73erk8j0）。已有 eastfront-supply-sandbox（srv-dathekek1f9s7389ksvg，旧补给 Docker 分支，手动部署）和 eastfront-server（srv-daouf0lg1s2s738nnqbg，source-main，自动部署）均为 Singapore、单个 0.5c-512mb。它们不是空闲资源，不覆盖。API 返回未确认磁盘详情，不能把“未列出”当成“无磁盘”。

拟新增 **eastfront-grand-private-preview**，Render 原生 Node 22 Web Service，单实例 0.5c-512mb，独立 1GB 持久盘。拟入口 `https://eastfront-grand-private-preview.onrender.com`，WSS 同域 `/a/ws`（本人第二端 `/b/ws`）；名称可用性要在批准后创建时确认，尚未预留。静态资源和权威战役由同一服务提供，无 Windows 常开依赖、无临时隧道。

2026-10-08 官方价格：实例 $7/月 + 磁盘 $0.25/GB/月，拟增量 **$7.25/月**，另计适用流量、构建、税费及工作区套餐费用，最终以创建界面为准。现有资源不能在保留旧进度的前提下免费充当该新服务。测试进程 RSS 约349MB，包含测试开销，512MB仅为首轮候选规格，尚未经 Linux/Render 持续运行确认，不预先扩大规格。

依据：[定价](https://render.com/pricing)、[持久盘](https://render.com/docs/disks)、[WebSocket](https://render.com/docs/websocket)。配置 `experiments/grand-release-001/render.yaml` 已通过官方 JSON Schema 本地校验；仅供审查，未 apply。本候选只提供上述原生 Node 部署路径；未安装 Docker，因此不把未测试容器作为发布产物。

## 发布执行单（本轮没有执行）

1. 批准公网本人访问及上述新增费用后，在该工作区创建新的单实例服务和独立磁盘；不调用任何旧 Hook，不改旧服务。
2. 固定本分支完整 SHA，关闭自动部署。构建 `npm ci --include=dev && node experiments/grand-release-001/build.mjs`；启动 `node experiments/grand-release-001/server.mjs`；健康检查 `/healthz`。Render TLS 终止后内部 HTTP，浏览器使用同域 HTTPS/WSS。
3. 环境：NODE_VERSION=22、NODE_ENV=production、HOST=0.0.0.0；PORT 由平台提供；PUBLIC_ORIGIN=实际 HTTPS 根域（无末尾斜线）；SAVE_DIR=/var/data/grand-release-001。**禁止设置 RELEASE_LOCAL=1**。OWNER_PASSWORD_HASH 通过秘密环境变量设置，值为 scrypt salt:hash。用 `password-hash.mjs` 从标准输入生成，禁止将明文口令放命令行、Git、日志或报告。由本人保管唯一长访问口令。
4. 入口静态页面、存档信息、席位和 WS 均经本人认证；仅健康检查公开且无状态。保留准确 Host/Origin、HttpOnly/SameSite/HTTPS Secure Cookie、12小时会话、席位与命令代次、8包状态窗口、独立回执。没有匿名席位、没有苏军真人入口。
5. 检查构建 manifest 的源码/规则/存档版本和资源哈希；登录后进行操作卡一次连续试玩。确认 WSS、权限拒绝、持久盘重启、断线暂停、延迟与流量实际指标；公网与真机结论在此之前均未完成。
6. 出现异常先暂停并保存，停新服务即可关闭试玩；导出存档与备份后再做版本回退。带磁盘是单实例有停机发布，不承诺零停机。不以删除磁盘或服务作为常规关闭方法。

## 存档、备份与恢复

新存档包装 `GRAND-RELEASE-1`，游戏规则仍为 `GRAND-ECONOMY-2`。保存完整战役、RNG、经济/在途状态、命令与防重复账。旧格式明确拒绝，不静默迁移。保存采用校验和、临时文件写入/fsync/原子替换；Linux 同步目录；`.bak` 留上一个已验证检查点，`.before-new` 留创建新局前备份。

自动保存为每30现实秒或12模拟步（1游戏小时）脏状态写入；手动保存及已接受配置命令立即写入。正常可写磁盘下，异常退出最多回到最近检查点，名义间隔不超过上述阈值（加一次进行中的写入）；不是承诺磁盘故障仍不丢数据。写入失败会显示错误并暂停，不伪报成功。显示的时间为已落盘时间。

显式全部断线立即暂停；网络静默失联由心跳检测，最迟约15–20现实秒后暂停。重连不会自动继续。重启/加载默认暂停、更新实例/连接/命令代次，旧请求不能重复生产或扣费。

备份：先暂停、保存成功，通过 Render SSH/文件传输下载 `campaign.json`、`.bak`（如有 `.before-new` 也保留）；另存到服务外，平台磁盘快照不能代替这份应用级备份。读写存档不走公开下载接口。

校验：`node experiments/grand-release-001/save-admin.mjs verify 文件`。恢复：先停止本候选服务，`node experiments/grand-release-001/save-admin.mjs restore 备份文件 目标campaign.json --service-stopped`，保留 `.before-restore`，再启动、登录、核对时间和库存。工具中的停止声明由操作者保证，不能在运行中替换。回退代码时配套相同规则/格式的备份；旧 ART 服务仍用自己原目录。

## 待发布时一次确认

具体需确认的是：**新增上述 Render 独立服务＋1GB盘、允许仅本人经认证公网访问、接受约$7.25/月基础增量费用**。无需再选择另一种架构或先提供账单。创建时若域名被占用再确认替代名称。当前没有公网入口，未创建资源，未部署。
