# 本批发布说明（待审，未授权执行）

后续接入实现在 `docs/equipment-public-gateway-001/RELEASE.md`。本文件保留上一轮固定候选的历史判定；不将其“没有公网启动命令”结论当作新接入候选的当前状态。

## 固定对象

- 产品候选：`0caa903579a33be35c00ef0097129c1b9666e4be`。本次证据提交仅新增实验与文档，运行产品无修改。
- 单人规则/存档：`HOI4-EQUIPMENT-PRIORITY-001-1`；多人封装：`HOI4-EQUIPMENT-PRIORITY-MP-001-1`；地图：`SMOLENSK-HINTERLAND-001-1`。
- 构建：`npm ci --include=dev`，随后 `node experiments/hoi4-equipment-priority-001/build.mjs`。
- 已构建600个资源，18558272字节，资源SHA256 `eb2dbb9c1224298bf7689f9cdfa152dc18f413de404eac4da0d106baa0d31b33`。本次manifest的dirty=true来自未提交测试文件，未掩盖该标记；与固定候选的既有资源摘要一致。正式发布必须在干净固定检出构建，再核对源码及摘要。

## 上线阻断，不能拿旧命令替代

当前 `experiments/grand-release-002/server.mjs` 只注册 legacy、division-002、division-003，**不会启动本批新规则**。当前 `experiments/blackice-mp-001/server.mjs` 的 Host/Origin、监听地址、访客Cookie及房间说明为本机用途。`experiments/hoi4-equipment-priority-001/server.mjs` 也只启动本机单人实例。

因此本候选**没有可直接交给Render的统一公网启动命令**。本轮的双回环测试代理不允许部署，不可把 localhost Origin 替换/放宽检查作为解决方案。发布批准本身不能消除此缺口。

最小接入范围已经确定，尚未实施：在同一HTTPS入口为“旧单人战役”和“新双人房间”显式分流HTTP/WS；新网关参数化唯一公开Origin、监听平台PORT并设置Secure Cookie；两套身份Cookie格式及签名密钥独立，既有访客不转换；每条房间请求仍校验成员、席位、代次和版本。使用本批CampaignClass与roomVersion，不让默认旧类接管新档。接入后只需重跑本报告相关隔离/恢复检查以及HTTPS/WSS边界检查，不需要重做玩法。

这属于实际发现的发布接缝，而非已完成能力。为保留固定候选，本轮没有将安全网关改造伪装成配置调整，也没有生成不可运行的生产配置。**当前发布判定：暂停放行。**

## 保存与旧局保留方案

沿用历史发布资料的服务 `srv-db46117lk1mc73ev50mg`、域名 `eastfront-grand-preview.onrender.com`、新加坡单实例1核/2GB及 `/var/data` 持久盘；这些是历史记录，本轮按约束没有查询或操作公网，实际规格/费用/线上SHA须发布时只读确认。禁止apply旧yaml中的0.5核配置。

| 数据 | 保留位置/策略 |
|---|---|
| 原访客身份 | 现有 `SAVE_DIR/visitor-key`，不覆盖、不改格式 |
| 三类旧单人局 | `SAVE_DIR/visitors/<id>/campaign.json`、`division-002/campaign.json`、`division-003/campaign.json`，原引擎读取，不转换 |
| 新双人房间 | 建议独立 `MP_SAVE_DIR=/var/data/grand-public-1/equipment-priority-mp-001`，自己的visitor-key及 `rooms/<roomId>/campaign.json` |
| 新单人模式如保留 | 单独模式ID和子目录，不能用新CampaignClass读取原文件；本轮未完成公网注册 |

新房间的两个访客绑定在同一权威存档中；邀请只用于指定房间加入，不充当长期身份。创建新模式不得替换旧访客战役。旧单人凭证与本地MP凭证格式不同，不能把两者直接共用或改名复用。

## 备份、执行与回退顺序

1. 用户明确批准且上述接入完成后，固定最终**代码**SHA（如接入有改动，不再称0caa903），干净构建；源码/前端/权威规则一致。当前无Push，不能假设托管端已能取到本候选。
2. 只读核实实际SAVE_DIR、磁盘挂载/余量、服务规格、Build/Start、自动部署开关和当前Live SHA。历史记录为自动部署关闭，但本轮未核实；`[CF-Pages-Skip]`不等于Render禁止部署。GitHub当前所见push检查workflow不是生产发布授权。
3. 在维护窗口阻止新写入，现有进程完成安全保存并停止；对当前目录做带时间戳的独立备份，覆盖旧访客密钥、全部旧模式、新房间密钥/rooms以及保存备份文件。生成逐文件SHA256清单、复制后逐项复核，并用对应引擎只读验证存档。旧 `grand-release-002/backup.mjs` 只认识旧visitor文件，不能单独充当新房间备份；历史启动日志不是最新进度校验。
4. 不改费用/实例/盘。手动部署固定提交，先核验启动版本和持久盘写入，再放行测试访客。无持久盘或格式不匹配须失败关闭，不降级到临时目录。
5. 身份隔离、保存或旧局兼容失败：立即关闭新房间入口和新建操作。停新网关保留其最新目录，旧模式回到发布前固定SHA。**不把旧备份覆盖玩家最新进度，不让旧引擎读取新档**。再启新模式必须使用能识别本批格式的兼容代码。

本轮没有执行以上公网步骤。Linux目录、TLS、WSS和磁盘备份恢复尚未实测，不能从Windows临时目录结果外推。

## 放行后远程双人最短核验

两台设备/独立浏览器：A创建德军房间，B用邀请加入苏军；两席齐全房主开始且初始暂停。各自下己方合法命令；B可暂停不可继续；A继续。确认敌方隐藏单位/私人队列不可读取，第三访客不得占席。B断网触发暂停，原身份恢复原席位；双方保存。

记录同一房间关键进度与保存摘要，执行 **Restart service（不是Deploy latest）**；两人原身份回到同一房间，默认暂停，地图/队列/在途/优先级/部署记录一致并能再次保存。然后验证“继续原战役”仍读取原进度。短测远程回执与浏览器操作另报，不拿本机数值代替。真机触屏和持续绘制继续单列未验。
