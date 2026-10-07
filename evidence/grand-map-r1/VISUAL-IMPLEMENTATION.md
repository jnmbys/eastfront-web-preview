# GRAND-MAP-001-R1 地图呈现实现

## 实际查看的参考（2026-10-07）

查看了以下图片的完整像素；仅提取信息形状与层级，没有将图片或裁切素材导入游戏。

|参考|观察|本候选对应|
|---|---|---|
|[论坛 cavalry bleed](https://forumcontent.paradoxplaza.com/public/1036143/cavalry%20bleed.png)|红色实体箭身与黑描边；交战处小圆标，数字位于深色中心；圆标与箭头方向独立|原创暗外缘圆徽标；不显示无依据胜率，中心为进攻/防守/撤回符号。攻击为红实体箭身、深描边、实际单位来源。|
|[官方 Steam 实机](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/394360/ss_242abc1c2ca21f7d8694ba8d9239d8944217b29f.1920x1080.jpg)|沿前线的连续军团线，与宽幅朝纵深的计划箭头分开；计划覆盖但仍能看见地形|已有控制边界不变，军团前沿为金色点划线，计划为更宽半透明方向箭头，实际动作另层窄实箭。|
|[Paradox 论坛 Moving.jpg](https://forumcontent.paradoxplaza.com/public/561521/Moving.jpg)|玩家标注的实际行军截图；绿色实体路线沿地块方向转折，深色边缘、清楚落点；图中另有浅色路线|仅画权威已接受的当前行军段，绿箭与权威进度填线；不把多格意向连线当作已接受路径，不从图中推定浅色路线规则。|
|[玩家实机箭头讨论](https://www.reddit.com/r/hoi4/comments/1rzilcv/whats_the_difference_between_the_red_blue_and/) · [原图](https://i.redd.it/uf30wkgzvbqg1.png)|同镜头有红色攻击、蓝色支援方向及绿色路线；各单位来源保留，箭头收敛至交战处；此为玩家上传，并非官方规则文档|蓝支援箭带小加号圆环，红攻击带交叉标识；来源逐单位绘制。实际支援不推进语义由本候选权威实现与测试验证，不以图片证明规则。|

## 实现位置

- `src/playable/battleMap.ts`：每一权威交战分组一个稳定 SVG 宿主，暗外圈、状态内圈、中心符号、避让偏移及短引线；不同目标不会因屏距合并为一场。结束即从地图移走，仅留战报。详情包含实际交战分钟、已知参与者和评估依据。
- `src/playable/actionArrows.ts`：MOVE 绿实体路径、ATTACK 红实体路径、SUPPORT 蓝路径及圆环加号、RETREAT 灰虚线。已接受待执行用较淡/空心箭头，执行实心。箭头只消费授权 `map.actions`，不根据绘线移动单位或修改控制权。
- `src/playable/campaign.ts`：部队专用“攻击当前地图目标”；支援必须从已存在战斗的面板下达。保留原直接移动下令。
- 选中单位、战斗或军团按当前焦点强调相关动作；可突出全部箭头。宽计划箭头没有事件区域；实际箭头仅约 6 屏幕像素的线段命中区，单位层保持上方。箭头点击/悬停能查单位、类别、目标、状态；拖移超过 6 像素不触发点击。
- 静态地形与城区宿主沿用；徽标按 group ID、箭头按 action ID 更新。暂停不伪造时间或进度。

## 验证范围

本子项已通过 `node node_modules/typescript/bin/tsc --noEmit`。实际运行截图、权限/支援/重连验收由本任务主验证记录给出；本文件不以静态编译替代浏览器验收，不宣称用户已认可视觉效果。
