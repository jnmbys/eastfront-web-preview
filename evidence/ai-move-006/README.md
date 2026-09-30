# AI-MOVE-006

源码父提交：300a4affba4aaa77cae945736e61c5b165dc1708。既有AI-005固定比较基线：695ca0524eb039808491b18c69cea1fb74da0cca。

## 契约与修复

`ai/fair/candidates.ts`原来只生成相邻一格path；`routing.ts`的Dijkstra已看多步，但score只接受path.length===1。Core `engine/RulesEngine.js`在一次成功MOVE后设置hasMoved=true；`rules/movement.js`随后拒绝同阶段再次移动。AI-RESEARCH-002观察到每回合只接近一格，与这个契约错配吻合。

保留原首步评分、目标选择、排序和独立agent随机种子，选择后沿同一Dijkstra势能递减路线提交预算内前缀。只拆分复用既有公开移动成本，累加MP，整条路径判断道路奖励；OOS、河流、桥和猎兵减费保留。目标、已识别接敌、已知ZOC、风险、CONTACT、堆叠、预算和16格硬上限均能截断；不为了花完MP越过目标或已知风险。中间格堆叠按保守约束处理，比Core仅检终点更严格。既有路线势能中的10+边成本保留，未重新设计路线目标/评分。

候选生成保留最多128个旧提案，供旧基线及既有人工契约使用，另加入最多127条确定性前缀（总计≤255）。候选策略仍只给旧首步提案评分，再扩展被选路径，因此不改变攻击评分或为长路加新权重。路径搜索仍每单位768、每个scorer32768节点。Host独立重建候选、Core裁决；未知通路不保证安全。

多格路径拒绝后，仅凭有限己方拒绝回执暂缓该单位，不猜测具体阻挡格、不尝试连续缩短前缀探测。历史长度16、同观察3次失败收束及Host拒绝上限8不变；历史淘汰后不保证永不重试。本次没有扩展记忆或改变拒绝上限。

仅3个AI文件、路径测试及本任务证据新增/改动。Core、RNG、规则、补给、攻击评分函数段和authority未改；无部署。

## 定向验证

`node ai/build.mjs`
`node --test ai/tests/move006.test.mjs ai/tests/movement-cost.test.mjs ai/tests/pathfinding.test.mjs ai/tests/lab002.test.mjs`

19项通过（tests.log），含既有288组合公开移动成本核对和54组攻击系数默认一致性；多格MOVE真实Core接受/hasMoved消耗、预算不足、OOS、河桥、整条路奖励、到目标/接敌提前停止、已知风险/接触/堆叠、隐藏阻挡原子拒绝、同PlayerView不同隐藏状态/RNG输出一致、重复输入与动作重放、绕路/死路/目标变化/有界搜索。旧路径测试只将“单格Action”断言改为“单Action包含预算内前缀”；其余规则与公平断言沿用。未跑全量测试、浏览器或真机。

## 固定4局及重现

使用原调参种子17、18，候选各德/苏一次；双方攻击参数均默认1.5/0.75。留出集不动。比较基线从独立干净695ca052检出编译、完整导入其fair依赖；不能使用现有lab/frozenBasic.ts，因为它共享已改routing/candidates。原LAB的冻结检查保持原样，本任务使用专用有限比较脚本，复用FairHost、initial、records、hash和Action重放。

准备独立基线检出（示例路径为仓库相邻目录）：
```sh
git worktree add --detach ../ai005-fixed 695ca0524eb039808491b18c69cea1fb74da0cca
# 在基线工作树安装锁定依赖，或链接当前已安装的同版node_modules
node ../ai005-fixed/ai/build.mjs
node ai/build.mjs
AI005_ROOT=../ai005-fixed node evidence/ai-move-006/batch.mjs
node evidence/ai-move-006/check.mjs
```

maxDecisions=1800、每局180秒、批次720秒；子进程看门狗另外最多20秒供最终重放/IO。仅4个固定job，已有完整且身份一致record跳过，绝不覆盖trace。脚本统计实际已接受MOVE的path.length（边数），每个实际移动单位的byTurn/总格数在record.sides.perUnit；未出现在perUnit的单位无已接受普通MOVE，不能由此推断其存活状态。平均值是每次MOVE，不是全军每单位每回合均值。推进/撤退/突破不混入普通MOVE。首次接敌为某方决策视图已识别敌军与己军相邻，两个side分别保存。目标距离为回合末德军到任一公开首都格最小六角直线距离，不是路径耗费；完整状态只在对局后计算终局与校验，不喂策略。

每条Action同步落盘，结束fsync；record存traceHash/字节数/长度，canonical Action replay核对finalHash。check.mjs只复放已记录行动，核对拒绝是否由Core造成并记录原因，不把原因返回策略。异常不计成正常胜负，anomalies.json索引非GAME_OVER或完整性失败。

## 失败与限制记录

- 首次编译遇到TypeScript循环变量nextRoad推断失败，添加boolean注解后构建通过；无策略行为修正。
- 首局已GAME_OVER且trace/finalHash及重放通过，但子进程使用`--child`与导入的旧LAB入口冲突：旧入口尝试把JSON参数当文件打开，ENOENT并置exitCode=1。保留batch-first-process-error.log及首局process.log；专用参数改为`--move006-child`。旧入口在打开文件时即失败，未运行另一局/改变候选与RNG；首局536条完整记录复用，未补跑第五局。工具错误与对局结果分别报告，不能说执行全程无异常。
- 本次修复执行原路线，未处理接敌后停留、公开目标选择、OOS战略或协同攻击；更长MOVE/更早接敌不等于更优策略。
- 云端Node24 headless证据；未验证Worker、浏览器或平板成本。

结果：见batch/summary.json、summary.md、integrity.json及每局完整trace.ndjson。源码/基线编译哈希、规则/地图指纹保存在manifest与record；sourceParent是修改前checkout，sourceDiffHash及runtimeHash绑定当时实际候选字节。候选源码与完整证据由本任务最终提交固定。

最终补充：4局合计2748条记录；check只执行已记录Action，不是新增模拟重跑。3次拒绝均由Core的ENEMY_ZOC_STOP造成，无Host候选契约拒绝。17苏军S-I-12在n708/n725重复同一路径：17个决策后旧拒绝已被16条历史淘汰；保留为已知限制，未提高历史/拒绝上限或据全知原因改路。完整日志无缺尾、4局finalHash一致。
