# EQUIPMENT-PUBLIC-GATEWAY-001 发布单（本地候选，未部署）

## 本批内容与版本

基于 `842d8cfe7a15db41e7b9eec7e964415ba4c3c9e2`，不吸收其他后续改动。产品已增加公网接入，**不再是0caa903**。最终源码SHA以本次交付、`git rev-parse HEAD`及 `/healthz.source` 三者一致为准；测试记录另外列出当时源码及是否有未提交改动。

统一入口 `/` 明确分为旧单人和新双人。旧 `/campaigns` 的legacy/division/combined仍使用各自原引擎；新 `/rooms` 创建本批装备优先级房间。UUID campaign仅进入房间网关，未知模式或多个campaign参数拒绝；不会默认为旧规则。

- 新规则：`HOI4-EQUIPMENT-PRIORITY-001-1`
- 房间封装：`HOI4-EQUIPMENT-PRIORITY-MP-001-1`
- 地图：`SMOLENSK-HINTERLAND-001-1`
- 外层保存封装继续复用既有校验和格式，内部房间/规则/地图标记均强制匹配；不迁移旧档。

## 实际构建和启动

```sh
npm ci --include=dev
node experiments/equipment-public-gateway-001/build.mjs
node experiments/equipment-public-gateway-001/server.mjs
```

在干净固定检出构建。`RELEASE_SOURCE_SHA`如设置必须等于真实HEAD，不能用它掩盖dirty。构建生成 `.release-territory-preview/release-build.json`，记录源码、dirty、资源摘要和规则。生产启动拒绝源码/构建/规则/地图不一致，拒绝dirty构建；healthz准确返回对应元数据，不以规则版本代替源码SHA。

| 环境变量 | 配置要求 |
|---|---|
| `NODE_ENV` | 生产使用 `production` |
| `PORT` | 平台提供的整数端口 |
| `HOST` | 平台监听通常 `0.0.0.0`，必须显式设置 |
| `PUBLIC_ORIGIN` | 唯一完整HTTPS origin，如 `https://eastfront-grand-preview.onrender.com`，无尾斜线/路径/查询 |
| `SAVE_DIR` | **保持原值**，历史为 `/var/data/grand-public-1`，执行前核实 |
| `MP_SAVE_DIR` | 独立已存在目录，建议 `/var/data/grand-equipment-mp-001`；不能放在SAVE_DIR内部 |
| `TRUST_PROXY_IPS` | 逗号分隔的可信直连代理IP精确清单；不得填通配符或客户端X-Forwarded-For。上线前依据实际平台接入确认；2026-10-12只读核对与缺项见N1-N4.md |
| `REQUIRE_PERSISTENT_DISK` | 生产 `1` |
| `PERSISTENT_MOUNT` | 当前部署方案 `/var/data`；须在Linux mountinfo中真实存在，两目录都在盘内 |
| `RELEASE_SOURCE_SHA` | 最终完整提交，可选但建议固定 |
| `TLS_CERT` / `TLS_KEY` | 应用自行终止TLS时的一对证书路径；Render终止TLS时不设置 |
| `LOCAL_PREVIEW` | 生产不设置；`1`仅允许127.0.0.1 HTTP，且生产环境拒绝此模式 |

公网必须满足：精确Host、精确Origin；WS及写请求必须有Origin。TLS卸载仅接受清单中直连代理且 `X-Forwarded-Proto` 精确为https，不接受逗号链；不相信客户端转发地址，不用转发Host覆盖真实Host。外层清除转发头后传入回环子服务，子服务继续校验同一公开Origin及自身身份。实际平台代理清单/转发行为仍须部署时核对，不能先放宽校验。

## 身份与存档保护

原 `grand_visitor`、原visitor-key和三类旧路径不变。新身份用 `equipment_mp_visitor`、MP_SAVE_DIR自己的visitor-key；席位会话继续按房间ID隔离。公网访客与席位Cookie均HttpOnly、SameSite=Strict、Secure；邀请只授权加入指定房间，后续HTTP/WS仍需签名身份、房间成员及席位会话；命令代次、版本及幂等仍由原权威接口检查。

新旧目录必须预先存在且可写，真实路径相等/嵌套、符号链接、相同密钥、已有存档缺密钥、错误规则/地图、损坏存档均失败关闭，不回落临时目录。启动占用 `.gateway-lock`，同目录不能再启动一份；正常SIGTERM/SIGINT等待保存后释放锁。异常退出遗留锁时必须先确认旧进程已退出，再人工移除该锁；不自动抢占仍存活的服务。

旧单人访客并发上限仍沿用现有2场，未连接的加载实例30秒后回收，BUSY不表示存档丢失。新多人沿用已有房间生命周期；本轮没有添加公开匹配、账号、游客配额或防滥用平台。这仍是候选预览，不宣称已完成不受限大规模公开运营加固。

## 离线备份与恢复命令

先维护停写、SIGTERM并确认进程退出，然后使用**新且不存在的备份目录**：

```sh
node experiments/equipment-public-gateway-001/backup.mjs create "$SAVE_DIR" "$MP_SAVE_DIR" /var/data/backup-equipment-YYYYMMDD-HHMMSS
node experiments/equipment-public-gateway-001/backup.mjs verify /var/data/backup-equipment-YYYYMMDD-HHMMSS
```

完整复制两目录下身份、三类旧档、rooms、新旧.bak及必要元数据，逐文件SHA256比对，拒绝带运行锁的源、目录重叠和链接。密钥/备份不进Git，不把历史启动日志算作最新备份。

恢复演练仅到**两个预先创建的空目录**：

```sh
node experiments/equipment-public-gateway-001/backup.mjs restore /path/to/backup /path/to/empty-legacy /path/to/empty-mp
```

恢复后校验摘要与新房间版本；启动统一网关会用各自引擎核对旧档。不会覆盖非空目录。测试全部使用合成目录，未读取线上密钥。

## 发布与回退

本轮未Push、未修改任何服务或代理配置，未部署。2026-10-12只读查询确认当前自动部署关闭、旧发布命令仍在，详情见N1-N4.md；`[CF-Pages-Skip]`不能保证Render不部署。用户最终批准后才核对当前Live SHA、实际目录、挂载空间、代理IP、Build/Start和触发方式，并手动部署固定SHA；不apply旧0.5核yaml，不增加服务/费用。

回退优先维护停写、保存当前新房间并校验备份，然后恢复旧公网源码及原启动方式、保持原SAVE_DIR。MP_SAVE_DIR完整保留，不交给旧引擎，不用旧备份覆盖玩家最新进度；需要重新开放新模式时使用本批兼容引擎。旧单人身份仍由原签名密钥识别。

## 部署后最短核验（尚未执行）

两台远程设备独立身份创建/加入同房，各自下令；第三身份拒绝，苏军可暂停不可继续，断线自动暂停并回原席。两端保存后记录房间及队列/在途摘要，**Restart service**，恢复原双方且默认暂停、再次保存；验证三类旧战役继续读取原进度。检查Linux持久盘写入、停机保存、TLS/WSS与实际代理行为。公网性能、物理屏幕呈现、平板真机不因本机协议通过而通过。

本地审阅入口：`node experiments/equipment-public-gateway-001/preview.mjs`（默认4302，仅回环；端口占用用PREVIEW_PORT指定空闲端口，不停止他人服务）。临时目录位置写入系统临时目录中的 `equipment-public-gateway-preview.json`；在其dir下写入stop文件可安全关闭。`RESTORE=1`重启同一临时局。此便捷入口不进入生产配置。

## N1/N4收口补充

干净检出须先执行上面的npm ci与build，再启动；构建入口已避免提前加载生成依赖。锁包含唯一owner及文件身份，清理只释放仍属于本次的锁；缺失/替换不阻止其他关闭操作，不自动抢占遗留锁。新增验证、实际托管只读结果与代理/Linux缺项见 [N1-N4.md](N1-N4.md)。4302仍保留原运行版本，不代表本次最终源码。N2/N3不扩展修改。
