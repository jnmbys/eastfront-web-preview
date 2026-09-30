# 离线审计过程记录

- 原 8 局文件均按父提交 blob 核验，未覆盖或补跑；原首局进程异常证据仍完整保留在 AI-EVAL-012。
- 本轮 timeline 初次实现未区分拒绝的状态提交语义，使用了 `engine.apply` 在 REJECTED 时的返回状态，最终 hash 断言失败。修正为只有 accepted 时替换状态，与 FairHost 相同；修正后原始事件与终态验证通过。未保留当时 stderr；最初创建的空 timeline-first-failure.log 不构成日志，已移除。此失败不是原实验的遗漏局。
- timeline 初次战斗筛选使用了不存在的 BattleResolved/CombatResolved 事件名，派生 battles 为空。源码改为 CRTResolved，并由 summarize.mjs 从已经保存的事件时间线补提取骰点/结果/RNG，未额外调用策略或运行比赛。
- 所有新增内容局限于本审计 evidence 目录。原构建 SHA256、原测试日志 blob 和原证据 blob 已检查。验证代码仅对固定原记录回放；单次策略调用只用于 14 个冻结关键节点，并核验输出等于原选择。
