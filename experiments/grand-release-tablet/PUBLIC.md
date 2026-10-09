# 公开独立战役发布（取代原仅本人方案）

用户已批准直接公开发布，且明确选择访客各自独立战役。沿用原$7/月实例+1GB盘$0.25/月费用范围，不升级规格。原私人发布单保留作历史，不再作为本次访问模型。

游戏基线69c7b2a；新增仅为访客接入隔离：公开开始页签发随机签名HttpOnly/SameSite Cookie，每位访客独立权威Campaign、连接席位、回执账、存档目录。仍是德军对苏军AI，不是多人对战。跨实例、伪造凭证、跨Origin命令被拒绝。

浏览器凭证30天；同一浏览器可继续原局，清Cookie或换浏览器不自动找回。不提供帐号注册或跨设备同步。存档不公开下载。新模式未迁移4255任何数据。

计划服务eastfront-grand-preview，Singapore单实例512MB，自动部署关闭；同域HTTPS/WSS。启动node experiments/grand-release-tablet/public-server.mjs；构建沿用release-001/build.mjs。SAVE_DIR=/var/data/grand-public-1，REQUIRE_PERSISTENT_DISK=1，未挂载磁盘会拒绝启动，不在临时磁盘伪装持久化。

首次最多同时载入两局；满额明确提示稍后重试，不覆盖他人。无连接30秒后暂停保存并卸载；再次进入重载默认暂停。最多登记100个访客存档（首轮防磁盘无界增长）；名额满不删除旧局。每场仍使用原8包窗口、独立回执与代次保护。此容量不代表已通过公网多用户压力测试。

保存目录：visitors/<随机ID>/campaign.json、.bak、.before-new；根visitor-key保护浏览器身份。备份需把visitor-key和visitors目录一起保存到服务外，否则不能恢复已有Cookie与存档的关联；恢复时先停服务。不得公开这个密钥或把它写进Git。关闭只暂停新服务，保留盘。旧服务及4255不变。

定向HTTP/WS检查已证明两访客相互隔离，A推进不影响B、跨实例命令拒绝、重复不重复执行、重启两局各自暂停并保留回执。未宣称公网TLS或真机验收。内部保存的Campaign ID允许稳定；重启隔离由新的era/连接代次负责。

原本人认证入口保持原行为（releaseServer默认仍使用口令认证）；新入口只使用签名访客授权，不设置RELEASE_LOCAL绕过保护。

当前Render MCP可创建服务，但没有持久盘工具。控制台登录待用户完成；磁盘确认挂载前不得交付为已上线。未要求重新批准已同意费用。
