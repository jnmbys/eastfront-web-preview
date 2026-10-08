# GRAND-OFFICER-002-R1 本机试玩

正常入口 http://127.0.0.1:4233/ ，交付时为暂停新局。可选定向预备/接替记录 http://127.0.0.1:4234/ 。两个入口都采用001保守策略＋失效接替释放，002目标协调停用；不是两个策略版本。

选底部军团→指定目标→委托→继续时间。军团详情可见预备、接替、整补及受阻原因；选成员可调回直属。暂停军团不暂停世界，也不让正在交战的部队立刻安全。

服务交付时已运行。网页先暂停、保存，再关闭：

```powershell
& ./experiments/grand-officer-002-r1/stop.ps1
```

再次启动（在此工作目录）：

```powershell
& ./experiments/grand-officer-002-r1/start.ps1
```

只处理命令路径核对通过的4233/4234进程。存档、stdout.log、stderr.log在 `%LOCALAPPDATA%/EastfrontSaves/grand-officer-002-r1/`，独立normal.json与objective-demo.json；启动自动读取并暂停。002/001旧存档拒绝静默导入。本轮普通验证进度另保留normal.json.verification-backup。

回退直接打开4229（001）、4231（原002），原服务/存档/内存未改。不部署、不开放公网。

短对照和连续截图：../../evidence/grand-officer-002-r1/REPORT.md。源码内Campaign为未采纳的协调修订，Conservative为实际服务；存档明确保存enabled=false。没有根据耗时切换策略。
