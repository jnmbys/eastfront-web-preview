# INDUSTRY-INTEGRATE-007｜初始材料与同格P/E恢复

仅在本目录新增实现、测试与证据。基于工业006 `4ba4867862d54c3f436b7395fff3b52d38da7848`、规则004 `24afa379ad98b8a62470f79bd65a210fd0df61ce`，继续沿用005/006锁定的Core、R1坐标与CAMPAIGN-004存档。不改原Core、005/006及旧证据，不接服务器、合并或部署。

## 批准与起点

[APPROVAL.json](APPROVAL.json)单独保存用户提供的`LEADER-RULE-CAMPAIGN-004-20261002`批准：完整候选及12项局部口径，仅限本切片。[launch.json](launch.json)由可信本地启动程序加载。校验候选文件SHA256 `a80e32622ea28dc01472ca75a7c9d6ccb8cb9b03eed50e293a45f31fd4087038`、清单规范化摘要、存档压缩包和无损序列化摘要、实验/服务绑定、全部12项及全局不授权字段。候选原文的空批准字段不改，规则004合成资格回执不使用。

可信边界是本地启动配置及其文件；不是网络认证或签名系统。请求不能传入批准、价格或资格回执。配置加载器签发进程内对象，调用方自造`approved:true`无效；缺失或不匹配批准禁止导入及P/E。

固定起点为真实T5/revision109，G-I-01在C10=`2,8`。清单属于**新增隔离实验初始条件**，直接在同格接收端持有1P、2E2:L，绝非历史入库、E4到货、工业产出或SP转换。导入只改变材料revision0→1，游戏bundle的完整序列化字节保持不变。

## 复跑与调用

需Git具备固定对象、Node≥22.13及已有Python3.12环境（NumPy2.3.5、SciPy1.17.0）。本次Node24.19.0、Python3.12.14。设置`INDUSTRY_PYTHON`指向该Python，仓库根执行：

```powershell
& $env:INDUSTRY_PYTHON experiments/industry-integrate-007/prepare.py
node experiments/industry-integrate-007/verify.mjs
```

准备器只在007/.runtime内恢复固定006及其依赖，生成隔离派生接缝及本轮补丁。无需安装包或重跑战役。`verify --write`有意生成本轮证据，默认verify只比对已存证据的字节哈希；运行器版本改变须说明差异。

本目录模块调用示例：

```javascript
import {RecoveryTransactions, snapshotHash} from './adapter.mjs';
import {loadLaunch} from './config.mjs';
import {savedCheckpointJSON} from './bindings.mjs';
const store = new RecoveryTransactions(savedCheckpointJSON('german_recovery_T5'), {
  launch: loadLaunch(), instanceId: 'explicit-new-experiment-1'
});
await store.importInitial();
const game = store.snapshot(), material = store.materials();
const request = {requestId:'PE-1', controllerId:'G-HUMAN-1', unitId:'G-I-01', paymentMode:'PE',
  expectedRevision:game.revision, snapshotHash:snapshotHash(game),
  materialRevision:material.revision, materialHash:snapshotHash(material)};
const quote = store.plan(request); // 只读，实际调用原Core共同资格
const reply = await store.submit(request); // 不信任quote，锁内重核
```

`snapshot/serializedSnapshot/materials/metadata`分别读取独立游戏副本、无损游戏JSON、材料账、请求记录。每条测试使用独立、明确命名的反事实实例；实例间不共享或搬运材料。构造器仅接受精确初始存档，不能把较新游戏配空账本重启。同一进程内不能重用实例ID。

## 最小接缝与原子发布

[PE-SEAM.patch](PE-SEAM.patch)和[SEAM-HASHES.json](SEAM-HASHES.json)列出3个隔离派生文件的原文、派生及执行模块哈希：恢复规则仅增添一步恢复函数；引擎在原REPAIR_UNIT分支按私有付款模式选效果；本地bridge选择派生模式。P/E仍调用原恢复校验，仅过滤精确`INVALID_SUPPORT/details.reason=INSUFFICIENT_RP`。正常身份解析、待决/Ready门禁、接受流程、actionLog、共用次数、补给同步和审计照常执行。没有手造接受日志、临时增RP、改价格为0或先扣后退。RP走原006入口。

[ADAPTER-FROM-006.patch](ADAPTER-FROM-006.patch)展示006所有者扩展：仍是一条队列和一个根对象，加入材料账、导入日志和墓碑。导入、RP、P/E和测试阶段推进共用该队列。提交前重新核对游戏和材料各自版本/哈希，并实际重核原Core资格；私有副本完成后一次根交换发布游戏、无损JSON、材料、导入记录及请求回执。原live内部3秒预算未变；查询、进程启动及排队时间另计。

相同清单重复导入只回现有凭证；同ID不同内容拒绝。花费后两个lot保留SPENT墓碑、初始数量及清单退休记录，重试不能补仓。其他已接受游戏行动使剩料QUARANTINED，数量保留、不可支付/转移/折VP。请求先查同ID指纹再查版本；成功回执只带历史凭证和当前版本，不重新发布旧状态。

## 验证结果与边界

[EVIDENCE.json](EVIDENCE.json)保存35项定向检查、来源/实现哈希及单列材料与事务元数据。验证了P/E的步损1→0、材料1/2→0/0、RP仍8/12、恢复次数0→1、游戏109→110、材料1→2；RNG及SP库存、来源和消耗未增加，单位派生strength由原补给同步更新为3。RP完整结果及序列化字节仍与原入口和保存repaired检查点一致。

RP→PE、PE→RP分别运行原Core资格及实际引擎拒绝检查，均保留UNIT_ALREADY_RECOVERED_THIS_TURN和RECOVERY_UNIT_LIMIT_REACHED。重复/冲突导入、消费后导入、重复请求、同版本竞争、过期材料哈希、三处提交前故障、导入及恢复回执丢失、较新状态上的晚到重试、未批准/篡改/过期范围全部验证。故障、竞争、篡改与请求排列均单独标为合成测试；没有把规则004的合成资格当成真实检查。

只保证单进程、单实例所有者内的原子性。无持久化、跨进程CAS、HTTP鉴权或崩溃恢复；元数据丢失后禁止沿较新局面配空材料账继续。`localSliceApproved`与`runtimeGate.allowed=false`并存：12项只在局部切片生效，全局35项阻塞保留，解决数0。未实现生产、配送、新编或完整工业循环。
