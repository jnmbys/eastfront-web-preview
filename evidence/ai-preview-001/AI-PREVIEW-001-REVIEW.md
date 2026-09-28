# AI-PREVIEW-001 验收记录

日期：2026-09-28。仅独立静态预览，无源码修改，无生产发布。

## 入口和版本

- 分支入口：https://ai-preview-001.eastfront-web-preview.pages.dev/
- 本次固定部署：https://a736b1db.eastfront-web-preview.pages.dev/
- Source：99ee7fd8cff6aeda68ec058f179c7f34aaedf83b
- Source Tree：3a9a4bbffa9976706b9efbb96efe5a5420f74c8b
- 发布：f8b1a1ff31a0d50d4e6dcd8d0837edb3b6506f70
- 发布 Tree：dae479603340f4df2ee9ba91bdadceb44259174a
- Cloudflare deployment：a736b1db-dfde-44ea-820d-7a66c7a4f1cc；对应提交 check 成功。
- 末次远端核查：main=349369ad358b9b24fa0410735649de497a94b9ea；source-main=5fe12513bca95c5b43c2ddc125021a117c5bcce4。未修改这两个分支或 art-preview-001；未建 PR、调用 Hook、发布后端或修改设置。

## 构建、隔离及恢复

原临时源码目录已丢失。从已持久保存的 bundle 与当前 GitHub 对象恢复准确源码提交；905 个纳入构建的文件逐项 Git blob SHA 对照一致。稀疏排除 evidence/、core/archives/ 的归档证据，不排除构建输入。不冒充源码改动。

重新安装锁定依赖、构建独立预览成功。479 个产物加清单共 480 个文件。Worker 静态依赖闭包 70 个模块，无 Node imports、无 Worker sockets；多人地址为空、connect-src self；生产实验开关 false、预览开关 true。artifact-audit.json 的 browserExecuted=false 是构建阶段静态报告，真实浏览器结果见下表。

发布前保存包含最终发布提交的完整 AI-PREVIEW-001-RELEASE.bundle，并从空库恢复验证全部 480 文件。Bundle SHA256：7a30ad8428af11c07e4e432f5b970577ec96de1a630840dbdd4c44db27652e11。初始本地提交 3f5037e0 与最终 f8b1a1ff 的 Tree 相同，差别为连接器生成的提交元数据，映射见 FINAL-RELEASE.json。

远端发布树 480 个路径/对象全部一致。线上 AI-PREVIEW-MANIFEST.json 下载与本地逐字节一致。容器另行请求 10 个资源的逐文件 HTTP 核查全部返回 403，保留 online-assets.json，不能将此项报告为通过；未修改请求指纹或绕过限制。获准云端浏览器实际加载预览地图并完成以下 Worker 操作。

恢复命令：`git clone AI-PREVIEW-001-RELEASE.bundle restored-preview`，然后 `git -C restored-preview checkout ai-preview-001`。发布工作区干净。

## 本轮自动化

执行 `node ai/local/build.mjs`、`node ai/local/audit.mjs`、AI 构建及 `node --test ai/tests/local.test.mjs`。本轮 local 11/11 通过；日志保存在本证据包。覆盖真实战斗及强制步骤、终局、停止/拒绝上限、重复/过期行动、视图 DTO、取消、single-flight、接管缓存、退出后旧 Worker 回复、冷启动。

未重复执行完整 Core/Web 门禁。旧 AI-003 报告的完整测试属于历史证据，不记作本轮新执行结果。

## 实际浏览器验收

环境：获准云端 Chrome，实际视口 1363×936、DPR 1；鼠标/键盘 UI 自动化。直接打开已部署分支 URL，经真实模块 Worker 与现有 Action 流程操作；未注入游戏状态或绕过规则。

| 项目 | 实际操作和结果 |
|---|---|
| 德军入口 | 人类进攻场景冷启动成功；实验/弱策略/刷新丢失进度提示可见，本方德军视角 |
| 人类进攻、AI 反应与撤退 | 选择 attacker→defender→攻击；实际骰点 4+6=10、3:2、列修正0、D2R；AI 完成反应/撤退后交回人类推进 |
| 推进/突破 | 推进至9,-2→突破至10,-2→确认→跳过重点突击；结果记录8,-2→9,-2及9,-2→10,-2，最后显示战斗后续流程已结束；未重新掷骰 |
| 苏军入口、脚本 AI 进攻 | 明确选择脚本场景；苏军视角，接受1/拒绝0；人类防守反应期间显示等待结算，没有提前结果 |
| 人类反应/损失/撤退、AI 后续 | 不使用剩余支援→真实4+6/D2R及两条本方损失→撤退经10,-2至11,-2；AI 完成后续，返回苏军增援/补给，接受8/拒绝0，战斗关闭 |
| 移动及切换单位 | 苏军进入移动，reserve 从11,-2移动至11,-1，确认后返回普通选择；可立即选择 defender，无旧移动模式锁定 |
| 第4回合增援 | 苏军实际Worker场景，两个增援依次部署31,0、31,-6；计数2→1→0，接受2/拒绝0，显示没有可用增援 |
| 停止/接管 | AGENT_STOP:NO_CANDIDATE 明确暂停，德军视角、接受0；点击明确接管后原生确认框，确认才切换苏军授权视角；原德军 reserve 不再显示，人工操作入口恢复 |
| 现行终局 | 现行终局前场景第16回合德军掘壕→结束阶段；实际接受1/拒绝0，显示苏军胜利、到达当前回合上限，禁止继续操作。只是复用当前源码规则，没有改终局时点 |
| 退出/重新开局 | 多次退出回入口；停止场景后开终局场景接受0，终局后开完整战役。新Worker完成苏军部署后接受33/拒绝0、等待德军部署，无旧停止/结果串入 |
| 缩放 | 完整战役100%→放大120%→适应地图，随后退出正常 |

截图：combat 为重点突击跳过请求尚在更新时的结果卡，后续 CLOSED 由下一次 DOM 核对；soviet 为防守反应待决状态；reinforcement 为两支部署完成；takeover 为确认后的苏军视角；terminal 为已结束对局。

停止接管的第一次 click 调用因原生确认框出现而报 Input.dispatchMouseEvent timeout；随后通过 getJsDialog 确认确有 confirm 并接受，最终接管成功。此为浏览器自动化等待问题，未增加产品超时、未重发接管。保留该失败，不计为首个调用成功。

## 限制与下一步

没有华为真机、触屏拖动/双指缩放、精确平板尺寸或性能验收。本轮没有证明策略会主动进攻：战斗脚本仅验证交互。尚无存档/加载，刷新丢失进度。基础移动/进攻策略仍是下一开发任务，不在本轮增加。

首次源码恢复的全克隆、归档下载及部分网络请求失败；之后以已有 bundle 和核验对象恢复成功。线上额外10个文件HTTP抽检403未解决；发布树、线上清单和真实浏览器验收提供不同层面的已完成证据，不能把403说成资源哈希通过。

用户下一步：华为打开分支入口，选德军＋“人类进攻→AI反应/撤退”，完成一场战斗后退出并切苏军新局；反馈是否正常。无需修改生产入口。

## 撤销

本分支没有既有 AI 预览版本。需要撤销时，另行授权向 ai-preview-001 追加维护页提交并保留历史；不 force push，不修改 main/source-main。删除Cloudflare部署、分支或平台设置不在本次执行范围。当前未执行撤销。
