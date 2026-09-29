# AI-LEGACY-AUDIT — 2026-09-29

基于 fae794de84d885e0d498c1dea6dfdcd5865d74d3，只做静态审计及既有 CSV 重计数；未运行模拟器、回放验证、训练或当前实验，未改代码/规则/部署。

## 来源与完整性

先查仓库：`core/source/docs/LEGACY_AI_ANALYSIS.md` 与 `core/source/reference/legacy-v6-operational-graph-simulator.py` 已存在；后者与归档 V6 Python 逐字节一致。
三份指定文件均可访问，Library IDs：ZIP `libfile_85e0b7b5ec948191ae0fe4948d252c72`；交接 MD `libfile_5bf3d1af57708191ac31d5223cb7080b`；迁移 MD `libfile_6b882a90b4688191b38820fa8b217688`。
ZIP `EASTFRONT_AI_LEGACY_HANDOFF_2026-09-21.zip` SHA256：`981cf7a1733ab5542cc7cb88f74c200796dad3b8397010bb395d498ceac28050`。解包后 SHA256SUMS.txt 列出的 77 项全部匹配；这证明归档内部完整性，不证明历史对局真实性或确定性。以下路径均相对于归档根目录。

## 1. 实际程序与设计说明

- 实际 Python：`raw/东线突击_全规则_AI_V3.2_模拟器.py`、`expanded/V4/东线突击_全规则_AI_V4_Hybrid_模拟器.py`、raw 中 V5_Adaptive_Staff、V6_Operational_Graph 模拟器。均有 main/argparse、固定 seed、games、CSV 输出；V4～V6 支持 aiG/aiS 版本选择。属于可执行模拟/比较程序源码，不是仅设计。
- 尚未验证当前环境可运行：顶部硬编码 `/mnt/data/` 地图路径。V3～V5 所需 v9 地图在 expanded/V4；V6 原始 F 地图缺失，仅有 `recovered/eastfront_strategic_reset_F_AI_map_RECOVERED_from_replay.json`，不能据此保证原运行环境等价。
- 未找到独立自动权重搜索器、跨局训练循环、神经模型或学习权重。权重主要硬编码；批量比较可辅助人工调参。V4 有宏观 rollout；V5 `_update_memory` 是单局跨回合指数记忆，且读取全量敌我实力，不是离线训练或跨局已学习模型。
- V7、V8.3～V8.8 无独立实现/精确权重：仅 `docs/V7_RECOVERED_BEHAVIOR_SPEC.md`、`docs/V8X_V88_RECOVERED_BEHAVIOR_SPEC.md` 及遥测。不得按名称认定实现已恢复。

## 2. 成绩证据等级

| 归档 raw CSV | 本次重计数（德胜） | 可核实与缺口 |
|---|---|---|
| V3.2_96局模拟 | 9/96 | 逐局 seed、结果和统计；源码及精选 HTML 回放存在 |
| V4Hybrid_24局实验 | 8/24 | seed、ai_G/ai_S、计划统计；源码及精选回放存在 |
| V5_对照实验_24局 | V4/V4 0/8；V5德/V4苏 3/8；V4德/V5苏 0/8 | 有 experiment、seed、版本及记忆统计；源码、精选 JSON/HTML 存在 |
| V6.2_同种子对照实验_64局原始数据 | V5/V5 4/16；V6.2德/V5苏 5/16；V5德/V6苏 4/16；V6.2/V6.2 3/16 | 有逐局配置标签、seed、统计；V6 源码及 recovered/V6.2_replay_DATA.json 存在，不等于已证明该源码生成全部 V6.2 数据 |
| V7_纯加时_逐种子对照 | T16 7/20；T18 10/20；T20 16/20 | 20 个 seed 与三种回合上限结果；缺精确源码。另有 16 局摘要，不能混作同一批 |
| V7_vs_V8.8_36局逐种子 | 双方各 26/36，34/36 同胜方 | 可复核 CSV 算术；无精确源码/完整配置绑定，不能重现或证明策略增强 |

V8 smoke/feature/probe/v85 文件有 seed、版本/功能标签及局面统计，属小样本遥测；S1_CRN 两份为汇总表，不能单凭其名称确认随机流配对。V5/V6 JSON 确有 meta/map/replays，精选回放存在不等于所有局都有完整 Action/RNG 重放链。本次没有验证其语义或与 CSV 一一对应。所有成绩均是历史记录支持，非本次独立复现；无源码成绩、通用强度排序、训练成功及数字版性能均未证实。

## 3. 当前公平接口适配判断

核对现有 `ai/authority/projection.ts` 和 `FairHost.ts`：策略只得到白名单 FairView、PublicRules、授权历史与独立 agentRandom；候选由 observationCandidates 限定，Core.apply 仅在 Host 内。旧迁移文档建议的 legalActions/combatPreview 查询不是当前授权接口，不能照搬。

- 可另立任务改写为纯评分：公开地图路线/枢纽价值、已知目标进展、己方角色移动优先级；只能依据授权占位，未知道路不保证安全。当前 AI-005 已有路径规划，先比较复用。
- 有条件适配：V5 计划惯性/记忆、V7 预备队与守一城攻第二城、V8.8 攻城纪律。记忆仅保存合法观察、不得恢复隐藏敌情；会话重置。V7/V8.8 只是可研究设计，不能称为旧代码移植。敌军总实力、包围、补给和铁路安全需保留未知；不得用全状态算出再注入策略。
- 战斗期望、组合攻击、HQ/退却偏好须先核对当前公开规则和候选能力；旧 CRT、阈值、全知合法性、协同攻击组合不能直接复用。当前不开放的能力需另立任务，不通过拒绝探测隐藏状态。
- 禁止移植旧规则引擎、直接状态修改、旧补给/增援/胜利判定及 RNG；每次只提交授权 Action，再依据新观察评估。

下一步建议：保留档案，研究聊天优先提出一个仅使用授权观察的评分假设；如要声称 V7/V8.8 可复现，先补精确源码、规则/配置版本及逐局回放绑定。本轮停止，不跑实验。
