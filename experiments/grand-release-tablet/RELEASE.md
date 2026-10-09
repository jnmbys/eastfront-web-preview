# 最新统一候选：最终私有预览发布单

状态：准备完成，未创建资源，未部署，未开放公网。只需一次费用与本人认证公网访问确认；不要求用户先访问localhost或完成平板验收。

## 固定版本与产物

游戏源码唯一固定为 **69c7b2a70e3a765fb2838489ea33c68f3434f557**，分支 grand-ui-003-r1-map-command，Leader已独立确认。此次准备分支 grand-release-001-tablet-preview 仅加入配置、检查与证据，不是另一套游戏；部署仍取上述游戏SHA。

干净工作树上 npm ci --include=dev 后使用 node experiments/grand-release-001/build.mjs 构建，未设置 RELEASE_SOURCE_SHA 绕过dirty检查。release-build.json: source对应上述SHA、dirty=false、规则GRAND-TERRITORY-1、存档GRAND-RELEASE-TERRITORY-1。554文件、17,965,422字节；资源清单摘要 c51513193add6b626a4ea548fa726c4a07380b22ef352d2cf5a48f2ab8ab8691。

本目录 .release-artifact/web-assets.zip 是已构建静态包，source-69c7b2a.zip 是完整Git源码归档；SHA256见 evidence/grand-release-tablet/CHECKSUMS.json。服务执行需要源码、npm依赖、构建输出，不可把静态ZIP单独放Pages冒称权威游戏。实际Render采用同一SHA重建，前后端同服务，不混用旧静态缓存。

构建（Linux/Render）：

```sh
test "$(git rev-parse HEAD)" = "69c7b2a70e3a765fb2838489ea33c68f3434f557" && npm ci --include=dev && node experiments/grand-release-001/build.mjs
```

启动：`node experiments/grand-release-001/server.mjs`。Node 22，健康检查 `/healthz`。配置 experiments/grand-release-tablet/render.yaml 已通过官方Schema；只用于审查，尚未apply。固定SHA检查会使错误版本构建失败，不能改环境变量冒充固定版本。

## 独立托管

- Render My Workspace（tea-daos1iugekts73erk8j0）；新增 eastfront-grand-private-preview，Singapore，单实例0.5c-512mb。
- 独立1GB持久盘 grand-release-campaign，挂载 /var/data；SAVE_DIR=/var/data/grand-release-territory-1。
- 拟用 https://eastfront-grand-private-preview.onrender.com，同域WSS /a/ws（本人第二端 /b/ws）；名称未预留，创建时检查。不需要用户自备域名。
- 当前基础增量$7/月实例+$0.25/月磁盘=$7.25/月；额外流量/构建/税费/工作区费用依实际套餐，不能称总账单固定$7.25。价格来源 https://render.com/pricing ，核查日期2026-10-09。既有两个服务均有用途，不能覆盖挪用。无付费扩容授权。
- 自动部署关闭；独立预览不是旧生产站更新。端口由Render PORT提供，HOST=0.0.0.0，仅平台HTTPS入口；PUBLIC_ORIGIN必须是实际根域，NODE_ENV=production，禁止RELEASE_LOCAL=1。

## 登录与持久化

唯一本人长随机口令登录，首局德军对苏军AI；第二端是本人共同指挥，不宣传德苏真人对战。发布执行时生成高熵口令，在安全交付位置交给本人；只把 password-hash.mjs 经标准输入生成的scrypt值写入Render秘密变量OWNER_PASSWORD_HASH。明文不入Git、命令行、构建日志或发布单。无需在本轮收集凭据。

页面、席位、存档信息和WS均需登录；健康检查只返回ok。精确Origin/Host、HttpOnly/SameSite、HTTPS Secure Cookie、12小时会话及连接/命令代次保留。服务重启需重新登录；不能放宽Origin或匿名席位排除接入故障。

存档 campaign.json，上一验证检查点 campaign.json.bak，新局前 campaign.json.before-new；校验和、fsync及原子替换。自动30现实秒或12模拟步（1游戏小时），手动保存与已接受配置命令落盘；失败显示失败并暂停。正常可写磁盘异常退出最多回到最近成功持久化点（名义30秒/12步加当前写入），不保证磁盘损坏不丢失。

全部断线暂停，静默断线由心跳约15–20秒检测；重连、加载、重启默认暂停，旧连接/请求不能重复生产扣费。旧模式格式拒绝，不迁移4255或旧生产存档；上线首次是独立暂停新局。

## 一次批准后的实际执行顺序

1. 再核对指定SHA可取，创建**新的**服务与盘，禁用自动部署，设置上述环境和秘密摘要；不调用旧Hook。固定commit部署，检查build manifest与本单一致。
2. 认证前检查页面/席位/WS均拒绝，健康检查可用；认证后检查HTTPS/WSS同域与版本。未通过先关闭新预览，不降低认证。
3. Worker完成：下军团目标、持续时间中直属连续指挥、调整一条生产线、查看补给/建设、保存、断线重连；重启服务后重新登录，核对时间/库存/任务/回执，默认暂停。实际公网延迟、队列、内存和TLS在此时记录，不套用本机结论。
4. 成功后给用户HTTPS入口与口令安全取用方式；用户平板一段连贯试玩：登录→继续→选队点地图确认→查看战斗→调整生产→保存→关闭重开。无需上线前先做本机验收。

## 关闭、备份、回退

先暂停并确认保存成功，经Render SSH/文件传输把 campaign.json、.bak、.before-new 导出到服务外；用 `node experiments/grand-release-001/save-admin.mjs verify 文件` 校验。暂停/停止**新服务**关闭试玩，不删除磁盘；保留磁盘仍可能计费。

代码回退指定上一个已验兼容SHA并配套其备份；首发失败可直接暂停新服务，旧生产不受影响。恢复必须停止新服务后执行 `node experiments/grand-release-001/save-admin.mjs restore 备份文件 /var/data/grand-release-territory-1/campaign.json --service-stopped`，保留.before-restore，再启动核对。不能运行中替换存档，不把新格式写回旧版本。磁盘服务发布会停机，不承诺零停机。

## 本次必要检查与边界

- 干净构建成功；最新平板指挥源码完整在包中，4255和用户存档未操作。
- 最新版本认证、Origin/WS拒绝、独立回执/重试、成功落盘才确认、有效备份、重启余额与命令序列、旧会话隔离、全部断线暂停、保存失败与损坏存档拒绝通过。证据 evidence/grand-release-tablet/check.json。
- 投降8组定向检查与WS重复/终局/重启检查通过；跨原120小时及七日继续，首都不直接判负、分母冻结、同时投降、夺回降低进度；无新胜负规则。
- 清洁/1000ms RTT/受限三组各约12秒模拟网络均连接存续，差量中位26–32KB、最大88KB，完整快照约916–930KB；观察下行约37–59KB/s。瞬时出站队列最大3包，结束快照0/0/1包；独立未确认回执1条，不能写成全都已清空。RSS约256MiB是本机测试进程，不证明512MB云实例长期容量。
- 沿用旧实际浏览器、持续三队和横屏证据；本次不重做用户采样。此次Windows本地HTTP协议检查不能替代Linux持久盘、HTTPS/WSS公网和物理平板结论；这些已纳入批准后的执行验收，不另起准备任务。

确认项：允许新增上述独立Render预览及1GB盘，接受基础增量约$7.25/月，允许仅本人认证后的公网试玩。其他旧服务、4255、旧存档不变。若创建价格/规格发生实质变化则停止该创建，不擅自超支。
