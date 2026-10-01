# 019 证据与最短复现

基线：`813b4072568352e95d0726fe5fe04060c889c554`。独立工作树/分支 `supply-rules-019`；原018工作树、未提交草稿及未推送的暂停提交原样保留，本任务未接管或推送018。未调用Render、浏览器、部署或AI工具。

现有环境复用：Node 24.19.0；原016工作树的 `.venv`（NumPy 2.3.5、SciPy 1.17.0）与已安装TypeScript。没有安装依赖。新工作树只按原脚本恢复带散列的fixture，编译原实验Core生成忽略文件；未复制修改运行时代码。精确Python版本、输入文件SHA256见 [provenance.json](evidence/provenance.json)。

在工作树中未找到 PROJECT_STATE、WORKER_PROTOCOL 或适用AGENTS文件，不补造管理体系。只增加本任务目录。

## 输入与规则依据

| 依据 | 本任务用途 |
| --- | --- |
| [CONTRACT015](../supply-integrate-015/CONTRACT015.md)、[CONTRACT006](../supply-exp-005/CONTRACT006.md) | 主体接线及战后操作边界；旧005/004的被后续覆盖条款不当作当前能力 |
| [campaign-config.json](../supply-exp-005/campaign-config.json)、[campaign.py](../supply-exp-005/campaign.py)、[legalmap.py](../supply-exp-005/legalmap.py) | 种子、来源、枢纽、B=4/8、初始3B、目标4B、默认完整时钟和范围8 |
| [live.py](../supply-exp-005/live.py)、[model.py](../supply-exp-005/model.py)、[signature_model.py](../supply-exp-005/signature_model.py) | 行动收费、债务/支付系数、逐级维护分配、配送/维护/损耗和3秒原子边界 |
| [Core rail](../supply-exp-005/core/src/rules/rail.ts)、[defaultRules](../supply-exp-005/core/src/scenario/defaultRules.ts)、[unit](../supply-exp-005/core/src/rules/unit.ts)、[combat](../supply-exp-005/core/src/rules/combat.ts) | 一次修路计划与4/5段；工兵承诺；攻击值向上取整、炮兵攻击0的实际限制 |
| [service.py](../supply-integrate-015/service.py)、[supplyClient.ts](../../src/experimental/supplyClient.ts) | 面板effect不带待攻击动作，数值标签及账本字段 |
| [checkpoint75](../supply-exp-005/evidence/campaign011-final/checkpoint-75.json.gz)、[checkpoint117](../supply-exp-005/evidence/campaign011-close/checkpoint-117.json.gz) | 既有合法状态，加载时校验完整bundle hash |
| [既有短记录](../supply-exp-005/evidence/campaign011-final/reserve-recovery-repeat.json.gz)、[修路记录](../supply-exp-005/evidence/campaign011-close/recover-attack.json.gz) | 复用已合法的移动、攻击、退却及修路命令；共享攻击前缀和原攻击/退却终态hash一致 |
| [016报告](../supply-verify-016/REPORT016.md)、[011恢复摘要](../supply-exp-005/evidence/campaign011-final/summary.json) | 复用已有G-I-01 8+8-4=12库存恢复及真实界面证据，不重复浏览器/部署验收 |

## 本轮最小验证

`compare_choices.py`固定六支选择，每支只到下一次配送：10/8/10/10/11/10次Action，共59次，加共享前缀4次＝63次。另有一次独立合法移动选项检查（inspect_choices.py中1次END_PHASE，不计入对照63次）。不完整重放58单位部署，不打整局，不循环搜索战果。每次成功Action沿用默认3秒，校验输入未修改与物资守恒；没有改状态“制造”短缺。

`check_panel.mjs`只截取并转译原有纯函数supplyPanel，传入真实对比分支中G-PZ-01的供给字段，再用原Core计算8×0.5=4。它不是浏览器截图，也未启动服务。

最短重现（使用已有含SciPy的Python与已安装TypeScript路径；先确认Core dist/fixture已存在，缺失才执行原恢复/编译）：

```text
python -X utf8 experiments/supply-rules-019/compare_choices.py
node experiments/supply-rules-019/check_panel.mjs <现有typescript/lib/typescript.js绝对路径>
```

六分支完整命令、事件、前后hash、选定单位/仓库、账本与耗时在 choices.json；其passed=true且每笔≤3秒。本地最快/最慢等数据只描述此次共享宿主，不是0.5CPU/512MiB或线上性能证明。容量上界是对checkpoint75的活单位B、来源cap求和；假设和数量均保存在capacity-bound.json。

## 已处理的验收脚本问题及边界

初次选择内置基础Python没有SciPy，随后复用已有项目venv；初次读取gzip使用系统GBK失败，统一显式UTF-8；面板核对脚本起初把单位ID前缀G-PZ误写为模板名，按实际checkpoint模板G-PANZER纠正后通过。都发生在研究脚本/环境选择中，不是游戏失败，也未改运行时来促成通过。

部分既有契约有历史或与代码不符的文字（尤其普通炮兵直接攻击），最终说明以固定源码为准。没有比较改变默认产能的restore片段，没有证明集中/分散全局优劣，也没有证明公平AI、完整战役或生产平衡。最终交付以PLAYER_GUIDE019和CHOICES019为准，唯一优先改进是假设性的信息呈现改进，未实施。
