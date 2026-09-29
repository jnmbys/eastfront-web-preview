# AI-PERF-PREVIEW-006 — 发布成功，响应改善未证实

## 版本和边界
- 源码：a0c1485d9841eaea1ec6ed2bd9b97a569ff5c9cb。
- 发布：6502e06d0e15ce9956a867a637b9f0b48569af6a，tree786542b95425fa1ea99b0eba78a048065dc645c5。
- 发布分支：ai-preview-001；父提交61836657db0eafd84b1aa0e0ee0d12e4794b8073，正常前进，未force。
- 实际候选：https://9dfd4603.eastfront-web-preview.pages.dev/ （浏览器实际打开）。
- 候选诊断：https://9dfd4603.eastfront-web-preview.pages.dev/?aiPerf006=1&aiSeed=17
- 同诊断旧状态栏对照：https://9dfd4603.eastfront-web-preview.pages.dev/comparison-before/?aiPerf006=1&aiSeed=17
- 原固定部署：https://e0d7bb15.eastfront-web-preview.pages.dev/ ，旧发布f3fac5a9b58deab1f9391fd46e782c728711ef76，仍能打开。
- 策略仍为695ca0524eb039808491b18c69cea1fb74da0cca；main/source-main、后端、规则/Core/RNG均未改。

## 如何构建和核实
在固定a0c1485源码运行本目录build.mjs。复用ai/local/build.mjs，冻结策略文件与旧发布逐字比较。新增的预览覆盖仅为构建身份，以及comparison-before页恢复旧发布updateLocalAiStatus函数并接入同一诊断导出。control-diff.json列出双方仅4个不同文件：src/main.js、诊断身份字段及两份清单。Worker、策略、地图、资源、种子控制和计时器实现一致。

原固定部署没有固定seed入口和新的状态应用/地图计时，所以没有把它的随机场景旧数字硬当作A/B。本次是“旧状态栏＋同诊断”控制实验，不是旧固定部署所有字节的原样重放；尤其旧AI-PREVIEW-002实时性能面板未参与对照，以免额外重绘混淆。

发布前远端无新增预览提交；Git Data API树与本地git write-tree一致。Cloudflare Pages成功记录见deployment-check.json。真实浏览器诊断显示sourceCommit、variant、strategySource正确，实际模块Worker返回分段数据。73模块审计/构建日志见artifact-audit.json和build.log（以实际JSON计数为准）。未重跑6+14已有测试，复用a0c1485证据；本轮补真实浏览器操作。线上清单HTTP请求返回403，见live-manifest-check.json；因此不声称CDN全量文件哈希已复核。

## 同条件方法与次数
Chrome云端，同一tab、同一浏览器会话；DOM视口1363×936，所有导出报告visibility=visible。双方各一次首次启动预热不纳入比较，随后候选3轮，再对照3轮。每轮humanGerman、campaign、aiSeed17；初始Soviet AI部署，均完整执行33个动作、零拒绝、34条Worker快照，没有缩减行动。未覆盖真实平板、完整战役或移动/战斗阶段的性能A/B。

操作顺序：开始→等待退出按钮→放大到120%→地图从(400,450)拖到(500,490)→缩小→等待humanGerman→复制诊断→适应地图→退出→导出上局诊断。每轮初始接受0；拖动前仍AI正在处理，接受4或5；地图style从translate(0,0) scale(1.2)变为translate(100px,40px) scale(1.2)。退出均返回首页。测量不包含工具调用往返耗时；工具操作导致的调度及合成事件仍可能影响页面计时。组别顺序、冷暖/浏览器任务调度没有随机化，不作统计显著性或因果幅度断言。原始每轮完整采样见browser/{candidate,control}-{1,2,3}.json。

完整逐轮最大值表见COMPARISON.md / comparison-summary.json。状态应用outsideView每轮≤0.4ms，动态地图更新通常≤1.7ms（候选第2轮9.1ms）；viewUpdate包含侧栏、绑定、雾、相机等，候选29.0/30.9/32.1ms，对照35.1/31.3/43.4ms。该小样本不足以认定显著改善。主线程长任务候选68/74/59ms，对照52/未观察到≥50ms/50ms，没有一致下降。

缩放CallbackToRAF双方都约999–1009ms，drag EventQueue双方约1020ms。后者不是整个拖动的端到端可见响应：采样覆盖多个DOM事件，并未区分hover pointermove、pointerup、click；Event.timeStamp和自动化调度可影响它。CallbackToRAF也不是呈现时刻。退出handler同步工作候选7.1–9.3ms，对照8.4–9.2ms；不能将它冒充点击到首页实际显示时间。

## 延迟定位结论
补做双方各1次空闲对照：AI已完成33动作，前后think帧计数均34；不产生新AI步骤时再次缩放拖动，仍得到约1008ms的缩放RAF和约1015–1020ms的拖动EventQueue。见idle-control.json、idle-candidate.json。这说明“AI正在计算”不是该1秒指标出现的必要条件。当前分段数据不能把它归因于路径规划，也未证明它来自状态应用或动态地图更新。云端输入调度、事件时间戳/RAF节奏、未计入的布局绘制等尚未完全区分。保留输入延迟问题，不追加渲染/调度大改，不以节点495→0代替真实响应改善。

## 取消、重开、停止接管
候选单次中途取消：点击前接受1，退出时累计接收4帧（初始+3个动作），active=false；随后再次导出报告完全相同，未见迟到应用；重开显示接受0。见cancel-candidate.json、cancel-candidate-later.json、candidate-restart.txt。这里只能确认浏览器可见应用停止，不能审计已终止Worker内部不可见历史；既有Node取消边界测试继续作为不同层级证据。普通3轮退出全部通过。

对照中途取消1次，定位/派发工具超时后页面已到接受33，未成功证实及时取消；保留cancel-control.json及control-cancel-timeout.txt。不可将其直接归因为旧按钮重建，亦不可用这一次失败宣称候选取消更快。

候选stop夹具实际进入AGENT_STOP:NO_CANDIDATE；明确确认后切换人工苏军视角；手动结束战斗阶段接受1、零拒绝。见stop-paused.txt、takeover-manual.txt、takeover-diagnostic.json、manual-action.json及截图。确认对话框的等待时间与操作工具超时从性能A/B排除。未新增独立暂停按钮，停止夹具和退出取消沿用原契约。

## 失败和限制
1. 首次候选预热等待按钮超时，后续加载完成，作为未计时预热处理。
2. 对照诊断框的角色定位两次超时；DOM确认字段存在后，用已观察的textarea读取成功。对照退出定位也出现超时，全部保留，不标为应用崩溃。
3. 原生接管confirm使点击工具报超时；读取实际confirm并确认后完成。该段不计性能。
4. console-errors.json为有限日志窗口中排除扩展URL后的记录，不是“任何时候无错误”保证。
5. CDN清单403；未完成原部署完全相同种子/计时器的原样对照。未测触控/捏合、硬件端到端显示时延、移动/战斗性能、Huawei。

## 回滚
旧发布f3fac5a9b58deab1f9391fd46e782c728711ef76，对应tree4d0f889c73e343c6722b570d78d5d0a8aa1c16fa。需要回滚时先读取当时远端ai-preview-001最新tip，审阅新增提交，以该tip为parent、旧tree创建新的发布commit，不带CF-Pages-Skip，force:false更新预览分支。固定旧URL不依赖回滚操作即可访问。证据追加commit使用[CF-Pages-Skip]，不触发第二次部署。

## 最短华为步骤（可选、待验收）
无需现在重做整套测试。云端功能已验收；用户方便时只需打开候选普通URL→以德军开局，在AI部署时拖动/缩放一次并点退出→重开确认没有旧局动作。若出现卡顿，再用?aiPerf006=1&aiSeed=17导出上局诊断；不要求重复云端6轮。华为结果不能由本报告代替。
