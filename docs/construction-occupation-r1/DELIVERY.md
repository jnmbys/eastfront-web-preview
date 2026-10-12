# CONSTRUCTION-OCCUPATION-R1

基线 d21274af234d42b4e26d3dd73112eedbb4245eee，上游独立审查状态不变。独立分支 construction-occupation-r1；规则 CONSTRUCTION-OCCUPATION-R1-1，仅新局。没有修改战斗、要塞效果、工时成本或产量。

## 修订
- 未完工项目保留原阵营及已投入工时，失守停工。接单、分配及公开可建预览只计本方私人预留；实际设施仍完整占槽。三类接单采用阵营内编号，不暴露隐藏队列长度。
- 基础设施与要塞冻结原目标等级、原成本。夺回时目标已被实际设施满足则结项，不再升级、不转移进度、不退款。工厂实际槽满则挂起。
- 取消无退款/资产。取消前级后，后级等待；可以重新排入缺失等级，不能把后级进度挪给前级。
- F1：铁路与枢纽两个地图显示路径共用完成项目过滤，排除 cancelled/satisfied；真实设施不受影响。F3没有取得真实可达故障，未改。
- 新旧候选互相拒绝加载不同规则存档，不迁移旧局。

## 作者验证
运行以下命令（仓库根目录）：
```
node experiments/construction-occupation-r1/build.mjs
node experiments/construction-occupation-r1/check.mjs
node experiments/construction-occupation-r1/partial-check.mjs
node experiments/construction-occupation-r1/assets-check.mjs
node experiments/construction-occupation-r1/protocol.mjs
node experiments/construction-occupation-r1/restart-check.mjs
```
证据：evidence/construction-occupation-r1。

受控占领夹具分别覆盖工厂、基础设施、要塞：相同授权状态/不同敌方隐藏队列，视图及合法下单结果相同；占领方按原工时完工，敌方旧进度不动；夺回后无重复设施/等级。MIL填满3槽耗21600个建设组件步，INFRA5600步、FORT4200步；不是自然战果或完整战役推进。另测部分省份失守、连续等级取消与补缺、四次反复易手、旧档拒绝。未赠物资或降低成本。

双独立签名身份：己方接单、敌方队列不可见、越权取消/排序拒绝、旧经济代次拒绝、重复取消回执一致。真实临时服务在第60步保存并结束进程，以另一PID恢复默认暂停，再推进到180步，队列/目标/工时/资产/库存/天气/RNG与同点对照一致。临时协议及重启进程已关闭。

F1证据是实际编译的公共显示过滤函数检查，不能冒称完整地图视觉验收。未重复历史战斗/工业全套、真机或公网验收。交独立审查，不宣称整体验收通过。

## 预览与关闭
http://127.0.0.1:4297/ ，独立正常新局，默认暂停。进入后打开建设，原有选址、排序、取消入口不变，折叠说明内可查看占领规则。

存档目录：%TEMP%\eastfront-occupation-r1-preview-20261012\saves。
安全关闭仅本服务：在 %TEMP%\eastfront-occupation-r1-preview-20261012\stop 创建文件；服务会保存后退出。运行版本查同目录 out-final.log 的 source，并与 git rev-parse HEAD 对照。保留4296及原工作区/原局，未Push、合并或部署。

网页补查：独立4297身份进入暂停正常局、打开建设和占领说明，截图 browser.png。未把网页面板检查替代受控占领/重启证据。
