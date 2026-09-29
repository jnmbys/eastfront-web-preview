# SUPPLY Render 线上验收与发布记录

固定源码：9cf0e5fb7fac27e16b2700559716b590e81957b7。发布分支 supply-render-candidate 直接指向该提交；证据保存在 supply-ci-009，不移动运行分支。原Dockerfile、Core、RNG、规则及3秒预算未修改。

URL：https://eastfront-supply-sandbox.onrender.com
Service：srv-dathekek1f9s7389ksvg；Singapore；0.5c-512mb；单实例；autoDeploy=no/off；PR previews关闭；健康检查/healthz；无磁盘/数据库/生产Secrets/WSS。

## 版本与启动修正

首次部署 dep-dathekuk1f9s7389kvog 构建成功，但Docker Command包装的引号解析使启动返回127。保留失败日志，不隐去。移除包装，恢复Dockerfile原CMD python online.py；设置PUBLIC_ORIGIN为实际分配的HTTPS URL。通过冻结发布分支和部署元数据核对SHA，不再宣称包装在运行时检查SHA。

第二次部署 dep-dathfiuk1f9s7389ono0 于2026-09-29T01:44:15.599688Z变为live，耗时36.01秒（含缓存构建，不是冷启动耗时）。应用ready日志01:44:12.084282449Z。实际基础镜像digest与CI记录相同，Render最终镜像ID未由接口提供，不能填入CI镜像ID冒充。已部署镜像由Render内部保存，未发布公共registry。

## 费用与边界

创建页实见$7/月、0.5CPU、512MB，未升级。实际部署位于用户已登录且批准的My Workspace，与现有生产服务所在工作区共享构建/出站额度，不能声称工作区级费用隔离。新服务计算独立，不连接或修改生产服务；用户报告当前Hobby 192MB/5GB、8/500分钟、抵扣$0，本轮构建将增加用量。计算费按运行时间结算，最终账单及税/超额尚未出具。

创建时2026-09-29T01:41:37.537554Z。计费以Render账单为准；本记录不声称失败构建或短时实例一定免费。

## 测量方法

online-check.py复用experiments/supply-ci-009/run.py的HTTP测试，仅将目标改为真实Render HTTPS，禁用Docker取峰值并记null。内存改用该运行实例Web Shell读取cgroup v2，不用CI数据代替。独立cookie会话、同动作序列、同3秒预算，三个片段prepare/isolation/restore各重复3次。所有HTTP耗时包含执行环境到Render的公网/TLS时间，不等于引擎求解耗时，不代表华为校园网。

同容器cgroup读数包括Python、Node及测量用Web Shell/Python进程。memory.max=536870912；cpu.max=50000 100000；memory.swap.max=0；pids.max=141138（与CI的128不同）。启动后首次观察峰值116473856bytes，非精确纯启动阶段峰值。

## 关闭与撤销

在Render控制台选中本服务ID → Settings → Suspend Web Service，停止该实验服务；关闭自动部署不会停止计费。永久撤销可在同页Delete Web Service确认实验服务名称。停止前导出反馈，内存会话不能跨重启保存。已发生计算/构建/出站费用不会被撤销。

后续版本若有已验成功部署，可在本服务Deploys选择该历史部署Rollback；不得切换生产服务。首次失败没有可回滚的CI公开镜像。性能不达标时暂停，不自动升级或放宽预算。

## 实际 Render 验证结果

实际实例 cb477d778-g9fmw 内运行原 CI009 HTTP exercise，请求真实公网 HTTPS 地址（并非模拟/localhost），2026-09-29T01:53:36.549627Z结束。三个片段各3次全部完成，共39次接受动作、18次真实配送结算。四会话、重置隔离、0.001秒探针超时不提交、忙碌拒绝不提交、完成后重置均通过；并发状态为503/503/503/200。正常事务保持3秒，未修改求解器。

真实cgroup累计峰值240087040字节（228.96MiB，含Web Shell和测试客户端），memory.events全部0，无OOM。观察到的结算HTTP样本约2.21–2.74秒，包含HTTPS开销，并非精确求解器计时或完整样本的统计极值。不是CI推算。原始JSON曾在终端展示，但导出未同步且清会话重启后无法恢复；render-observed-results.json明确为观察摘要，不伪造逐次时长。命令保存在render-target-check-command.txt。

外部执行环境直连测试保留完整online-results.json：四会话、隔离及超时回滚通过；完成prepare两轮后发生HTTP520，整体测试失败。该路径连GET也耗时约8–10秒，不能把网络墙钟时间直接当成3秒事务超限，也不能宣称所有公网路径通过。容量第五会话503、跨源403、healthz200、敏感路径404有独立原始记录。

资源矩阵通过后保持服务运行；没有扩大费用或放宽预算。为释放4个测试席位，重启原版本，新实例 b9b5b4544-2vm5c。华为平板及用户网络仍待用户打开真实链接验收；不宣称真人易用性或平衡通过。

## 实际浏览器检查

Chrome访问真实HTTPS页面成功。三个片段分别选择并点“重置此局面”载入，中文四项引导显示，引导可收起/重看。备货片段选择G-PZ-01，点C8一格路线并移动，实际位置C9→C8，储备6→5，明确提示未配送。恢复片段修复C10 D10，储备未立即恢复；结束德军余下阶段、切换苏军、结束苏军余下阶段，进入第12回合，回执明确实际配送/维护/恢复；S-I-01实收0、维护0/1、短缺3。状态证据见browser-move.txt、browser-settlement.txt。

观察限制：苏军补给阶段仍显示SOVIET_REINFORCEMENT_SUPPLY英文枚举。反馈按钮点击后，自动化下载事件等待3秒超时，但随后同步目录实际出现SUPPLY-UX-007-feedback.json；核对本轮特有备注、restore片段、苏军视图及revision 9，确认导出成功。原始文件另存browser-feedback.json。没有为修复UI而改变冻结运行版本。浏览器这里只做发布冒烟，完整三个片段结算和并发/回滚由上述真实Render HTTP矩阵覆盖。
