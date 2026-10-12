# Render平台模式增量（待独立审查，未部署）

基线2e1dd842b68d6a42807f4b78e77a7d664f411f68，开始时工作区干净。仅接入模式、最小健康响应及测试变化；保留N1锁归属、N4构建顺序，不改规则/身份/存档，不创建线上MP目录。

## 边界与依据（2026-10-12查阅）

- [Web Services](https://render.com/docs/web-services)：公网HTTPS由平台终止并通过HTTP转发，应用主端口不直接向公网暴露。Render模式据此接受平台HTTP入站，不再要求固定代理IP。
- [Private Network](https://render.com/docs/private-network)：同工作区同地区服务可经私网访问主服务，10000也路由到主HTTP入口。**私网服务不是受认证的玩家或可信反向代理**。本模式不能区分一个伪造相同Host/Origin/转发头的私网客户端与公网代理；对两者都执行完整应用身份与权限检查。可公开创建访客的入口仍是公开的，私网来源不会因此拥有他人房间。运维须保证工作区、代码、环境和私网基础设施受控，客户端只从HTTPS域名携带凭证；不宣称能抵御已控制运行环境或窃取有效凭证的攻击者。
- [Authentication and authorization](https://render.com/articles/how-to-implement-authentication-and-authorization)：传输HTTPS、签名身份和资源授权是不同层次。本项目继续复用已有签名Cookie、房间成员、席位、连接代次和权威请求校验；没有增加账号/Redis/收费资源。
- [Default environment variables](https://render.com/docs/environment-variables)：RENDER、SERVICE_TYPE、SERVICE_ID、EXTERNAL_HOSTNAME/URL及PORT仅用于误配置检查，任何环境标志均不是请求凭证。
- [Health Checks](https://render.com/docs/health-checks)：平台有TCP探测及可配置HTTP GET探测。业务入口不能为探测放松校验，因此Render模式提供独立精确 `/readyz` 的GET/HEAD，只返回 `{ok:true/false}`，关闭时503；不发Cookie、不返回版本/目录/房间、不代理业务。带查询、POST、WS均不享受此例外。

## 精确启用配置

默认 `INGRESS_MODE=strict`（不设置也为strict），继续直接TLS或精确 `TRUST_PROXY_IPS`；即使存在RENDER环境也不会自动切换。直接TLS和旧精确代理行为保留。

本服务正式授权后拟用：

```text
INGRESS_MODE=render
NODE_ENV=production
HOST=0.0.0.0
PUBLIC_ORIGIN=https://eastfront-grand-preview.onrender.com
SAVE_DIR=/var/data/grand-public-1
MP_SAVE_DIR=/var/data/grand-equipment-mp-001
REQUIRE_PERSISTENT_DISK=1
PERSISTENT_MOUNT=/var/data
RELEASE_SOURCE_SHA=<最终固定完整SHA>
```

PORT沿用平台值；TRUST_PROXY_IPS、TLS_CERT、TLS_KEY、LOCAL_PREVIEW不设置。平台自动提供的RENDER必须为true、RENDER_SERVICE_TYPE为web、RENDER_SERVICE_ID为有效srv-标识、RENDER_EXTERNAL_HOSTNAME等于PUBLIC_ORIGIN主机、RENDER_EXTERNAL_URL等于PUBLIC_ORIGIN、PORT与监听端口一致。生产禁止端口0。冲突模式或缺失/不一致字段启动失败。首版显式限定服务自身onrender域名；自定义域名不静默放行。

健康检查路径拟设 `/readyz`。当前平台配置未变更。现有构建/启动命令仍按RELEASE.md，单实例，不启动多个worker。

业务要求实际Host精确一致，写请求/WS必须有精确Origin；任意请求如携带Origin也必须匹配。Render业务请求要求X-Forwarded-Proto单值https作为接入一致性检查，**不是身份判断**；伪造此头仍不能读别人的房间。转发Host若存在须一致，但不用于覆盖Host。X-Forwarded-For/Forwarded不提供权限，也不构造URL。传给回环子服务前清除所有转发头。邀请以配置的PUBLIC_ORIGIN生成，Cookie保持host-only、Secure、HttpOnly、SameSite=Strict。

## 本轮增量验证

`render-boundaries.mjs`：平台配置缺失/冲突拒绝；健康GET/HEAD最小响应及业务隔离；错Host/Origin、协议多值、伪造私网转发头；内部子服务实际收不到转发头；Render标志不自动启用模式；strict精确IP允许/拒绝保留。

`render-check.mjs`：临时TLS终止代理+HTTP上游，两个签名身份通过WSS进入同房并各下己方命令；第三席、其他房间读取/席位、外方命令、错Origin、旧身份误用拒绝；Secure/HttpOnly/SameSite/无Domain、邀请域名固定；双方连接、断线暂停、同身份重连、SAVE、实际临时进程退出重启、同一状态摘要与成员恢复、默认暂停、再次保存。无推进工业或长期招募测试。`INGRESS_TEST_MODE=strict`复用同一短流程检查直接TLS→精确IP代理重启。

复跑：先按发布单构建，然后执行以下命令；证据路径参数应使用新目录，勿覆盖历史结果。

```text
node experiments/equipment-public-gateway-001/render-boundaries.mjs <新结果路径>/boundaries.json
node experiments/equipment-public-gateway-001/render-check.mjs <新结果路径>/protocol.json
# 第二次进程环境设置 INGRESS_TEST_MODE=strict 后执行同一render-check
node experiments/equipment-public-gateway-001/closeout-check.mjs <新结果路径>/closeout.json
```

本地Windows/Node24、明确合成平台环境、测试CA、回环临时端口及合成存档；不是浏览器、实际Render或Linux恢复验收。所有临时服务退出，无邀请或身份密钥进入证据。最终被测源码见各JSON，证据提交与运行代码提交分别注明。

## 发布前事实与上线后必验

用户提供的只读输出确认 `/var/data` 为ext4 rw持久盘，余量699MB；旧SAVE_DIR realpath一致且当前用户可读写。这不是新房间写入恢复证明；MP_SAVE_DIR仍未创建，仅正式授权后处理。历史N1-N4固定代理IP缺口由本次显式平台模式替代；该历史报告不删除或改写成已通过平台验收。

上线后必须经真实公开域名检查HTTPS跳转、Secure Cookie、WSS升级、双身份命令/越权拒绝、断线暂停、同身份重连；核实平台实际提供单值https转发元数据，若不一致先诊断，不放宽Host/Origin。检查 `/readyz` 成功且业务仍鉴权，再完成Linux新目录实际保存、Restart service、同一身份/房间恢复默认暂停和再次保存。不得用Deploy代替Restart、历史备份代替最新备份。必要回退保留MP目录，旧引擎不得读取新房间。

本轮未Push、合并、部署、查询/修改公网配置或写线上存档，未重启4302。N2/N3其他限制继续保留，待DeepSeek仅审查代理增量。
