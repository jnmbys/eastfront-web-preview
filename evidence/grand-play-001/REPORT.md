# GRAND-PLAY-001 验证记录

同一初始场景、固定种子219031。以下为开发者自动模拟，非真人体验、非平衡结论；行动分叉后不是逐战同骰。没有预写胜负。

|计划|终局|德军累计人员损失|存活部队|工厂产出件数|配送q|交战步数|
|---|---|---:|---:|---:|---:|---:|
|集中机动抢枢纽|第150步，德军达成目标|1442.4|17 / 18|31|656.25|139|
|先整补并增加运输|第150步，德军达成目标|2169.6|17 / 18|32|723.75|120|
|基本守势|第150步，苏军达成目标|416.7|17 / 18|25|647|37|

最终占位绕行修复后的冻结候选中，两种进攻方案都由真实模拟达成德军目标；先准备的方案伤亡更高，并没有因为生产更多车辆就更强。基本守势经历敌方进攻并付出损失，最后失去战略目标；不是开局来源缺口强制崩溃。此前开发检查出现过不同胜负，不将那些中间版本结果混入此表。

自然对照中的材料恢复：快速推进3次，先准备2次，守势0次。另有 `directed-replacement.json`，明确标注初始受损部队场景，核对生产、实际运输、1P＋2步兵装备唯一支付、后备48→47、损伤1→0。该定向检查不计入自然使用次数，没有赠送材料。

## 自动检查

- paused has no income, movement or RNG advancement
- idempotent command, quota-free pause, stale and enemy commands rejected
- production operation retry retains one receipt
- fair policy ignores hidden enemies; limited to 400 search expansions
- simultaneous combat unaffected by unit array insertion order
- save during marching/combat, restart, load paused, identical continuation
- speed selects wall cadence only, same tick sequence identical
- direct takeover cancels only future movement, no refund
- directed wounded-unit scenario: real production, shared delivery and unique material payment
- opposed arrivals to same hex engage without first-array capture
- `audit.mjs` 逐类核对全部装备：初始＋生产＝现役＋战区外归档＋在途＋仓库＋车辆池＋实际损失；三局均守恒。人员后备、材料支付与预算亦守恒。
- 额外命令接缝：旧画面的暂停立即生效；新军团命令不会收回直属部队；明确换编组只有一个归属，不恢复消费。

## 性能与范围

- 集中机动抢枢纽：150步，平均143.4ms，最慢670.3ms；展开81013节点。每单位每次搜索上限400，无无限重试。
- 先整补并增加运输：150步，平均86.4ms，最慢493.4ms；展开43241节点。每单位每次搜索上限400，无无限重试。
- 基本守势：150步，平均37.2ms，最慢329.2ms；展开7943节点。每单位每次搜索上限400，无无限重试。

测量是此Windows本机服务的模拟耗时，非用户真机性能认证。固定时间步与浏览器渲染分离，服务器最多每次计时循环处理一步，不补算关机期间时间。

原旧模式逻辑、Core、RNG、经济求解、CITY数据均未修改。新增独立连续战役类，只在创建时选择；不把兼容渲染使用的旧phase字段当作实际模拟驱动。

## 浏览器记录（实际操作，非离线替代）

- 同一4200入口创建暂停战役，委托第一、第二军团；地图显示部队移动，首次接敌在00:35自动暂停。
- G-025行军到W17后调回直属；时间继续，其位置及命令保留，库存经真实配送由原4SP补至6SP。
- 03:50保存，停止仅属于本候选的4200进程；4197/4198 PID保持不变。重新启动服务，通过页面加载恢复03:50，默认暂停，再继续到后续结算和交战。
- 最终界面清除旧阶段/RP与旧战斗数值提示；加载后对G-017下达撤回命令，并因界面显示缺卡车，把J17工区切换到卡车生产，继续时间。
- 浏览器曾触发一次旧版本暂停请求的快照竞态；已经修复并有专门自动断言。Edge控制通道不可用，实际验证使用同机内置浏览器。
- 图片为真实浏览器截图，不是渲染合成。不是用户本人试玩，也不宣称趣味性、平衡或真机性能通过。

完整动作回执：`browser.jsonl`；持续状态与物流记录：`1-replay.json`～`3-replay.json`；检查结果：`checks.json`、`conservation-and-command-audit.json`。

最终机动修复：授权视图内的满员友军格不再进入路线，目标区满员时在邻格展开；`friendly-occupancy.json` 记录6次展开找到真实三格绕行。浏览器旧验证中G-017撤回失败并损失，未回滚该结果；后续证据区分这个开发缺陷和最终修复。

最终实际浏览器局：00:35首次接敌暂停；对G-017下达撤回W17命令。03:20时该队已回到W17，组织度100、人员300、库存6SP，其他部队仍持续交战并有真实损失。已保存原始磁盘封套 `browser-save.json`、最终画面 `browser-final-campaign.jpg` 与可见DOM `browser-final-dom.txt`。这是较早撤出的另一局，不宣称与此前失败撤退是同一时刻同骰对照。

## 交付时的最后复核

最终服务重新启动后，HTTP 实测读取磁盘第40步（03:20）存档、默认暂停、继续至第41步并再次暂停成功，未覆盖存档；记录 `http-final.json`，此项明确不是浏览器操作证据。

浏览器加载原生确认框期间发生控制超时，随后工具鼠标点击没有触发页面提交。改用页面支持的空格键激活后，实际完成开始战役、页内加载确认、恢复03:20暂停、继续至04:05并暂停。最终截图 `browser-final-restart.jpg`。原生确认已改为页内两次确认及取消，实际验证通过；鼠标工具无响应的底层原因未完全确定。

4200 为用户 Windows 本机的独立服务，交付时保持监听。4197/4198 原进程分别为19376/39996，未停止或重启。原模式 HTTP 创建核验见 `legacy-entry.json`。

## CITY-ART-002选择性接入

固定来源 `003292992f24d4c82a8107ec3b6063b681d697dc`。只移植城市渲染模块、所需地貌缓存依赖及样式；main.ts仅增加绘制、实时交互谓词、镜头调度与清理调用，未整份覆盖。

本机GrandPort每次读取的是完整授权HTTP快照，不是网络差量。`currentCityArtView`仅从该快照映射呈现字段，保留永久ID、hidden、已授权设施及contactHexKeys，拒绝不完整输入。没有新增网络同步器，MP-022的差量须先在其授权状态容器归并。

`city-integration.mjs`检查完整映射、拒绝不完整消息、双方授权设施、不丢弃明确撤权标记；不重跑旧夺回战役。城市内部模块保持固定来源原样。

真实浏览器接入检查：05:30→06:15连续更新后，SVG backendNodeId 111966及首个城区节点115301均保持不变；点击AB18地块展开对应工业详情，未知设施仍为零。军官地图目标点击25,7优先设置目标，未改城市选择；G-017选兵优先，显示W17真实状态。见 `city-browser.json` 与 `browser-city-integrated.jpg`。修复薄适配中城市点击只更新选择而未展开折叠区的问题。
