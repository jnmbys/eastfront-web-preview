# GRAND-MAP-002 本机候选

入口：http://127.0.0.1:4224/ 。仅绑定本机，非公网。两端仍是同一德军统帅，苏军由原AI控制。

1. 点击“进入共同战役”。当前T40暂停，已有军团命令与战斗。
2. 点击箭头或悬停：查看“当前路段”百分比、剩余游戏分钟。暗色是整段轮廓，亮色是已完成工作量；不会在断线时自行跑完。
3. 点击战斗圆标：查看谁可能先整组撤出/失能及估计区间。标注“评估中”时先推进几个时间步。支援箭头仅表示支援，不填满后前进。
4. “继续时间”推进双方；“暂停时间”冻结进度。暂停军官或接管仅停止其新动作，不能停止敌军攻击。
5. 离开前暂停并“保存战役”。读取存档默认暂停。服务重启后如旧连接锁定，刷新页面、重新进入即可；不重发旧意图。

## 启动、关闭、回退

本次交付已启动并保持运行，无需用户先执行脚本。以后需启动：在本分支工作目录执行 `powershell -NoProfile -ExecutionPolicy Bypass -File experiments/grand-map-002/start.ps1`。

关闭本候选：先从网页保存，再执行 `powershell -NoProfile -ExecutionPolicy Bypass -File experiments/grand-map-002/stop.ps1`。脚本只结束4224且启动命令匹配本候选的进程；不会批量结束Node。

存档：`%LOCALAPPDATA%/EastfrontSaves/grand-map-002/campaign.json`。日志同目录stdout.log/stderr.log；本轮完整操作证据在 evidence/grand-map-002。运行日志live.jsonl不纳入后续Git脏变更。

回退直接打开 http://127.0.0.1:4223/ ，其服务和存档未修改。不支持把新增显示样本倒写到旧候选，游戏规则本身未改。

算法、授权范围、动态截图、预估误差和限制见 ../../evidence/grand-map-002/REPORT.md 。仅显示层实验，不承诺预测准确或用户已认可视觉。
