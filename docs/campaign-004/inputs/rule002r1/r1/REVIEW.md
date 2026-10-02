# RULE-CAMPAIGN-002-R1｜审查决定与离线复算

2026-10-02；基线 `9ed3f4f16450c2ff936de242b328c7ba30059dc5`；分支 `rule-campaign-002-r1`。

## 审查状态

decisionRef：**LEADER-RULE-CAMPAIGN-002-20261002**。结构化记录见[DECISION.json](DECISION.json)。

`CAMPAIGN-SETTLEMENT-002-candidate.1` **获准作为离线复算候选，未批准运行接入**。候补等额B、同源SP支付、后方优先均继续作为被测方案，尚非正式默认。此审查只改变使用许可，不改变candidate.1数值、事件顺序或规则。原九例、原fixtures.json及CHECKS.json全部保留原字节；本R1新增于独立子目录。原文“待审”是此前状态，此处记录最新且仅限离线的决定，不能据此把任何运行配置标为APPROVED。

**首要实验风险仍是候补清欠挤压前线。** C08在E6的8q来源中，先清旧欠2q、付本期4q，仅余2q前线维护；前线B为4q，D由1变为3/2。后方恢复整编不代表前线已经恢复。不能提高来源、取消损耗或改W阈值使该风险消失。

|仍未冻结|当前处理|
|---|---|
|候补费率、来源与支付优先级|等额B、同一来源、旧欠先付且后方先付是被测方案，不是运行默认|
|各模板配方、整编时间、队列/候补上限|原例步兵3P/6E2、B4q、整编一边界仅用于既有九例；不推广到所有兵种|
|组建点/来源绑定、入场格/资格、首次行动初始化|继续条件输入；不以legalGiven替代Core校验|
|P/E恢复与RP接口、运力单位与跨格服务|仅验证原例P/E唯一支付与单走廊算术；不实施RP替换或通路规则|
|战略目标、homeSide、占领条件、VP/W参数|新增020布局引用仍不能冻结这些字段；不发布真实胜负|
|工业功能、产出/维修/接收能力|J7/M14/R9/AD9是空间预留，不决定任何收益、来源或预算|

## 可复算文件与运行方式

- [fixtures.json](fixtures.json)：九个原例，另保留C04无装备货运和C06卸货受阻两个原有条件分支，共11条短回放、66个事件。
- [verify.py](verify.py)：Python标准库、只读输入、只向标准输出打印报告；不导入游戏、访问网络、写文件或推进RNG。
- [RESULTS.json](RESULTS.json)：实际运行输出，含输入/脚本哈希、逐事件计算delta、完整计算后状态、R/L/F及故意破坏条件的拒绝结果。
- [LAYOUT_REVIEW.md](LAYOUT_REVIEW.md)、[layout-review.json](layout-review.json)：020空间引用和未决规则字段；[layout-source.json](layout-source.json)保留固定提交的原始candidate-nodes.json字节供独立核对。
- [VALIDATION.json](VALIDATION.json)：定向检查、只读检查、旧证据未变和范围记录。

在仓库任意受支持的Python 3环境，从仓库根执行：

```text
python docs/rule-campaign-002/r1/verify.py --self-test
```

成功退出0，报告状态为`PASS_OFFLINE_CONDITIONAL_ARITHMETIC_ONLY`；失败退出非0并报具体事件/守恒条件。无需依赖安装、服务启动、Docker或游戏数据生成。脚本不负责保存报告；需要归档时由调用者把标准输出保存为UTF-8。已保存的报告不取代重跑。

### 输入怎样重新计算

每条回放具有完整原始`before`、有序`events`、完整`expectedAfter`和`expectedMetrics`。每个事件的`input`是动作数量或明确给定的条件；`expectedDelta`列各变化字段的原值、有符号数值差和后值。新字段/状态枚举变化的delta为null，保留前后值，不把未存在字段伪作资源0。

脚本先只使用before和input计算事件，再比较计算delta和预期，最后比较完整状态。`event()`函数不读取expectedDelta/expectedAfter。旧版“左右相同常数”检查不用于本R1通过结论。预期来自原九例的手工展开，未用核验器生成；源额度、实付和库存均在事件流水中可见。

|账目|独立计算方法|
|---|---|
|P/E|下单available→escrow；完成escrow→embodied；部署不再扣；恢复available→repairConsumed。每步同侧同材料所有账户总和等于before|
|候补实付|`min(旧欠+B, 本E来源余量)`；先清旧欠，再付本期；更新欠付、来源余量及后方累计消费|
|前线|使用明确给定的received，核对源和单走廊额度；`paid=min(B,stock+received)`；库存随之变化；按原例full时钟计算D，不求解真实配送|
|SP|`before库存+本窗口累计发出增量=after库存+候补及前线实际消费增量`；每个源`cap=rearPaid+frontIssued+unused`|
|维护Owner|键为实际/预定永久ID×E；同E第二条维护直接拒绝；候补状态与部署状态决定可处理事件|
|R与入场|只有给定合法入口且时点/欠付符合条件才生成实际unit；R由实际unit ID权重独立复核，order/plannedId不计；入场stock=0|
|到货|due从dispatch+L−1算；received后availableTurn=本E+1。E24到货仍为25，留在deliveredLocked而非玩家available|
|C08|从两次来源输入、旧欠和B重算清欠/本期费/前线不足；未付款不推进整编|
|C09|先实际减恢复材料并step−1，再应用给定敌方损伤step+1，最后由step/max及投入权重计算L/F；不覆盖成刚恢复的旧状态|

账户q均为1/4补给点，E2为1/2装备包，P为人员包。债务和F/L使用Fraction精确有理数，不以显示取整替代比较。输入中零为例子明确为零；未知资格/源路径用条件与scope说明，不填0当通过。

## 证据边界

1. `legalGiven`、`unloadingLegalGiven`与C09敌方损失都是给定条件。这里证明这些条件成立时账怎么走，不证明Core动作、真实敌军、恢复基地或入口合法。
2. 前线received是条件回执；C04只检查单走廊维护预留和货运容量。没有真实多路径求解、敌控、桥、ZOC或全军物流证据。C09是两支追踪部队局部账，不代表参战双方全军R/F或总源预算。
3. C03的`assumed_noop`明确给定“重试/冲突拒绝应无经济影响”。只检查预期零收费与Owner去重；没有真实请求重放、服务器事务、超时、并发或幂等验证。不得将离线通过写成事务幂等通过。
4. C06前窗E22运费仅承接“已付”的条件事实，原例未给数额/容量，保留UNKNOWN；不新造E22容量，不于E24重复收费。C04目的仓可收6E2仅为原例“有容量”的条件下界，不是正式仓库规格。
5. 九例不跨入D=3耗损结算，核验器遇到该区域明确拒绝超范围；没有复制或修改完整耗损引擎。C08不证明实际存活回合，其他例子也不证明全局平衡或战争意志通过。
6. 脚本是审计夹具，不供运行加载、不连接Core；其小范围计算不能取代未来权威实现。工业003原始结果仍保留，后续只能按本离线候选及其明确条件定向复算，不声称已完成真实双边战役接入。

15个故意破坏条件的检查涵盖透支、Owner重复、假R、免费入场库存、错到货时点、共享运力、漏旧欠、漏C09后续损失/错时序、重放收费及误冻结布局功能。拒绝理由保存在RESULTS；这是核验器能发现不一致的证据，不是新增规则机制。
