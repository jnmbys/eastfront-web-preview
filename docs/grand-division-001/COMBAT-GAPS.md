# 14类营／支援到统一战斗引擎的缺口

文件定义来自 demand-reference.json（各条含源文件和SHA）；不是游戏引擎验证，也不是当前已生效属性。所有14类统一保持旧战斗尺度，本测试入口不推进战斗。

|条目|已提取人员／装备需求|已提取基础属性字段|当前接缝／限制|
|---|---|---|---|
|INFANTRY|1000人；infantry_equipment=100|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, suppression, weight|步兵武器型号的攻击/防御、装备不足缩减、组织度聚合未接入；仅需求事务可用|
|MOTORIZED|1200人；infantry_equipment=100, motorized_equipment=35|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, suppression, weight|步兵武器和卡车双重需求已有文件；速度最小值、机动/补给影响及型号映射未接入|
|ARTILLERY|500人；artillery_equipment=24|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|火炮型号软攻、阵地防御、宽度及火炮装备不足影响未接入|
|ANTI_TANK|500人；anti_tank_equipment=36|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|反坦克型号穿甲/硬攻及与全师混合穿甲的计算未接入|
|MEDIUM_ARMOR|500人；medium_tank_chassis=50|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, suppression, weight|底盘不是完整车型；模块/型号、装甲/穿甲聚合和速度瓶颈未接入|
|HEAVY_ARMOR|500人；heavy_tank_chassis=40|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, suppression, weight|重型底盘与旧重装甲单位不能换算；型号、硬度、装甲和地形代价未接入|
|ENGINEER|300人；infantry_equipment=10, support_equipment=30|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|人员/两类装备需求可测试；堑壕上限、河流/地形效果及科技修正未接入|
|RECON|500人；infantry_equipment=40, support_equipment=10|max_strength, max_organisation, default_morale, combat_width, supply_consumption, maximum_speed, training_time, weight|侦察器材/侦察值不能等同当前视野；战术选择与侦察效果无现成接缝|
|SUPPORT_ARTILLERY|300人；artillery_equipment=12|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|支援营属性修正和型号数据未核实；不等同地图上的蓝色支援攻击命令|
|SUPPORT_AT|300人；anti_tank_equipment=24|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|支援反坦克的穿甲/硬攻修正未接入；不使用旧反坦克抽象库存替代件数|
|SIGNAL|500人；support_equipment=20, motorized_equipment=10|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|主动性、计划与增援率所依赖的原版战斗流程未实现|
|LOGISTICS|500人；support_equipment=20, motorized_equipment=10|max_strength, max_organisation, default_morale, combat_width, training_time, weight|供应消耗修正和编制聚合待核实；不能凭草案直接提高铁路或枢纽容量|
|MAINTENANCE|500人；support_equipment=25|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|可靠性、损耗与缴获的配套机制未实现，不新增虚假修复收益|
|HOSPITAL|500人；support_equipment=30, motorized_equipment=20|max_strength, max_organisation, default_morale, combat_width, supply_consumption, training_time, weight|人员回流和经验损耗修正缺行为核验；不能在缩编返还中偷用医疗加成|

## 统一接入尚缺

- 武器型号的软攻、硬攻、防御、突破、装甲、穿甲等数据不能由营基础文件代替。实际装备缺额的属性缩减与平均/最小/最大混合规则尚未实现。
- 组织度、恢复率、速度、宽度、地形及支援效果的聚合、科技学说修正和训练等级作用未接入。已提取某个字段不表示已经定义聚合顺序。
- 当前战斗使用项目连续时间与损失结算，不能只给换编队套用原版攻击数值；后续需双方统一迁移，不是本次事务的阻塞。
- 组织度当前值和训练经验在测试采用中原样保留；新上限未知不猜测截断。地图人员比例可更新，但不宣称战力已经改变。
