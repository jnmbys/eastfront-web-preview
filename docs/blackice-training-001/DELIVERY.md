# UI-ICON-002 + BLACKICE-TRAINING-001 交付

## 候选与进入
独立分支 blackice-training-001，基于 3d003d5b1ccba92ccd6c10384381c9f90fab291e。上游天气/省份仍待独立验收，本次未改变其审查状态。UI 两次独立提交为 6693db4afa4e829fe0fe9e2f980586a8b0a05daa、e2d6373597e708d7acc669e223cb5d789da8d430；训练独立提交见 `git log -1`。

正常新局 http://127.0.0.1:4291/ ，德军对现有苏军AI，默认暂停。选择部队→训练图标→继续时间；停止后保持驻守恢复组织，需要时点击归队。G-013 开局符合训练资格。其他单位可能缺供或缺装，按钮旁保留具体原因。顶部 i 可点开图例，生产/编制/后勤仍由原导航进入。

运行构建版本核查：`http://127.0.0.1:4291/release/info` 的 build.source 与 trainingRule。本机入口不等于远程双人入口。双人训练使用单独 room 服务，已做两份独立身份协议检查，未完成双浏览器天气/训练交互验收。

交付服务独立目录 `%TEMP%\eastfront-training-001-delivery-20261012`。安全关闭：在该目录创建 `stop` 文件（PowerShell：`New-Item -ItemType File -Path "$env:TEMP\eastfront-training-001-delivery-20261012\stop"`）。不关闭其他 node 进程。原 4289 和其他既有服务/房间未操作。本轮 4290 对照和原 4291 测试进程已关闭，测试存档保留。

## 实际结果
- 顶部管理、资源、时间及部队状态使用统一原创 SVG；命令保留短标签，天气与重复后勤/省份解释折叠；点击图例可读说明，失败与禁用原因仍可见。1280×720、1600×900桌面视口检查，无横向页面溢出；不是平板真机验收。图例用 Enter 打开，焦点保持在原生 summary；最终停止原因的网页核查和截图见 browser.json、training-final.png。
- 自然正常新局 G-013，576 个真实5分钟步（48游戏小时）：经验从0至0.039936，组织逐步降至25%；125件步兵装备真实磨损1件，炮12件尚未达到1件损失、尾数保存。停止后恢复率比同条件未训练单位增加约3.994%。未注入该局经验、库存或产能。
- 浏览器实际开始→4×推进至7小时15分→暂停→停止→保存→刷新重连；进度约3%，恢复收益约0.6%。重新训练后手动驻守中断成功。打开生产、后勤、编制、地区/天气及图例。截图是隔离本机测试，非用户房间。
- 受控边界：遭实际战斗结算立即停训且正常计算伤害；人员/装备/供给不足、上限、新命令、越权及冲突重试检查通过。补员对照预设经验0.1，合法换编后第141步实际到队1人，经验降至0.0999487442；缩编返还不增加经验，资源守恒。
- 训练120步存档，真正退出并重启子服务，恢复暂停，继续48步与不中断对照的任务、经验、磨损、库存、天气和RNG一致。重启命令代次按原保护提升1，并非复用旧连接。
- 两个独立HTTP/WS访客分别训练己方，敌方命令/第三身份/过时代次被拒，重复请求无重复扣除；真实共享时间及进程重启恢复通过。不是双浏览器操作验收。
- 旧天气与新规则不训练的12步对照相同；R1整补/手动优先8项相关回归通过。未重跑历史全战役。

## 复跑与证据
在本工作区依次按需运行（隔离测试，不连接既有房间）：
```
node experiments/blackice-training-001/check.mjs
node experiments/blackice-training-001/edge-check.mjs
node experiments/blackice-training-001/refill-check.mjs
node experiments/blackice-training-001/restart-check.mjs
node experiments/blackice-training-001/mp-check.mjs
node --test experiments/blackice-001/r1-check.test.mjs
node experiments/blackice-training-001/build.mjs
```
结果位于 `evidence/blackice-training-001/{check,edges,refill,restart,multiplayer}.json`。受控边界和正常训练在记录中分开。48小时预算用于观察整件磨损（24小时尚不足一件），没有为通过测试修改参数。检查过程中修正测试URL和重启代次比较，未放宽认证。

`evidence/ui-icon-002/before-{overview,unit}.png` 与 `after-{overview,unit}.png`：同一隔离存档、tick0、1280×720、同镜头、同选择。`browser-active.png`、`browser-stopped.png`记录真实训练；`production-1600.png`是另一桌面视口。早期训练截图下方曾保留旧状态句，随后已修复停止/新命令立即同步原因；不影响任务实际已停止。

## 规则、限制与回退
详细数值/来源见 MODEL.md。全部训练速率、上限、磨损与恢复加成为项目适配；固定BICE常数只作为参考，未证明相同引擎语义。驻地基础训练不提高火力/命中、不发国家经验、不代表实战老兵；未做机动驾驶演习/额外燃料或兵种专长，敌方全局AI尚不主动安排训练。

规则 BLACKICE-TRAINING-001-1、多人 BLACKICE-TRAINING-ROOM-1；旧存档拒绝转换，新目录与旧格式隔离。回退关闭本服务、保留目录，继续使用原入口；不要将新档交给旧引擎。天气、战斗RNG不被训练额外消耗。

本地作者验证已完成上述范围；真机触屏、远程双人、双浏览器训练及长期平衡未验。无Push、合并或部署。交DeepSeek独立审查后停止扩展。
