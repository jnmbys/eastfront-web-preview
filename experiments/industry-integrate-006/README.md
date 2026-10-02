# INDUSTRY-INTEGRATE-006｜隔离恢复事务适配器

实现与证据仅在本目录；005及Core、服务器、协议、旧证据均未改动。适配器在隔离副本上调用原`live.execute`执行RP恢复；既有RP恢复成功只是对照，新增验证对象是发布状态、请求幂等和失败边界。

固定基线：`8cd45705559f2ecdffb5cf5696a6c4ff198a095d`。继续使用005固定的Core `813b4072568352e95d0726fe5fe04060c889c554`、规则R1 `7a970e020dc6ac104d44ac72a4a18508b10b1d2f`、CAMPAIGN-004 `268ea7bd3d139936c4c6e52579cd4a84470e2611`。

## 复跑

需本地Git含上述对象，Node ≥22.13，Python 3.12环境中已有NumPy 2.3.5及SciPy 1.17.0。本次Node 24.19.0、Python 3.12.14。无需安装包、启动服务或重跑战役。先在仓库根设置`INDUSTRY_PYTHON`为该Python可执行文件路径；PowerShell执行：

```powershell
& $env:INDUSTRY_PYTHON experiments/industry-integrate-006/prepare.py
node experiments/industry-integrate-006/verify.mjs
```

首次有意生成本轮证据用`verify.mjs --write`。默认验证不更新证据，并比较输出字节哈希。不同运行器版本可能改变派生代码哈希，必须记录环境差异。准备器在006/.runtime内复制005、固定原入口和夹具，逐文件核对Git来源；005源码不修改。原Core只通过005原准备器去类型生成执行模块。导入原live所需夹具仅解包，不推进对局。Node到Python管道明确使用UTF-8；原live内部3秒预算保持不变，外围启动/查询/排队另计，不声称整个适配器在3秒内完成。

## 调用接口

```javascript
import {RecoveryTransactions, snapshotHash} from './adapter.mjs';
import {savedCheckpointJSON} from './authority.mjs';
const tx = new RecoveryTransactions(savedCheckpointJSON('german_recovery_T5'));
const state = tx.snapshot();
const request = {
  requestId: 'my-recovery-1', controllerId: 'G-HUMAN-1', unitId: 'G-I-01',
  expectedRevision: state.revision, snapshotHash: snapshotHash(state), paymentMode: 'RP'
};
const reply = await tx.submit(request);
const currentState = tx.snapshot();
const transactionMetadata = tx.metadata();
```

代码段用于本目录模块调用；可以在构造选项传`python`路径，否则取环境变量或PATH的python。构造输入必须是保留原数字类型表示的完整JSON字符串。`snapshot()`返回独立解析副本，`serializedSnapshot()`返回当前原始序列化字符串。执行只传后者给Python，不能先把真实存档经过JS重序列化：`1.0`变成`1`会改变原Python日志哈希。初次对照即发现这一问题，现已保持序列化表示，并同时审计005完整状态哈希和序列化字节哈希；未手改任何游戏字段来匹配结果。

请求字段恰为示例六项。不接受调用方价格或报价，未知字段拒绝；每次首次执行及发布前均调用原样005规划重新验证版本、含journal/seen的完整哈希、原Core资格及支付条件。只构造原`REPAIR_UNIT`命令，原入口负责所有单位、RP、恢复次数及补给更新。

返回回执包含历史提交前后版本/哈希及原命令，另带**当前**版本/哈希；不带可供覆盖当前状态的旧存档。同ID同内容（字段顺序可不同）优先查询已提交回执，不重新扣费；同ID不同内容拒绝。原存档seen内、适配器没有回执的ID拒绝为`LEGACY_REQUEST_ID_COLLISION`，避免原live的早期去重被误当成新恢复成功。

## 原子性与幂等范围

同一个实例所有提交都排入一条Promise队列，锁覆盖资格查询、原入口的私有副本执行和提交前检查。新完整存档与COMMITTED回执先一起构造，再用一次私有根对象赋值发布。副本执行后、提交前，读取者仍看到旧局面。排队竞争者进入提交区后重新检查当前版本；同版本不同请求只能一方成功。

新增事务元数据独立于原bundle：每个合法请求ID绑定内容指纹，记录RETRYABLE、REJECTED或COMMITTED状态。资格/过期拒绝缓存为REJECTED；执行前或提交前故障仅留下可重试的ID绑定与失败记录，游戏状态无部分提交。故障后同内容可重试；不同内容仍拒绝。提交后回执丢失时，状态与COMMITTED回执都已发布，重试只返回凭证。响应构造或回执传输失败也不能撤回已发布状态。

此保证仅限**一个Node进程、一个存档所有者实例**。没有磁盘持久化、进程崩溃恢复、多个实例/服务器间CAS或分布式幂等；进程退出即丢失内存元数据。请求身份认证、限流、元数据清理不在本轮。不应直接接入生产服务器。

## 定向验证

[EVIDENCE.json](EVIDENCE.json)保存24项检查、完整状态审计摘要、单列事务元数据及来源/实现哈希。测试源码中的完整深比较覆盖原bundle所有字段，不能只凭RP和步损相等通过。

|检查|结果/来源|
|---|---|
|T5真实对照|适配器、固定原live.execute、已保存repaired检查点完整一致；这项是既有行为对照|
|相同ID重试、不同内容冲突|仅首次提交；价格、单位、版本或哈希内容变化不能重用ID|
|过期版本/哈希、无基地、已恢复、错侧|拒绝，完整游戏状态及序列化字节不变|
|调用方伪造报价、旧seen ID|拒绝，不信任报价或借旧入口去重跳过事务|
|两个不同请求竞争一个版本|在副本执行后设屏障，第二请求等待；首次提交后第二请求过期，无第二扣费|
|并发同ID同内容|只执行一次原入口，另一请求得到重放回执|
|执行前、私有执行后、发布前故障|完整原局面保留；撤销故障后可重试且只发布一次|
|成功但回执丢失|成功状态保留，同ID重试获得已提交凭证|
|较新状态上的晚到重试|仅通过原END_PHASE再推进一阶段到revision111；重放回执仍指向110，当前完整状态及字节保持111|
|P/E|继续拒绝；无材料注入，无RP替付，原35项阻塞逐项一致|

所有故障、竞争、重试次序明确标记为合成测试；输入棋局使用固定真实存档。`testMode:true`才开放故障钩子和`advancePhaseForTest()`；后者仅用于构造真实较新版本，仍走原入口，不手改revision或单位。没有工业订单、配送、新编入场、完整战役重跑、合并或部署。
