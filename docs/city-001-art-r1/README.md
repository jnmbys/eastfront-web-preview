# CITY-001 / GRAND-UX-001：003 美术 R1 接入

本分支 `city-001-district-control` 在统一版本 `37eae5148f8175574dba91e03c14346a1ea3a733` 上选择性接入美术，不新增演示。固定美术来源 `fff0a15702fc6a7dae13811170d75e60487ec281`（`grand-campaign-003-art-r1`），原说明见 [来源 README](https://github.com/jnmbys/eastfront-web-preview/blob/fff0a15702fc6a7dae13811170d75e60487ec281/docs/grand-campaign-003-art-r1/README.md)。

入口仍为 http://127.0.0.1:4197/ ，默认“003-R1美术 / 城区与工厂”；菜单保留“003原显示回退 / 同一规则”。只更新现有服务的静态构建，未重启后端，未合并、未部署。地图为真实003的1280格版本，不是早期640格研究地图。

## 接入边界

- main.ts 仅调整地图显示模式、启动/退出和按需细化，保留当前 GrandPort、CITY、多装备生产线、自动运输、军官、精简移动接口。没有整份覆盖旧入口。
- 地图 scenario/terrain 与指定美术来源一致；完整素材路径保持 `public/assets/terrain/vs2-002/assets/...`。素材清单沿用固定来源 ASSETS.json，本轮清单/大小/哈希见 `evidence/city-001-art-r1/source-manifest.json`。
- 长期缓存只接收复制后的地形坐标/种类、道路、铁路存在、河流、桥梁种类。不传单位、控制权、战争迷雾、设施，也不传铁路 repairedBy/destroyed、桥梁 destroyed。底图交通表示静态几何，不赋予通行/运输资格；现有阶段交互与授权状态负责资格。
- 单位、FOW、控制与 CITY 设施继续在授权 SVG 层更新。关闭本模式的 F3 装饰工业长屋顶/烟囱，保留其他聚落与地貌；实际厂房由 CITY `facility.id/status` 绘制。施工不算建成，隐藏设施不补画。其他模式的装饰工业默认保持。
- 原直接图片、decode、fetch/bitmap/blob/Canvas 回退未删除。首个远景完成后进入，首次细化沿用已就绪画面；每层只构建一次。退出取消待建任务、释放画布并断开观察器；导入失败也释放启动观察器。

## 实机接缝证据

`evidence/city-001-art-r1/browser.json` 保存首轮性能观测与授权状态摘要；`final-browser.json` 保存最后源文件构建后的动作核验。截图均为统一入口的真实页面。

1. 首次细化未完成时选中 G-003；记录时仍显示 far、缓存2,821,616字节、缩放7.27。close细化期间建厂及选择 RIFLE 成功，记录仍显示 medium。能处理这些输入不等于无卡顿。
2. 复用 `evidence/city-001/checks.json` 原合法轨迹，接通/易手证据不重做地图设计。T4 已产10件步兵装备，自动运输到 G-059；军官实际提交 REPAIR_UNIT，支付1P＋2 RIFLE，RP0，损伤1→0。
3. T5 通过界面的“将友军所在格加入路线”与“确认移动”，G-059 从21,18移动到21,19，库存24→23（四分之一SP单位），损伤保持0。阶段准备/既有轨迹通过本机权威接口；选兵、生产设置、建厂、军官授权、移动提交通过UI。没有直接改状态、种子或资源。
4. J17新增工厂建成后，本方实际厂房5→6，J17两座各有唯一facility ID；底图仍是第3次构建，工厂与控制变更未重建地貌。截图04显示实际两座工厂。
5. 缓存层往返新增素材请求0；退出当前画布 width/height为0、isConnected=false；原显示回退没有地貌画布，CITY/定位及5座初始工厂仍在。

## 本桌面成本与限制

首轮观测：far 3,693ms，medium 14,256ms，close 14,435ms。远景画布854×826，2,821,616字节；中景1707×1651，近景2561×2476；三层合计39,458,788字节（37.63MiB）。不是进程/GPU总内存。视窗会随本机侧栏变化；记录末为1560×1244、DPR1，不能当固定视窗跑分。

到三层就绪的实际地貌资源83次请求、33个不同路径，encodedBody合计13,107,335字节、transferSize合计13,132,235字节（浏览器口径）。按每层 grass 起始分组21/31/31，其中首组含CITY独立站场与实际工厂组件两次，不应称为纯远景19次以上全是地形缓存。固定来源R1的85次不能直接抄作本轮结果。完整请求保留以便重新分组。

跨LOD仍重新加载/解码；本机 no-store 下不享受持久HTTP缓存。已有层往返0新增请求只说明画布复用。观测到17个≥50ms长任务，最大183ms，合计1,211ms（包括阶段/界面工作，不能全归因地貌）。首次细化可操作，但不宣称移动端、触屏、iPad/华为或长期平衡通过。战争迷雾下低对比及近景纹理放大仍保留。

## 验证及复核

在此工作树安装原依赖后运行：

```powershell
node ai/local/build.mjs
node --test tests/city-art-r1.test.mjs tests/safari-terrain-loading.test.mjs tests/perf003-terrain.test.mjs
node docs/city-001-art-r1/verify-evidence.mjs
```

构建通过；32项针对性测试通过；11项保存证据复核通过。Safari用例是离线加载器模拟，不是Safari实机验收。仅检查整合风险，003地形中心/交通证据沿用来源。初次范围断言误将艺术分支的独立check.mjs也要求存在，失败后缩到真实scenario/terrain和素材；没有补回无关演示脚本或改地图。最终复跑曾因当前会话已进T1移动而拒绝旧轨迹的下一动作（WRONG_PHASE），立即停止旧轨迹，按当前阶段合法结束推进，未修改状态补齐预期。

当前后端、Core、AI、规则默认、协议均与统一基线相同。既有35项全局阻塞保留；局部接缝通过不代表完整战役、生产运行或发布获批。

最终源码截图：`06-final-officer-refit.png`、`07-final-recovered-unit-moves.png`、`08-final-unified-factories.png`。01–05为首次成本与回退观测；之后仅补强异常清理和静态交通字段隔离，再核验06–08。`served-build.json`确认4197实际响应与最后构建文件逐字节一致。
