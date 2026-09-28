# AI-003 验证记录

环境：执行容器 Node v24.19.0，Node test runner；浏览器请求单独记录。所有构建/测试输出保存为 `evidence/ai003/*.log.gz`，包括失败。

| 检查 | 最终实际结果 |
|---|---|
| Root / server typecheck | 通过，typecheck-candidate.log.gz |
| 生产 + 独立实验 build | 通过，build-final-candidate.log.gz；生产开关 false |
| server build | 通过，server-build-candidate.log.gz；仅编译，未发布 |
| AI 原回归 + 新本地10项 | 39/39，ai-final.log.gz；其中原 AI001/002 为29项 |
| 最终新增本地专项（含冷入口） | 11/11，local-final.log.gz；不是另行声称完整40项单次运行 |
| 完整 Web | 637/637，web-candidate.log.gz，147432.8ms |
| Worker 产物 | 70个可达模块，0 Node 导入，0 WebSocket；artifact-audit.json |
| 原 AI002 轨迹 | 本轮重跑生成5份，解析JSON均与基线压缩证据一致；ai002-evidence-comparison.json |
| Core/vendor/地图/美术 | git diff 无修改，复用 AI002 / CORE-BASELINE 证据；本轮未重跑原Core全量 |
| 云端浏览器 | 未通过进入：ERR_BLOCKED_BY_CLIENT；未进行交互验收 |
| 华为真机 | 未执行，不标记通过 |

## 调试失败保留

- build-first：TypeScript 阶段窄化及非导出符号导入错误，修复类型和正确源码导入。
- client-first：新增 client 未纳入 AI 编译输入，补清单；client-second 2/2。
- web-final（文件名来自首轮，并非最终结论）：583/637；新增 main 模块语法使旧 VM 函数截取无法解析，及入口冻结哈希。
- web-targeted-repaired：278/280；剩余非本地 bind 依赖和嵌套冻结清单。修复后 web-fixture-confirm 22/22，最后全量637/637。
- local-candidate：10/11；新增冷入口测试读取 AI 编译目录中未生成的 main.js。改为用项目 TypeScript 对真实 src/main.ts 编译后测试，不依赖不存在的文件；cold-entry-confirm 1/1，最终 local-final 11/11。
- 浏览器原始阻塞见 browser-block.json。没有替换为 CLI Playwright 或外部部署绕过。

冻结哈希逐项：ua002/main、ua003/main、ua003r1/main，ua003r1 嵌套 ua002/ua003 清单，ua003r1/startup-progress 夹具。没有更改任何规则、隐私或触控断言。主入口只加实验门控/生命周期，原生产控制流保留。

## 未完成验收

真实浏览器需要：两阵营冷启动；人类 ATTACK→AI反应/撤退；脚本AI ATTACK→人类反应；增援；推进/突破；自然终局；STOP确认换座位；退出/新局时旧任务不回写；拖动/缩放不受AI计算阻塞。自动化已覆盖数据/生命周期语义，不能代替实际布局、触摸、浏览器模块Worker或性能验证。

候选可供下一位审查和本机验证，暂不宣称已具备验收通过的人机可玩版本。基础移动/进攻策略仍未实现，存档明确不支持。
