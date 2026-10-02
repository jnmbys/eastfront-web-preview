# ART-LAYOUT-020空间输入审查

layoutSourceCommit：`2aa9a655e2906667929f3828d4dd6f58d7286ea2`。

来源：[固定REPORT](https://github.com/jnmbys/eastfront-web-preview/blob/2aa9a655e2906667929f3828d4dd6f58d7286ea2/research/ART-LAYOUT-020/REPORT.md)、[固定候选节点](https://github.com/jnmbys/eastfront-web-preview/blob/2aa9a655e2906667929f3828d4dd6f58d7286ea2/research/ART-LAYOUT-020/candidate-nodes.json)。在美术独立仓库按完整SHA读取，未混入其后续工作；本目录保存节点原字节和SHA256。

结论：**空间引用已补齐，运行目标/工业功能未批准**。相对旧002的“布局待交付”，现在为“布局已收到、规则字段未冻结”。本次离线审查决定不扩大为场景批准。

|visualNodeId|城市群/图示范围|组内角色叠合需去重|规则状态|
|---|---|---|---|
|N01|D10|VP候选、站场、前沿装卸共享位置|不是三份VP|
|N02|J6；设施/接轨/操作J7/J6/I7|J6同时城市、站场和设施预留子集|艺术候选未列VP不等于规则永久0分；objectiveId仍null|
|N03|M15；M14/M15/N15|M15同时城市、接轨、候选VP|不按维修/城市/站场三计分|
|N04|R10；R9/R10/S10|R10同时城市、站场、仓储候选|不因多角色叠加压力或产能|
|N05|V5|城市和桥头目标候选|双桥/多角色不自动多计分|
|N06|X14|城市与站场候选|保留一个物理群候选|
|N07|**AC10、AC11、AD10**；设施/接轨/操作AD9/AD10/AE10|AD10既属首都三格，又是接轨/设施预留子集|整组只允许未来一份批准目标；不能拆三格再加站场分|

## 重叠检查

从固定JSON重新计算七个`involvedCells`集合，组与组之间无重复格；四个设施reservationCells合计12个不同格。组内城市与设施预留交集分别为J6、M15、R10、AD10，属于同物理群多角色，不是新增地点。核验器计算交集，而非只相信报告文字。

这不是视觉或通行通过。020已说明四个设施格被单位占据时有覆盖冲突；空置包围框无交叠不能证明实战可读性。设施格与接轨格相邻也不等于获得物流边：固定数据四条facilityToLoading均无真实交通边且transferPermission未定义。本轮不新增支线、禁行或跨格服务。

## objectiveId与visualNode分离、唯一计分

`visualNodeId=N01..N07`只标识本版美术数据；`reviewGroupId`引用其CITY群供审查，**不是运行objectiveId**。所有`objectiveId`暂null。候选角色VP/STATION/WAREHOUSE/FACILITY各自只作展示/研究标签，不建立计分记录。

未来规则批准目标后：物理群统一映射一个稳定objectiveId、一个占领判定及一份VP/地点压力键；多个visualNode/角色若指同一目标，应按objectiveId去重，不能把每格/每种建筑都追加一笔分数。若希望拆组，须先单独评审真实占领条件和分值预算；本轮不拆N07。不能把024九组预算或CAMPAIGN-001抽象0—8链直接套入N01—N07。

## initialOwner与homeSide

固定美术输入的initialOwner为null，未提供homeSide。七组全部保持UNRESOLVED，不根据东西位置、屋顶、候选角色或当前占领色猜归属，也不把null解释成中立。初始部署场景经规则审查后才确定initialOwner；homeSide需独立指定谁承担该目标失去的战略压力，不能随每次占领自动改写。

后续至少核对：批准场景的开局控制快照、首都群三个核心格是否一致、homeSide与压力对象的业务含义、captureHexes及合取/其他占领条件、原有独立苏军源与新目标的映射。AC10/AC11被020记录为既有补给源/枢纽候选参考，不使AD10或AD9自动成为新源，也不证明当前战局控制和产能。

## 工业收益不冻结

J7、M14、R9、AD9只保留接收/装卸/仓储/维修的空间研究可能，所有`industrialOutput`、`supplySourceIds`、vpValue和占领条件继续null。不是四个工厂，也不是4个零产出工厂。工业003地图外生产与抽象战区接收点不自动迁入坐标；接收点失守不能直接推断全国工业丧失。服务半径、跨格搬运、维修额度、sourceId、库存和受占规则必须另有批准字段后才能定向复算。

“同群唯一计分”是防重复记账约束，非赋分；本轮批准目标数仍为0，homeSide待审7组，工业收益冻结数为0。
