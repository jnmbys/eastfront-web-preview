# RULE-CAMPAIGN-003-R1｜真实地图投影修正

2026-10-02；分支`rule-campaign-003-r1`；基线`0670565ff6491c2f5fe9b1db9b3f7f6a4e03b356`。

## 结论与原错误

原投影把`INITIAL.logistics.nodes.x/y`（包含半格偏移的显示坐标）当成Core轴坐标，造成620/640个key错误，其中180个恰落在其他有效Core格。原`inspect`只检查格名集合/数量，错误返回结构有效；该结论撤回。原提交不改写，`BASELINE_MAP_NODES.json`、`BASELINE_VALIDATION.json`和`BASELINE_SOURCES.json`保留Git原始字节。

已从固定运行版本的原Core函数重新生成全部640格，不手改示例；C10=`2,8`、AC10=`28,-5`、AF10=`31,-6`。每格terrain/control与固定原地图及保存的INITIAL.core完全一致，无地形或控制变化。所有control仍为null，不解释为任何一方有权使用。

修订`MAP_NODES.json` SHA256：`3598aa9eaa2a725ac6c05edd684b0edad71e2164a98f63b5c60fc1bfd698f5ca`。
固定Core权威导入回执SHA256：`51e277ea2383477ca48fbd7c7a857e561ca6681684c94b668775cf234f3aa7e4`。
生成器、校验器及原证据哈希详见[RESULT.json](RESULT.json)。最终Git提交SHA在交付消息及分支记录提供，不写入自身文件形成循环哈希。

## 可复跑生成与只读核验

在仓库根执行，需Git中存在下面两项固定对象、Node≥22.13和Python3；无需安装包。缺少对象则失败，禁止换成HEAD、缺省地图或手填。

```text
node docs/rule-campaign-003/generate_map.mjs --write
node docs/rule-campaign-003/generate_map.mjs
python docs/rule-campaign-003/check_map_r1.py
python docs/rule-campaign-003/validate.py
python docs/rule-campaign-003/validate.py --runtime-gate
python docs/rule-campaign-003/validate.py --map docs/rule-campaign-003/r1/BASELINE_MAP_NODES.json
```

首条仅重建本任务的两份派生JSON；第二条逐字节检查可复现性，不写文件。后四条只读，预期退出码依次0、0、2、1。`check_map_r1.py`实际启动并核对后三种CLI退出码，同时检查同一35项阻塞、candidate字节哈希和原缺口不变。stdout可保存为RESULT.json；没有重跑旧战役或39项旧条件计划。

生成器固定读取运行提交`813b4072568352e95d0726fe5fe04060c889c554`的hex.ts、edge.ts、importLegacyFMap.ts以及`core/source/reference/strategic-reset-f-map.json`。Node仅去除TypeScript类型并解析内部模块引用；原算法不重写、不修改仓库Core。执行原`parsePaperHex`、`axialToPaper`、`importLegacyMap`，从A1到AF20全枚举。导入得到的全部hexes及edges同时深比较CAMPAIGN-004固定提交`268ea7bd3d139936c4c6e52579cd4a84470e2611`的INITIAL.json.gz，不推进对局。

独立Python检查按照Core公式`q=列号-1; r=行号-1-floor(q/2)`及逆变换逐格核对，权威terrain/control取自哈希锁定的原Core导入回执。不能修改待测MAP_NODES再同步其哈希绕过语义检查；即使直接调用`inspect`也必须通过双向对应、格名/key唯一性、640格完整覆盖和terrain/control检查。指向另一有效格时比较的是**格名所应对应的权威单元**，不是错误key所指单元。

## 定向负例

|输入变异|实际拒绝原因|
|---|---|
|C10改回显示坐标2,9|MAP_LABEL_TO_KEY、MAP_KEY_TO_LABEL；服务绑定及路径端点也拒绝|
|互换C10/C11的合法Core key，保留完整唯一key集合|双向对应均拒绝；证明并非只检查key存在|
|C10复制C11的key，C11不动|MAP_DUPLICATE_KEY、MAP_CORE_KEY_COVERAGE及双向对应|
|只互换C10/C11格名，集合/数量/唯一性均保留|MAP_LABEL_TO_KEY、MAP_KEY_TO_LABEL|
|C10地形改LAKE／control改G|分别MAP_TERRAIN_MISMATCH／MAP_CONTROL_MISMATCH|
|删除AF20／把C10命名为C11|数量与双集合完整性／格名重复与覆盖拒绝|

另有三项路径负例：乱序不连续、未抵达receiver、跳过相邻格，分别被PATH_DISCONNECTED、PATH_RECEIVER_ENDPOINT、PATH_NOT_CORE_RAIL_NEIGHBORS拒绝。全部变异由脚本在内存生成，完整实际错误记录于RESULT.json。原错误640格文件也通过CLI确认退出1，不再放行。

## 节点与端点受影响范围

8个source、2个depot、2个receiver、2个entry共14项绑定全部复核，9项key改变，5项不变。原candidate.json不存Core key，本轮无需改其格名、source额度或授权。受影响的是旧投影和任何依赖它解析Core位置的下游。

|对象|修正前key|修正后key|
|---|---|---|
|G-A5|0,4|0,4|
|G-A10、DEP-G-A10、ENTRY-G-A10|0,9|0,9|
|G-A16|0,15|0,15|
|S-AF4|31,3.5|31,-12|
|S-AF10、DEP-S-AF10、ENTRY-S-AF10|31,9.5|31,-6|
|S-AF16|31,15.5|31,0|
|S-AC10、REC-S-AC10|28,9|28,-5|
|S-AC11|28,10|28,-4|
|REC-G-C10|2,9|2,8|

两条既有路线、全部5条边至少一端key受影响，全部重核：

- G：A10`0,9` → B10`1,9` → C10`2,8`。
- S：AF10`31,-6` → AE11`30,-5` → AD10`29,-5` → AC10`28,-5`。

校验从source按见证顺序走到receiver，检查每端格名/Core key、六角邻接距离1及原地图铁路边存在，并保留原FACTS路线匹配。RESULT.json逐端记录修正前后值。这里只证明静态空间映射及已有SP见证引用正确；没有重新证明当前控制、修路状态、敌阻断、实际入场或P/E运输授权。原工业004/CAMPAIGN-004证据不改写、不重跑。

全部640格被重核，包含J7/M14/R9/AD9视觉预留格、未启用入口备选及首都群；坐标修正不会使它们获得source、仓储、入口、工业或计分功能。

## 保留的运行阻塞与交接

`candidate.json`哈希仍为`249511bc8f382e86305184c3e81ddb347222c873acd1593aef3b96f0cbef6ad0`；35项运行阻塞与原列表逐项同序一致，runtimeDecision=REJECT。德132q维护对96q来源（缺36q=9SP）、苏152q对96q（缺56q=14SP）不变，不叠加工业22SP。

后续实现评审应使用本修订MAP_NODES及校验，废止0670565派生key的有效性结论。原Core资格检查、未知授权拒绝、后方同源预算均保留。此交付仅解除**坐标投影与校验盲区**，不解除原35项阻塞、不证明事务幂等、路径动态合法性或战役平衡，不是运行接入批准。
