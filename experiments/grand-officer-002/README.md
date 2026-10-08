# GRAND-OFFICER-002 本机试玩

正常战役：http://127.0.0.1:4231/ 。定向演示：http://127.0.0.1:4232/ （继承轮换场面，已停在真实占领后的02:20，不是自然战役起点）。仅本机访问，未部署。

选择底部军团→向目标推进→地图或目标列表指定目标→委托军团执行→继续世界时间。军团详情显示占领、守备、接近或受阻原因。可改令、暂停军团或选单位接管；暂停军团不停止世界，交战部队仍承担风险。明确指定责任地段时沿用001，不套用本轮同目标分工。

固定两方向六小时对照未显示整体收益，暂不建议替代001。详见 ../../evidence/grand-officer-002/REPORT.md，含连续实机截图、完整回放和重启证据。

在本工作目录启动：

```powershell
node ai/local/build.mjs
& ./experiments/grand-officer-002/start.ps1
```

交付时服务已运行，无需再次启动。停止前在网页点击“保存”，然后：

```powershell
& ./experiments/grand-officer-002/stop.ps1
```

脚本只关闭经进程命令核对的新4231/4232服务，不批量停止Node。存档：`%LOCALAPPDATA%/EastfrontSaves/grand-officer-002/normal.json`、`objective-demo.json`；日志在同目录stdout.log/stderr.log。再次start.ps1自动读档并暂停。

正常验证进度备份normal.json.verification-backup留在同目录；Git中也保留压缩记录。要恢复验证备份，先停本服务并另存当前normal.json，再复制备份为normal.json，不在运行时覆盖。

新标记GRAND-OFFICER-002存档含任务、计时、行军和原事务回执。001旧存档不直接加载；测试from001仅显式转换固定起点用于等条件对照，不是玩家隐式迁移。

回退：直接打开仍运行的 http://127.0.0.1:4229/ （001正常）或 http://127.0.0.1:4230/ （001定向）。其服务、内存和存档未改，源码固定 f1b621a263dde0ddbd18b6e1228cc8bcd59287a6。

局部复核：`node experiments/grand-officer-002/check.mjs`、`node experiments/grand-officer-002/transaction-check.mjs`。compare.mjs会覆盖本地同名对照证据，不需要为试玩重跑。
