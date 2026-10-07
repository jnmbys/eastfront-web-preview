# 渲染接入点与授权字段

城市美术本体不读取 T/E、回合阶段、生产命令、网络客户端或旧侧栏。后续 GRAND-PLAY-001 / MP-022 只需将各自授权投影适配为 `CityArtView`；本任务没有集成两条开发线。

## 接入点

| 文件 / 函数 | 职责 |
| --- | --- |
| `src/render/cityArtView.ts` | 独立呈现 DTO 与 `(cityId,districtId)` 选择回调 |
| `src/render/cityArtRuntime.ts` / `paintAuthorizedCities(view,select)` | 授权更新、可见区/LOD、静态组件缓存、设施和交通动态层 |
| 同文件 / `scheduleCityArt()` | 镜头缩放或拖动后请求可见区域细化 |
| 同文件 / `disposeCityArt()` | 退出/场景切换取消任务、观察器、引用、字符串缓存 |
| `src/render/cityArt.ts` | districtScene、facilityMarkup、cityWallPlan/wallsMarkup、bridgeStateMarkup、railStateMarkup 纯绘制函数 |
| `src/playable/cities.ts` / `paintCities` | 当前游戏的薄适配器；旧面板选择仅在此处理。保留 e008 的原夺回/生产面板与旧显示回退 |
| `src/main.ts` | 当前场景生命周期、镜头通知、美术导入与统一清理；选择性修改，没有整份覆盖 |
| `src/render/grandArtGeometry.ts` | 长期静态快照；只复制交通几何，不留原 railway/bridge 可变引用 |
| `terrainSurface.ts` / `imageLeaseCache.ts` | 版本化解码租约；保持原加载、超时、decode/fetch/blob回退。退出后晚到结果也释放 |

场景宿主契约：`#eastfront-map` SVG、`#fog-surface-layer` 插入锚点、`#map-wrap` 视口与 `data-zoom`、`.map-toolbar` 提示容器。它们是场景绘制锚点，不是规则或侧栏结构。将来更换地图宿主时集中适配这些锚点与镜头通知即可。单位/控制权/FOW仍由原动态层维护。美术层 `pointer-events:none`；只有城区小标签接收选择，回调不提交游戏动作。

## 字段清单

| 授权输入 | 用途与约束 |
| --- | --- |
| `revision`, `viewer` | 每次授权设施/控制/交通/可见性变化都必须更新 revision；不以回合编号代替。切换 viewer 必须使用新投影 |
| `cities[].id` | 永久 cityId；外墙严格使用现有该城市成员，不推断控制范围 |
| `cities[].label` | 可选显示文字，不决定美术结构 |
| `districts[].id`, `cityId` | 永久 districtId 与所属城市；交互和缓存主键 |
| `hex`, `paper` | 实际地图位置与显示代号；hex不变更规则成员 |
| `type` | MAIN / STATION / INDUSTRIAL / RESIDENTIAL 决定专属组合 |
| `slots` | 真实设施容量；空槽位只画预留地，不增加生产 |
| `control`, `unconfirmed`, `service` | 授权归属、未知标记、服务状态；未确认不宣称当前事实 |
| `facilities[].id` | 永久 facilityId，唯一实例；不得以数组序号或建筑片数计工厂 |
| `slot`, `status`, `progress`, `paidI` | 槽位、建成/施工/封存状态及原进度付款。美术只读取，不改写、不计算经济 |
| `sealedConstruction[].id/progress/paidI` | 授权允许保留的占领封存施工记录，与设施ID去重；夺回后以新的BUILDING状态显示 |
| `edges[].key/a/b/road/railway.present/river/bridge.kind` | 真实道路铁路方向、城墙开口、桥位；不另建交通边 |
| `edges[].bridge.destroyed` | 只有布尔状态且端点处于授权 knownHexKeys 才显示已知完整/损坏；未知用未确认虚线，无完整桥面 |
| `edges[].railway.destroyed/repairedBy` | 已知损坏/修复动态标识；修复不等于整条线路服务可用 |
| `knownHexKeys` | 当前适配器取授权 `view.contactHexKeys`，用于交通状态确认；不得传全图作为性能捷径 |

没有设施归属/封存原因时，不从旧缓存、回合阶段或敌方账本推断。授权 DTO 的 `facilities` 可以为空；这表示当前视角没有可绘制记录，并不证明工厂被摧毁。原 game/authority 的 `asset`、封存库存和在制品账本继续在规则/面板层处理，美术不复制经济逻辑。

## 静态与动态、保护对照

- 22ec1a0 的交通隔离意图：重新复制铁路 `present`，完全去除 bridge 状态引用；桥边的静态路/轨同时留空，动态层画接近段及桥面，避免删 destroyed 后误画完整桥。
- 工厂、施工、归属、未知/服务标记不进长期底图或静态字符串缓存。静态缓存键为美术版本、永久城区ID、类型、位置、槽位及交通几何。
- 导入 `vs2TerrainSurface`、会话代次检查、创建/请求构建均放入同一 try/finally；观察器总会释放，当前失败会清理pipeline/cache。过期会话不清理新会话资源。
- 每个逐素材循环检查取消点。退出清理 viewport rAF、城区timer/observer、地貌pipeline、缓存租约；晚到decode交还后释放。
- 保留 e008340 的夺回逻辑，规则源目录与基线逐字比较；没有引入时间或网络依赖。

## 后续接入边界

新版应继续传永久ID、授权状态和明确修订号；在场景进入/更新/退出调用上述入口即可。不要把旧T/E或暂停计时作为美术状态来源；不要重用跨阵营状态；不要把设施画进静态地貌。若未来设施状态枚举扩大，应先补授权呈现映射与对应检查，不用新增规则弥补显示缺口。
