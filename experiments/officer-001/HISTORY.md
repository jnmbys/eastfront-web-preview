# OFFICER-001：史料到策略（2026-10-05）

这是资料辅助的手写策略，不是训练模型。三名军官为原创人物，没有冒用历史指挥官。以下是有限类比，不从历史胜利推导普遍最优策略。

## 实际阅读与局限

* Clausewitz, *On War*，Graham英译／Maude编本，第一篇第六章“Information in War”、第七章“Friction in War”；第七篇第四、五章“Decreasing Force / Culminating Point of the Attack”。[Gutenberg全文](https://www.gutenberg.org/files/1946/1946-h/1946-h.htm)。HTML无固定页码，使用章名定位。读到情报不完整、行动摩擦以及损失和补给距离削弱进攻的论述；不是现代定量模型，游戏不模拟的疾病、盟友离散等因素不纳入评分。
* *ADRP 6-0 Mission Command*, 17 May 2012，§1-5—1-9（印刷1-1—1-2），§2-15—2-21（2-4），另读2-3页Grant与Sherman书信案例。[原版入口](https://home.army.mil/wood/application/files/7715/5751/8336/ADRP_6_0_Mission_Command.pdf)连接超时，实际读的是[同版文本镜像](https://studylib.net/doc/11008131/adrp-6-0-mi-ssi)，带2012年C1封面变更。镜像有OCR断字，不声称逐页核对原扫描。采用任务与资源边界内的自主行动、监督与反馈；这不是最新现行教范的合规声明。
* NPS Vicksburg National Military Park，实际阅读全文：[Bruinsburg Crossing](https://www.nps.gov/vick/learn/historyculture/bruincross.htm)（2018-02-15，正文第1—5段）、[Second Assault](https://www.nps.gov/vick/learn/historyculture/secondassault.htm)（2018-02-15，正文两段）、[Siege](https://www.nps.gov/vick/learn/historyculture/siege.htm)（2018-02-01，正文）。用[Port Gibson CWSAC摘要](https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=ms006)核对迂回后的战果；用搜索返回的[Library of Congress May19](https://www.loc.gov/item/today-in-history/may-19/)摘要核对两次强攻失败后转围城的顺序（正文打开失败，未作为独立细节来源）。网页无页码，均按标题/段落定位。是公共历史概述，不能还原每名指挥官每时刻的完整信息，也不据此精确拟合伤亡参数。
* George E. Blau, *The German Campaign in Russia*, DA Pam20-261a (1955)：原用户下载403，实际从[美国陆军CARL馆藏](https://cgsc.contentdm.oclc.org/digital/collection/p4013coll8/id/2460/)的PDF下载接口取得212页版本，读序言（PDF5）、印刷85–90页（含插图，PDF100–107）。文本提取核对了页眉页码。序言明确主要用德军记录与前德军将领战后专论，存在单方/回忆偏差；对“若先攻莫斯科会获胜”等反事实不采纳，原书89页也说无法证明。PDF SHA256：b6758204eb9211adadbc9d08e077482a04667f4bc076ac9db24a6838af139561。

## 案例与实现对应

|案例|当时可用信息→目标与约束|判断→结果与代价|适用条件与代码对应|
|---|---|---|---|
|Bruinsburg／Port Gibson，1863-04-30—05-01|Grand Gulf炮台未被压制；收到Bruinsburg有上高地道路的信息。目标是渡河建立登陆场，敌军具体位置仍不确定。|改选渡口、上岸集中并向内陆推进；建立立足点，随后Port Gibson获胜，仍发生伤亡。不是“未知路线安全”的证明。|玩家给目标，复用有界路径搜索；只按当前可见威胁和本方占位过滤；集中倾向只比较本组距离，不读取敌军全图。没有加入渡船、夜行或桥梁抢占新机制。|
|Vicksburg，1863-05-22强攻|19日失败后补侦察、炮击；希望突破已知筑垒防线，各军沿不同道路进攻。|多路强攻仅短暂突破后被击退，NPS概述损失超过3000；局部成功不能证明后续可持续。|复用公开地形、筑垒与攻防估计；损伤和缺供改变候选取舍，集中组合有不同权重。原014推进保护保留；拒绝后停步交回，不把持续猛攻写成成功公式。|
|莫斯科方向，1941年11—12月|进攻前已知人员、装备与补给困难；85页明确记载古德里安面前敌情不明且侧翼加长。目标是包围首都，继续行动应依局势。|仍继续推进，局部进展后在12月初停顿，损伤与疲劳累积。87–90页的战后整体敌情不能反灌策略。|缺供谨慎、损伤代价、同组集中与无正收益时停步。只读当前授权的己方补给状态和伤损；冬季冻伤、战略侧翼线、隐藏援军不作为已实现变量。|

## 可审查的规则映射

授权先于行动；地图标记不授权。持续命令有目标范围，攻击只考虑命令邻域的已识别目标。无目标、无正收益候选、混合编组待决、拒绝时停下并报告。恢复由现有公平恢复资格估计产生，Core裁决，实际花费扣玩家给该军官的RP额度。后勤仅报告本方伤损/补给状态；不计算隐藏敌位置或自动动工业账本。

内部四维参数分别影响出击门槛、损伤代价与受损接敌过滤、缺供过滤/代价、向本组靠拢与联合攻击偏好。参数固定，不抽签、不调用Core RNG。它们是可回退的初版设计假设，不是史料测量值。战报由被选候选的实际条件生成，不用历史修辞捏造战果。

东线交叉核对：[德国历史博物馆《Der Angriff auf Moskau 1941》](https://www.dhm.de/lemo/kapitel/der-zweite-weltkrieg/kriegsverlauf/angriff-auf-moskau-1941)，Arnulf Scriba，2015-05-19，正文后四段也记载运输能力不足、进攻12月初失败及苏军反攻。这里只采用这些共同支持的事实，不采用精确冻伤比例、谁应负主要责任或先攻莫斯科可获胜的争议判断。
