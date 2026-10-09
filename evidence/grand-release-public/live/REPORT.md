# 公开独立试玩上线记录

用户授权公开发布，并选择每位访客独立战役。部署源码 a88a697e1932556697bf1c1b66182c3efe9edf06（已远端核对）；此证据分支不触发部署，游戏来源仍固定原发布分支。

入口：https://eastfront-grand-preview.onrender.com
服务：srv-db46117lk1mc73ev50mg，Singapore，0.5c-512mb，自动部署关闭。
持久盘：dsk-db46deflk1mc73f0ik30，1GB，/var/data。用户完成控制台添加后由API确认；未取消挂盘保护。预计基础费用$7.25/月，其他用量按Render账单。

首次挂盘部署 dep-db46denlk1mc73f0ikm0；同源码重启验证部署 dep-db46eqjtqb8s73e8e7cg。无旧服务/4255改动。

实测公网HTTPS及WSS：公开首页可用；未持有访客凭证不能读战役；跨Origin注册拒绝；两个独立签名Cookie对应不同权威实例；A推进至tick7、B仍tick0；A断线暂停；重复SAVE未重复消费序列，跨战役命令拒绝。详见cloud-check.json。均为单独自动测试访客，不是用户体验或真机操作。

Linux构建报告source固定、dirty=false、554文件/17965422字节，摘要3079c1d3f4979e64d871c53a04f889445667db0fd428471d6c230aa68bf66f02。Windows本地产物摘要不同，不宣称跨操作系统压缩包逐字节一致。

浏览器控制工具在登录后、访问公网时仍超时；本次没有新浏览器截图，不能声称公网浏览器完整指挥或平板真机已验。沿用原本机交互证据；云端协议与落盘验证单列。

操作：打开HTTPS入口→开始独立试玩→进入战役→下令后继续时间。退出前暂停并保存；重开同一浏览器可继续。30天浏览器凭证，清Cookie/换浏览器不会自动找回；无跨设备账号同步。首轮最多同时载入2场，满员提示稍后重试；离线30秒卸载并保存。登记上限100个访客，非无限公网容量承诺。

备份应一并导出 /var/data/grand-public-1/visitor-key 和 visitors/；密钥不公开、不入Git。服务关闭使用Render暂停新服务，保留盘和备份；保留盘仍可能计费。回退先停新服务、备份，再恢复对应源码与兼容存档；不把新访客目录覆盖旧4255或旧生产存档。

实际健康路径/healthz可访问；Render专用healthCheckPath当前仍为空（平台默认端口探测），不冒称已完成面板自定义健康检查配置。
`n重启实测通过：部署dep-db46eqjtqb8s73e8e7cg已live。A tick7/nextSeq3，B tick0/nextSeq1，均暂停；同浏览器凭证恢复独立持久化局，详情cloud-restart.json。验证完成后测试连接已关闭，不占用持续作战名额。
