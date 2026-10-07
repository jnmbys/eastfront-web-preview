# 给 GRAND-PLAY-001 与 MP-022 的明确接入说明

本补修基于 `50e1b27629cb95617dbeed05c690e997e3ab970d`，不依赖暂停、连续时钟、T/E阶段或网络实现。只适配呈现DTO与交互优先级。

## 入口

```ts
paintAuthorizedCities(authorizedView, (cityId, districtId) => {
  // 由新版宿主打开自己的城市面板；不提交规则动作。
}, {
  canInspect: () => !privacyGate && !isPickingActionTarget && !isPickingOfficerTarget
});
// 镜头变化：
scheduleCityArt();
// 离开对局、撤销整个视角或切换宿主：
disposeCityArt();
```

`CityArtView` / `CityArtInteraction` 位于 `src/render/cityArtView.ts`。当前旧面板薄适配仍在 `src/playable/cities.ts`；当前操作状态谓词在 `src/main.ts`。移植时替换这两个适配点，不将旧阶段/面板结构复制进美术模块。

## 授权契约（两条线均须遵守）

1. 每次调用传入**完整、当前授权的呈现快照**，不能把增量消息直接当完整快照。MP-022先由自身授权状态归并增量，再调用；本模块不读网络消息、不合并未知的经济状态。
2. `revision`仍兼容原DTO，但不再作为城市失效键。GRAND-PLAY-001每个时钟tick均可调用；无关tick/单位变化不产生静态DOM变更。同revision下设施/授权变化也会处理。不要为了触发美术伪增回合或修订号。
3. `viewer`改变时先提供新阵营的完整授权数据。原设施/标签/交通DOM会同步清除；只有已授权的公共静态几何可复用，不能传旧阵营数据等下一帧再补。
4. `cities[].districts[].facilities`及`sealedConstruction`只包含本次授权的记录。失去设施信息时从数组移除；删除设施也是移除该永久ID。`unconfirmed`仅是原系统的“最后确认”显示标志，**不能独自充当撤权**：本方后方资产虽不在接触视野内仍可能合法授权。撤权须清理记录，或把整个城区标为新增可选字段 `hidden:true`。
5. `hidden:true`立即移除该城区静态绘制、设施、标签及待细化任务；从district/city数组移除也有效。隐藏成员不产生虚构的大包围墙。再次授权须提供新完整内容。
6. `knownHexKeys`限定交通确认范围；从集合移除后桥梁显示未知而非完整桥，铁路已知状态标识消失。已删除的交通边必须从edges移除。
7. 永久cityId/districtId/facilityId及edge key不变；设施不能用数组序号重命名。控制权、服务、封存、进度和实际状态继续来自授权DTO，静态缓存不含这些字段。

## 宿主DOM与输入

保持 `#eastfront-map`、`#fog-surface-layer`、`#map-wrap` 和 `.map-toolbar` 锚点。连续更新时保留同一SVG；如果宿主自己替换整个SVG，内部DOM必然重新建立，本模块不能阻止宿主的全页面重建。

- 模块不放置覆盖整格的可点击透明层，依靠SVG坐标反算城区六角范围。单位和行动层保持在上方。
- 单位命中使用已有 `[data-unit-id]` / `[data-hit-unit-id]`；行动目标使用 `[data-role]` / `[data-command-hex]`。这些目标直接排除城区处理；宿主处理后仍应 `stopPropagation()` 或 `preventDefault()`。
- 必须提供实时 `canInspect` 谓词，在任何移动/战斗/部署/军官目标选择或隐私门关闭时返回false；不要捕获过期布尔值。当前适配允许铁路模式的空白城区检查，但实际铁路边处理优先。新版可按自身交互状态采用更严格策略。
- 现有wrap捕获阶段的拖动抑制继续生效；模块自身也跟踪超过6px拖动、多指、wheel和取消。Enter/空格仅激活辅助标签，仍遵守canInspect。
- 无须调用经济、战斗或网络接口。选中城区的回调只负责新版面板展示。

## 局部更新对应表

| 对象 | 失效输入 | 保留项 |
| --- | --- | --- |
| 城区静态 | districtId/type/hex/slots、局部交通几何、LOD | 无关修订、单位、时钟、设施/归属不替换其DOM |
| 外墙 | city成员布局与局部交通开口、LOD | 无关城市不更新 |
| 设施/空槽 | 永久ID、授权设施字段、服务/确认标志、槽位几何、LOD | 未变化同区设施节点保留 |
| 交通 | 每条边的绘制结果、knownHexKeys | 无关边和城区保留 |
| 标签 | 对应城区文字、授权归属/确认状态 | 无关标签保留 |
| 视角撤销/退出 | viewer、hidden、对象删除、dispose | 旧敏感DOM不保留，已排队细化不能复活 |

独立浏览器夹具覆盖上述契约。接入新版后只需复测它的完整快照生成、宿主SVG保留及canInspect映射，不需要重跑旧100动作夺回来验收此补修。
