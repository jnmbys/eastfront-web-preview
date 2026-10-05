# 验证与证据边界

## 最终代码

- `node ai/local/build.mjs`：前后端预览构建通过。
- `node experiments/grand-campaign-002/check.mjs`：9组通过，含1280双向坐标、120合法部署、唯一邻边/节点、桥梁条件、命名河段连续与汇流、六条走廊、5次空订单E结算、双方各5条实际付费生产→运输短样例、节点真实移动占领→E收入唯一结算。完整输入/输出见[geography-checks.json](evidence/geography-checks.json)。
- 复用001已有20项经济/事务检查通过；运行后还原001原证据文件，结果另存[legacy-economy-regression.json](evidence/legacy-economy-regression.json)。含订单/货运幂等、守恒、失败原子回滚、E24边界和640规则回退。没有重复全量回归或24回合对局。
- 最终景观几何与模板/经济继承验证：[unchanged-inputs.json](evidence/unchanged-inputs.json)。只是地形、路线、设施位置与部署适配，没有放宽移动/战斗/补给判断。

## 真实浏览器两段证据

第一段：318河边/17桥版本，桌面1560×1244，36次真实提交，从新建T1操作到T3恢复。10张PNG都是页面截图，保留原样，不是概念图或旧战役回放。

1. `01-t1-full.png` 全图；`02-central-road-preview.png` G-026 Y17→Z17，1移动点、0.25补给点。
2. `03-northern-bypass-preview.png` G-025 Y16→Y15→Z14，2移动点、0.5补给点；实际提交成功。
3. `04`/`05`：G-026攻击S-026，3:2，骰4+3=7，NE。
4. `06`/`07`：苏军S-026反击Z17交通节点，城市使最终列1:3，骰3+6=9，AR；通过地图“撤退至27,2”完成真实撤退到AB16。不是仅静态连通推断。
5. `08`与e1-visible-ledger：节点保持德军，E1收入20+2=22I；初始12−订单5−照管1+22=28I；VP35:31。没有按移动即时发钱。
6. `09`：E1、E2连续两批订单入库，O29→V29铁路前送第一批1P+2E2，8运力，T3可用；`10`：G-059同格恢复损伤1→0，消耗材料，RP仍0、次数1/6。
7. E1北绕G-025存量4−0.5−维护1=2.5SP，配送0；中央G-026在维护后由W17途径补到6SP。北绕并不保证后续配送，证据揭示的代价必须保留。

原始逐次权威记录：[browser-before-hydrology-fix.jsonl](evidence/browser-before-hydrology-fix.jsonl)。后发现Drut的现代湖心线被过滤导致断河，补入该段公开数据；最终323河边/18桥，铁路/道路/所有部署设施未改变。所有最终地图离线检查重新通过。最终版另新建T1做定向浏览器复验，记录在[browser-authority.jsonl](evidence/browser-authority.jsonl)。不将第一段截图声称为最终河系截图。

## 实际资源与口径

第一段36次权威事务2.22–71.87ms，平均19.01ms，服务进程采样RSS峰值148.29MiB。最终地图9组检查总计11.15秒；这是多个新会话/多组短验证总耗时，检查进程RSS214.82MiB，不是服务峰值。浏览器DOM/JS堆在[browser-performance.json](evidence/browser-performance.json)；只挂一份1280格地图、0个canvas，未新增双地图常驻或整图位图缓冲。

本机未限CPU/内存，不是Render容器验证，也不是FPS/真平板测试。后期后台截图接口Page.captureScreenshot超时，停止继续截图重试，保留此前10张实际截图；最终截图可用性与历史/整体平衡不能由离线检查代替。最终定向复验的确切完成项见STATUS与浏览器原始记录。

## 尚未证明

24回合整体平衡、双方攻守胜率、长期战线推进后的供给最优性、每个地形对所有兵种/军官风格的优势、1941地理准确性、真机触屏/多人/部署。北部森林较密、德军后方干线较长且局部铁路可能是关键割边，需要后续对局观察；静态六路连通不等于六路都能在敌军控制下畅行。本轮不调免费资源来抹平这些风险。

最终定向浏览器复验：323河边/18桥版，新建T1，共17次接受提交。两次MOVE、两次ATTACK、反应与一次实际RETREAT，以及双方完整阶段进入T2。E1无订单收入22I，12+22=34I；中央目标唯一入账2I，VP35:31。最终服务采样RSS峰值109.15MiB，事务最大92.88ms。见[final-browser-summary.json](evidence/final-browser-summary.json)、[最终可见账本](evidence/final-e1-visible-ledger.txt)。最终截图接口受阻，未记录真机通过；视口测试后已恢复默认大小。
