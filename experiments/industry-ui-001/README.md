# INDUSTRY-UI-005 · 工业工作台与本机事务

新增明确标识的“本机操作 · 017-R1真实事务”，沿用已验收017-R1的会话、请求关联、账本确认及旧响应保护。原演示与012/013/016只读模式保留。

**实际操作入口：`start-local.ps1 -BackendPath <固定017-R1目录>`，打开终端的完整会话链接。关闭用Ctrl+C。** 启动依赖、完整流程、同源边界、验证命令和证据说明见[LOCAL-TRANSACTIONS.md](LOCAL-TRANSACTIONS.md)。`node serve.mjs`仍仅用于静态预览，不提供业务事务。

以下是已验收历史版本说明，其“未接写接口”等范围陈述仅适用于对应旧模式。

# INDUSTRY-UI-001 / 002 / 003 / 004 · 隔离工业与人员记录

## UI-004 016前送与恢复只读模式

UI基线 `1519ab5138acbca7f5c3ee9f1e8f3e9ab84bc59d`，016证据 `15e4d13fa9423ddb474432719468a8a8409823e9`。
独立分支 `industry-ui-004`。使用已验收的industry-016-view.v1及原TRACE、LEDGER、VIEWS与SYNTHETIC-VIEWS；没有重跑工业实验。

顶部新增“016前送与恢复（只读）”。先选独立分支，再选择其中的检查点：
主线五点（T8起点、照管付款、E8到账、T9恢复前、恢复后）；无操作E8到期、未恢复E9到期两个真实对照；原五条SYNTHETIC样例。真实与合成均保留原始来源标签，模式和分支不合并库存。

重点展示A10→B10→C10、E8到账/T9可用、G-I-01步损1→0及1P＋2 E2消费历史；RP不变，照管1I来自装备账户内部划拨，人员原账户不变。E8运力账区分上限、SP占用、freight、预留、剩余及cargo规格；8W仅计一次。代价表显示G-REC-02少维护0.5SP、D2→2.5，以及G-I-01库存相对参照+1SP、G-PZ-01−0.5SP。

未恢复E9分支显示C10隔离仍占仓容和真实维护损失，并显著注明无同期无货运对照，不能归因全部损失。人员来自实验假定后备池，没有实际训练回执。35项全局阻塞保留，无预算、前送、照管、恢复或续期业务按钮。

### 启动和校验

从仓库根目录启动（Node.js 20+，页面零安装依赖）：

```sh
node experiments/industry-ui-001/serve.mjs
# http://127.0.0.1:4173/ ，Ctrl+C停止
python experiments/industry-ui-001/extract-016.py --source /path/to/pinned/experiments/industry-integrate-016 --check
```

Python提取器先比对10个固定源文件Git blob，再复用原view.export_view，校验TRACE/账本/原视图/合成样例及前后源摘要。静态页面不依赖原工业目录。去掉--check只重建UI静态模块。完整映射与七检查点来源见 **FORWARD-DEPENDENCIES.md**。

```sh
cd experiments/industry-ui-001
npm test
# 另一个终端运行静态服务器，测试环境已有Playwright和Edge
npm run test:browser
```

56项单元测试通过（原40＋新增16）。四模式在1440×1100、820×1180、1024×768复验，包括R1 E24终局到账/受阻约束。结果见UI004-VALIDATION.json及原三份回归报告；无脚本错误、外部请求、写请求或页面横向溢出。表格在更窄宽度保留内部横向滚动。

截图输出环境变量：FORWARD_SCREENSHOT_DIR；浏览器模块可用PLAYWRIGHT_MODULE指定，默认msedge通道。三张交付截图为ui004-desktop-recovered.png、ui004-tablet-unused-e9.png、ui004-tablet-synthetic-held.png。**这是浏览器视口检查，非真机验收。**

变更仅位于本UI目录。原demo/012/013模块及测试保持基线；016及旧工业证据原字节不变。提交带[CF-Pages-Skip]，不合并、不部署、不接写接口。

## 历史UI-003及之前说明

以下保留前轮基线和口径；本轮入口另增加016，只读记录仍彼此独立。


**可点击演示使用内存模拟；012、013模式只读离线导出，均非实时连接。REAL仅指已完成的隔离实验记录；SYNTHETIC保留原样例来源，不代表真实推进。**

## UI-003 人员与装备同仓

固定UI基线：`aeeceb9be390ec3a1c8d0f0711f4f63a66aa2f73`。独立分支：`industry-ui-003`。
013来源固定为 `2d04264a3f4ba6d38f76a99ae76821cc0a55abdb`，只消费已验收的 **industry-013-personnel-view.v1**。

新增“013人员与装备（只读）”模式，提供7个检查点及原VIEWS全部18条样例（含4条REAL重复观察点，未去重或改名）。默认T8；检查点/原标签、origin、实际回合/阶段、来源SHA同时展示。来源标识与9个文件的Git blob/SHA-256可展开查阅。未新增申请、前送、恢复、续期、新编或结算操作。

- 单一A10仓读取013的warehouse：T8人员驻留1P、可用1P、隔离0P、入库预留0P；装备为原012驻留2 E2，不与012模式相加。012历史P=0不覆盖当前人员。
- 人员账户累计拨款2I与装备账户累计拨款10I分别展示、分别守恒，不合并为可互用预算。initial尚未导入时人员拨款按原记录为0。
- REAL E7结算后快照已进入T8/GERMAN_SUPPLY_RAIL，1P已可用；T8检查点则是GERMAN_RECOVERY。来源是初始受训预备池假设，actualTrainingReceipt=null，没有新完成训练的声明。
- 4LQ总额度在成功记录中已全部使用，不按E刷新。主路径照管至E8结束，此后仍留后方会隔离；隔离属于实物子集且继续占仓容。合成过期及终局样例均保留SYNTHETIC与原始快照回合。
- 四种提交失败显示各自失败前账本：照管支出1I、托管1I、运送支出0、驻留0P、已用0LQ。拒收HELD则保留在途1P、入库预留1P、已付运送费与已用额度。
- 未导出信息显示“未提供”；未知schema、缺失必需字段或不一致账本隐藏整个数据视图并列明错误，不沿用上一条或演示默认值。

### 本机启动与离线复现

Node.js 20+；静态页面零安装依赖。从仓库根目录运行：

```sh
node experiments/industry-ui-001/serve.mjs
# 访问 http://127.0.0.1:4173 ，Ctrl+C停止
python experiments/industry-ui-001/extract-013.py --source /path/to/pinned/experiments/industry-integrate-013 --check
python experiments/industry-ui-001/extract-012.py --source /path/to/pinned/experiments/industry-integrate-012 --check
```

提取需要Python 3。013源目录必须与指定提交的原始字节相符；9个文件摘要固定在提取器中。先验证源码与证据摘要，再以`python -B`调用原`export_view.py`共25次，核对所有原样例、对应检查点和最终EVIDENCE；随后复查源文件未变。去掉`--check`只重新生成本UI目录的`records-013.mjs`。没有运行013的prepare/verify、Core或生产事务。原013文件不改动。

### 验证与截图

```sh
cd experiments/industry-ui-001
npm test
# 另一个终端已运行静态服务器；使用已有Playwright与Edge
npm run test:browser
```

`PLAYWRIGHT_MODULE`可指定已有Playwright包，`BROWSER_CHANNEL`默认msedge。`PERSONNEL_SCREENSHOT_DIR`指定UI003截图输出位置。40项单元测试通过（原10 + R1终局5 + UI002映射11 + UI003映射14）。原测试文件原样保留。三种模式均在1440×1100、820×1180、1024×768视口复查，包括013全部25条记录、字段映射、账户守恒、隔离占位、有效期、失败账本、未知schema/缺字段、模式隔离；R1 E24到账/受阻/托管约束保留。无脚本错误、外部请求或写请求。

`UI003-VALIDATION.json`记录新增检查，`UI002-VALIDATION.json`及`VALIDATION.json`记录回归。三张新增截图：`ui003-desktop-e7-t8.png`、`ui003-tablet-portrait-expiry.png`、`ui003-tablet-landscape-failure.png`，随交付证据提供；页面保留原视觉。**均为浏览器视口检查，非真机验收。**

接口映射见 `PERSONNEL-DEPENDENCIES.md`；旧012映射与演示边界见 `INTERFACE-DEPENDENCIES.md`。仅本UI目录的展示、适配器、静态数据及测试/文档变更；不修改012/013原文件或主体客户端。保存分支的提交带`[CF-Pages-Skip]`，不合并、不部署。

## 历史 UI-002 / R1 说明

以下保留前两轮的基线、验证及演示口径；各模式互相独立。


## UI-002 只读实验记录

UI-R1固定基线：`00a97635d882509675fe4d5f6e789cdbc791fdc0`（独立分支 `industry-ui-001-r1`）；本轮分支 `industry-ui-002`。012数据固定提交：`e64c0e11fb16b05cfe725240193e8590b4eefd88`，消费已有 **industry-012-view.v1**。仍只修改本UI目录，不修改012源文件。

顶部可切换“可点击演示”和“012实验记录（只读）”。演示保留R1终局约束；记录模式提供6个REAL检查点（initial、funded、accepted、E5、E6、T7）及10个原样合成验证样例。切换仅浏览静态快照，没有下单、结算推进或重试写入接口。切回演示保留其独立内存状态。

- E5标签是已完成E5结算的记录，实际已进入T6。E5剩余4工作点显示为历史算术剩余，窗口已关闭，可用0且不结转。
- E6标签的实际回合是T7、阶段为GERMAN_SUPPLY_RAIL，2 E2已经可用。没有添加真实“E6到账未可用”快照。
- 容量、仓位阻塞和HELD保留SYNTHETIC标记；失败样例显示各自提交失败前账本，生产进度1/2、产出0、交接托管2I，不采用重试成功结果。
- 未导出的报价、计划产量报价、生产仓/A10容量上限与权限显示“未提供”。预留独立显示，不计入实物。未知schema、必需字段缺失、守恒不符均拒绝展示，不填演示默认值。

### 离线提取与核验

`records-012.mjs`是必要静态数据，包含来源完整SHA、9个源文件Git blob/SHA256、012证据摘要和16份未改动的v1视图。`extract-012.py`先核对固定Git blob，再调用012原`export_view.py`的6次`--checkpoint`及10次`--sample`只读入口；原入口核对TRACE/VIEWS证据摘要，提取器再比对重复检查点与最终证据。以`-B`禁止写入源目录pycache；不导入生产适配器，不运行prepare/verify，不启动Core或求解器。

```sh
python experiments/industry-ui-001/extract-012.py --source /path/to/pinned/experiments/industry-integrate-012 --check
```

去掉`--check`可在本UI目录重新生成静态模块。页面通过ES模块加载此文件，服务器仅增加静态资源白名单，CSP仍为`connect-src 'none'`；没有fetch、业务HTTP、WebSocket、存储写入或公网部署。

### UI-002 验证

```sh
node --test experiments/industry-ui-001/tests/adapter.test.mjs experiments/industry-ui-001/tests/records.test.mjs
node experiments/industry-ui-001/tests/browser.mjs
node experiments/industry-ui-001/tests/records-browser.mjs
```

Node测试26/26通过（原10 + R1终局5 + 只读映射11）。浏览器脚本需本机静态服务器和既有Playwright/Edge；支持下面说明的`PLAYWRIGHT_MODULE`。1440×1100、820×1180、1024×768复查原演示与R1终局，以及全部16条记录、关闭容量、失败账本、未知schema、缺字段和模式隔离。记录结果见`UI002-VALIDATION.json`，演示回归见`VALIDATION.json`。隐藏模式中的控件不参与可见点击目标尺寸检查。`RECORD_SCREENSHOT_DIR`可保存桌面E6/T7和平板视口HELD截图。本轮已检查截图，无横向溢出；仅视口测试，不是真机验收。

## R1 补修（2026-10-03）

修补基线：`254dd9179944d183762a3bb6db7ce7cd4b5cccda`。只改本目录，保留原视觉和演示适配器。

- E24实际到账保留A10实际库存2 E2，可用0；`availableFromTurn=25`仅显示为账本信息，不提供T25操作。
- E24仍受阻时，在途/目的仓容占位，或生产暂存/交接费托管照实保留。终局未完成生产保留已有进度与生产仓预留。没有退款、补产、虚构入库或E25推进。
- 适配器命令和按钮快照共用允许动作判定；E24内仍允许合法发运及接收，后续结算/回合动作均被拒绝。终局页面明确显示不可用或未完成，保留重置演示能力。
- 报价、产量、工期、订单ID、阶段细节、预计可用和终局说明均来自适配器快照；HTML只保留占位与通用标签。没有创建工业012正式接口。

原10项适配器测试原样保留，新增5项终局测试，合计15/15通过。新增场景：E24到账、E24持续HELD、E24发运失败保留托管、E24发运后同E接收、E24生产未完成。浏览器三种原视口均复验原主要流程、连续阻塞至终局，以及替换快照报价/产量/工期/编号/阶段文本的展示测试。无脚本错误、外部请求或横向溢出。`VALIDATION.json`已更新为R1结果；原三张截图仍是初版证据，未覆盖改写。

浏览器测试默认不覆盖基线截图；显式设置 `UPDATE_SCREENSHOTS=1` 才更新。设置 `R1_SCREENSHOT_DIR` 可另存两张E24终局截图。本轮另存并查看桌面终局到账、平板终局HELD截图；这些仍是浏览器视口检查，不是真机验收。

初版仅新增 `experiments/industry-ui-001/`，初版基线与规则参考为完整提交 `90758efccda736e3524348d8876b892be3d7938f`（RULE-CAMPAIGN-007）。演示模式的10I、3I、2I、2个结算边界和T5/E5/E6/T7来自UI演示任务，不构成正式参数批准，也不解除规则007阻塞；012模式读取其独立隔离实验的已验收导出。

## 启动与操作

需要 Node.js 20+，运行页面不需要安装任何 npm 包。在仓库根目录运行：

```sh
node experiments/industry-ui-001/serve.mjs
```

访问 http://127.0.0.1:4173 。或者在本目录运行 `npm start`。服务器固定绑定 `127.0.0.1`，仅允许读取白名单内的页面静态资源，CSP 禁止连接接口。Ctrl+C 停止。无公网、隧道、部署配置或付费资源。

1. 核对 2 E2:L 产量、5I 总费用、2 个结算边界、无阻塞时 T7 可用。
2. 点击提交，观察等待状态；700ms 仅模拟响应延迟，期间没有账务或库存变化，不是生产倒计时。
3. 接受后可用5I、托管2I、生产支出3I。逐次点击推进 E5（1/2）和 E6（2/2）。
4. E6 生产完成后2 E2位于生产暂存；点击模拟发运转入在途，托管转为交接支出；点击接收确认转入A10库存，此时可用0。
5. 推进至T7，可用2 E2。P始终0，没有C10运输或部队恢复操作。

演示控制台可选择一次性的订单拒绝、响应丢失、发运容量不足、接收资格受阻。拒绝与未确认允许原ID重试；发运受阻保留生产暂存及托管，接收受阻保留在途实物及目的仓容占位。后两种异常的重试推进到下一结算；E7实际到账后T8可用。可再次选择异常以演示连续阻塞。重置或刷新只清空此页面的内存夹具，不是游戏取消订单、退款或重开生产的能力。

## 演示账本

|确认节点|可用I|托管I|生产支出I|交接支出I|生产暂存E2|在途E2|A10实际E2|A10预留E2|可用E2|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|T5 下单前 / 等待 / 拒绝 / 未确认|10|0|0|0|0|0|0|0|0|
|T5 接受；E5进度1/2|5|2|3|0|0|0|0|0|0|
|E6 完成，等待交接|5|2|3|0|2|0|0|0|0|
|E6 发运 / 接收受阻|5|0|3|2|0|2|0|2|0|
|E6 接收确认|5|0|3|2|0|0|2|0|0|
|T7 可用|5|0|3|2|0|0|2|0|2|

接受时生产暂存预留2 E2，产出时转为实物并释放该预留。A10容量预留仅在发运确认时建立。初始预算恒等于可用+托管+两种支出；产出恒等于生产暂存+在途/HELD+A10实际库存。预留不计入实物，可用是实际库存的子集。

## 文件边界

- `view.mjs` + `index.html` + `styles.css`：展示与交互呈现，不写账本、不调用服务。
- `demo-adapter.mjs`：独立、易替换的内存演示状态机和候选视图模型；重复成功提交/回执不会重复扣费或加料。
- `app.mjs`：绑定视图和演示适配器，无生产服务选择开关。
- `serve.mjs`：仅本机静态服务，不读取主体客户端资源。
- `INTERFACE-DEPENDENCIES.md`：012已验收只读契约的映射及演示边界。
- `record-adapter.mjs`、`record-view.mjs`、`records-012.mjs`：只读校验映射、展示与固定来源静态记录。
- `tests/`、`VALIDATION.json`、`screenshots/`：可复跑的测试及少量证据。

页面无Core、FOW或其他Worker运行代码的导入/修改；无真实预算写入、生产服务、浏览器存储、外部字体、CDN或网络接口调用。演示内存状态机不证明工业012的原子事务、真实容量、授权、持久幂等、跨进程恢复、真实账本或实际阶段合法性；只读模式展示012已有证据，不重新执行其验证。

## 验证

```sh
node --test experiments/industry-ui-001/tests/adapter.test.mjs
```

初版10项覆盖正常账务/物料流、提交等待并发点击、拒绝/未确认重试、成功重复提交/回执、发运失败、HELD重试、连续阻塞、重置时陈旧响应和非法跳步。R1保留这些测试并增加上述5项终局检查。

浏览器测试在运行本机服务器后执行（测试环境需已安装 Playwright 与 Edge；页面本身无依赖）：

```sh
node experiments/industry-ui-001/tests/browser.mjs
```

可通过 `PLAYWRIGHT_MODULE` 指定既有 Playwright 包路径、`BROWSER_CHANNEL` 指定已安装浏览器通道。测试只访问127.0.0.1，阻止并记录非本机请求；会更新本目录验证报告。截图更新选项见R1说明。

本轮 Edge 154.0.4258.53，1440×1100、820×1180、1024×768 三种视口均通过正常链路及四种异常/重试检查；无页面脚本错误、无外部请求、无水平溢出，按钮和选择器高度至少44px。已人工查看整页截图，预算、主操作、状态、库存无重叠或截断。**这是浏览器视口模拟，不是真机/触控/真实工业接口验收。**

- [桌面 · 下单前](screenshots/desktop-order.png)
- [桌面 · E6已到账但不可用](screenshots/desktop-received.png)
- [平板视口 · E6接收受阻](screenshots/tablet-held.png)

远端保存使用独立分支及 `[CF-Pages-Skip]` 提交，不合并、不部署。
