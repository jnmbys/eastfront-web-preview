# FACTORY-CONVERSION-F1

基线：11aba481de1c5539a89213ea99d8b8cc96df2ac6，分支 hoi4-recruitment-001。定点确认继承 be902c68 的真实 advance 顺序缺陷。审查来源为用户指定目录下实际存在的 REVIEW.md（不是 REVIEW/.md）。

## 修复

生产与施工统一进入 economy.industryStep：先按真实可用民厂启动转换、移出产线，再生产、施工。construction 的独立调用仍自行准备；共享入口传 prepared 标志，不重复启动准备。没有改产量、工时成本、存档结构、权限或取消规则；没有转换标记时准备为空操作。

## 真实推进回归

advance-f1.mjs 直接使用招募 Campaign.advance，四个场景各两步。修复前预期断言失败：开工步产线在制增加0.125；修复后两步均0，转换工时0.2083333333→0.4166666667，启动账仅一次。无工人仍生产0.125→0.2500217014，转换0；无转换及实际旧 occupation Campaign 同结果，修复前后逐字段一致。

advance-f1-boundaries.mjs 另用真实 advance：只有目标民厂时不开工；有另一民厂时仅另一民厂施工0.1041666667，目标不自建。未重复长期完工或历史全套。

## 实际网页

独立正常新局、独立 Cookie 前缀，随机端口52528，本轮PID17452。使用现成未改UI构建，后端为本提交修复工作树。网页入队军转民→正常1×推进4步→暂停（施工0.8333333333）→取消面板→保留工程→再次取消并确认→手动保存→刷新、继续同局→再次保存。截图 web-confirm.png、web-reconnected.png；DOM保留记录 web-kept.txt、web-reconnected.txt。

保存只读核对 web-started/cancelled/reconnected.json：原厂MIL、damage0保持；所有本方产线工时/效率/成品数与分配保持；取消不重新挂线；重连tick4暂停、同一取消项目。网页未构造受损厂，非零损伤取消沿用已有组件审查，不冒称本次网页覆盖。未做真机、长期完工或服务重启专项。

## 复跑

在本工作区执行：
- node experiments/hoi4-factory-conversion-001/advance-f1.mjs after
- node experiments/hoi4-factory-conversion-001/advance-f1-boundaries.mjs
- node experiments/hoi4-factory-conversion-001/web-f1-assert.mjs

before.json 是修复前真实失败输出，保留不覆盖。网页脚本 web-f1-server.mjs 使用 PORT/SAVE_DIR/STOP_FILE 启动隔离服务；web-f1-read.mjs 只读校验本轮保存文件。网页步骤需实际点击，脚本断言不替代网页操作。

本轮临时浏览器与服务已关闭，保存副本保留于process.json所列临时路径。4298、4299及其他原服务没有重启，仍运行原版本；本次提交不代表它们已加载修复。没有Push、合并或部署。招募已交付成果完整保留；F1独立提交供追加审查。
