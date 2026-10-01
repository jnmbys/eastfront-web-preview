# 当前完整单位表（自动提取）

固定基线 `813b4072568352e95d0726fe5fe04060c889c554`。三元组为攻击/防御/移动；step 0、1、2 是损伤档，非行军步数。旗标见下表。

|模板|类型|初始数|增援数|step 0|step 1|step 2|承受步损|ZOC|筑垒|装甲|步兵协同|支援|恢复成本/步|
|---|---|---:|---:|---|---|---|---:|---|---|---|---|---|---:|
|G-INF|INFANTRY|11|0|5/5/3|4/4/3|3/3/2|3|true|true|false|true|false|1|
|G-JAGER|JAGER|2|0|5/5/4|4/4/4|3/3/3|3|true|true|false|true|false|1|
|G-PANZER|PANZER|4|0|8/6/6|6/5/6|4/3/5|3|true|false|true|false|false|2|
|G-MOT|MOTORIZED|3|0|6/5/5|5/4/5|3/3/4|3|true|false|false|true|false|2|
|G-ARTY|ARTILLERY|2|0|0/1/2|0/1/2|0/1/1|3|false|false|false|false|true|2|
|G-ENG|ENGINEER|2|0|3/3/3|2/2/3|1/1/2|3|false|false|false|false|true|1|
|G-RECON|RECON|2|0|2/2/6|1/1/6|1/1/5|3|true|false|false|false|false|1|
|G-HQ|HQ|0|0|0/1/4|0/1/4|0/1/4|1|false|false|false|false|true|1|
|S-INF|INFANTRY|16|6|3/3/3|2/2/3|1/1/2|3|true|true|false|true|false|1|
|S-ELITE|ELITE_INFANTRY|2|1|5/5/3|4/4/3|2/2/2|3|true|true|false|true|false|1|
|S-TANK|TANK|3|3|6/5/5|4/4/5|3/2/4|3|true|false|true|false|false|2|
|S-MOT|MOTORIZED|2|2|4/4/5|3/3/4|2/2/4|3|true|false|false|true|false|2|
|S-HEAVY|HEAVY_TANK|1|0|5/7/4|4/6/4|2/4/3|3|true|false|true|false|false|2|
|S-AT|ANTI_TANK|3|1|2/2/3|1/1/3|1/1/2|3|true|false|false|false|false|1|
|S-ARTY|ARTILLERY|3|0|0/1/2|0/1/2|0/1/1|3|false|false|false|false|true|2|
|S-ENG|ENGINEER|2|0|2/2/3|1/1/3|1/1/2|3|false|false|false|false|true|1|
|S-HQ|HQ|0|0|0/1/4|0/1/4|0/1/4|1|false|false|false|false|true|1|

## 全部初始槽位

|ID|阵营|模板|
|---|---|---|
|G-I-01|GERMAN|G-INF|
|G-I-02|GERMAN|G-INF|
|G-I-03|GERMAN|G-INF|
|G-I-04|GERMAN|G-INF|
|G-I-05|GERMAN|G-INF|
|G-I-06|GERMAN|G-INF|
|G-I-07|GERMAN|G-INF|
|G-I-08|GERMAN|G-INF|
|G-I-09|GERMAN|G-INF|
|G-I-10|GERMAN|G-INF|
|G-I-11|GERMAN|G-INF|
|G-J-01|GERMAN|G-JAGER|
|G-J-02|GERMAN|G-JAGER|
|G-PZ-01|GERMAN|G-PANZER|
|G-PZ-02|GERMAN|G-PANZER|
|G-PZ-03|GERMAN|G-PANZER|
|G-PZ-04|GERMAN|G-PANZER|
|G-MOT-01|GERMAN|G-MOT|
|G-MOT-02|GERMAN|G-MOT|
|G-MOT-03|GERMAN|G-MOT|
|G-ART-01|GERMAN|G-ARTY|
|G-ART-02|GERMAN|G-ARTY|
|G-ENG-01|GERMAN|G-ENG|
|G-ENG-02|GERMAN|G-ENG|
|G-REC-01|GERMAN|G-RECON|
|G-REC-02|GERMAN|G-RECON|
|S-I-01|SOVIET|S-INF|
|S-I-02|SOVIET|S-INF|
|S-I-03|SOVIET|S-INF|
|S-I-04|SOVIET|S-INF|
|S-I-05|SOVIET|S-INF|
|S-I-06|SOVIET|S-INF|
|S-I-07|SOVIET|S-INF|
|S-I-08|SOVIET|S-INF|
|S-I-09|SOVIET|S-INF|
|S-I-10|SOVIET|S-INF|
|S-I-11|SOVIET|S-INF|
|S-I-12|SOVIET|S-INF|
|S-I-13|SOVIET|S-INF|
|S-I-14|SOVIET|S-INF|
|S-I-15|SOVIET|S-INF|
|S-I-16|SOVIET|S-INF|
|S-EL-01|SOVIET|S-ELITE|
|S-EL-02|SOVIET|S-ELITE|
|S-TK-01|SOVIET|S-TANK|
|S-TK-02|SOVIET|S-TANK|
|S-TK-03|SOVIET|S-TANK|
|S-MOT-01|SOVIET|S-MOT|
|S-MOT-02|SOVIET|S-MOT|
|S-HV-01|SOVIET|S-HEAVY|
|S-AT-01|SOVIET|S-AT|
|S-AT-02|SOVIET|S-AT|
|S-AT-03|SOVIET|S-AT|
|S-ART-01|SOVIET|S-ARTY|
|S-ART-02|SOVIET|S-ARTY|
|S-ART-03|SOVIET|S-ARTY|
|S-ENG-01|SOVIET|S-ENG|
|S-ENG-02|SOVIET|S-ENG|

## 全部增援槽位

|ID|回合|模板|
|---|---:|---|
|S-R-T04-G01-U01|4|S-INF|
|S-R-T04-G01-U02|4|S-INF|
|S-R-T07-G02-U01|7|S-INF|
|S-R-T07-G02-U02|7|S-INF|
|S-R-T07-G02-U03|7|S-AT|
|S-R-T10-G03-U01|10|S-INF|
|S-R-T10-G03-U02|10|S-MOT|
|S-R-T10-G03-U03|10|S-TANK|
|S-R-T13-G04-U01|13|S-INF|
|S-R-T13-G04-U02|13|S-TANK|
|S-R-T13-G04-U03|13|S-ELITE|
|S-R-T15-G05-U01|15|S-TANK|
|S-R-T15-G05-U02|15|S-MOT|

总计：17种模板，德军26、苏军32个初始单位，苏军13个增援槽位，全部进入后71个单位；HQ模板存在但初始和增援均为0。
