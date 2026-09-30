# SUPPLY-CI-017 — 现有隔离服务更新方案（待批准，未部署）

唯一目标：`eastfront-supply-sandbox` / `srv-dathekek1f9s7389ksvg`，工作区 `tea-daos1iugekts73erk8j0`。试玩入口：`https://eastfront-supply-sandbox.onrender.com/?supply=experiment`。不涉及正式服务、main/source-main、AI、多人、存档或新增资源。

## 固定版本与镜像边界

受测源码固定为 **813b4072568352e95d0726fe5fe04060c889c554**（supply-verify-016），始终由独立 checkout 获取，未在构建前修改。017 分支只承载验收驱动、日志和本方案，不能把其 HEAD 冒称受测源码。

实际 CI 镜像完整 ID、基础镜像摘要、镜像配置、构建日志见本目录 `evidence/run-*/report.json` / `build.log`，最终有效运行见 REPORT017.md。镜像仅存在于临时 GitHub runner；**未推送镜像仓库，无可供 Render 拉取的 CI 镜像引用**。批准方案是 Render 从上述固定源码重新构建，**不是部署 CI 受测镜像**。015 Dockerfile 的基础标签可变，固定源码不保证新构建字节相同；必须保存新 deploy ID、实际源码、构建日志/摘要并完成下述复验。

## 配置差异（审批范围）

| 项目 | 013 留存配置 | 拟批准配置 |
| --- | --- | --- |
| 服务/地区/实例 | 同一服务 / Singapore / 1 | 保持 |
| 规格 | 0.5 CPU / 512 MiB | 保持；不得自动升级 |
| 自动部署/PR 预览 | off / off | 保持 |
| 分支 | supply-campaign-012 | supply-verify-016；部署时固定完整 SHA，不用浮动最新版本 |
| Root Directory | experiments/supply-exp-005 | 空（仓库根） |
| Docker Context | `.`，相对子目录 | `.`，仓库根 |
| Dockerfile Path | ./Dockerfile | experiments/supply-integrate-015/Dockerfile |
| Docker Command override | 空，使用 python online.py | 空，使用 python experiments/supply-integrate-015/service.py |
| 健康检查/端口 | /healthz / 10000 | 保持 |

保持 `COOKIE_SECURE=1`、`PUBLIC_ORIGIN=https://eastfront-supply-sandbox.onrender.com`、`BIND_HOST=0.0.0.0`、`PORT=10000`、`OPENBLAS_NUM_THREADS=1`、`WEB_CONCURRENCY=1`、`PYTHONUNBUFFERED=1`；原 `ENABLE_CAMPAIGN=1` 可保持。CI 只为容器回环 HTTP 设置 COOKIE_SECURE=0，**不能带入公网配置**。不添加磁盘、数据库、密钥或付费资源。

## 发布后的必要复验

仅在 Leader 批准且确认 013 回滚镜像仍可用后，才更新同一服务配置并单次手动部署固定源码。此文件不执行任何发布。

1. 记录 Render 新 deploy ID、完整源码 SHA、构建摘要；确认仍单实例 0.5 CPU/512 MiB、自动部署关闭。平台重建的镜像与 CI 镜像分别记录。
2. HTTPS `/healthz` 返回 `SUPPLY-INTEGRATE-015-v1`；`source=aca1f4...` 是冻结结算源标识，不等于应用构建 SHA。检查入口及 JS/CSS 资源成功、匹配 Origin、Secure/HttpOnly/SameSite cookie。
3. 实际浏览器新/旧建局与锁定版本、双方切换、代表性动作及配送回执。复用合法检查点只限私有验收进程；不得为公网加入检查点注入入口。手机/平板未实测不能冒称通过。
4. 在实际新镜像/同规格的私有验收进程重做本轮配送、四会话隔离、503 忙碌拒绝、3 秒回滚；与当前 Render 服务的外部健康/建局验收区分记录。观察服务内存、退出/OOM、事务耗时和错误日志。不通过即停止接受试玩并按回滚方案恢复，不扩大配置或超时。

## 会话影响与回滚

更新和回滚均会清空服务内存中的对局；最多四局、30 分钟空闲过期，没有存档恢复。发布前告知试玩者重新建局；不要把刷新页面当作恢复旧局的保证。

013 回滚目标：**dep-dauattnavr4c738ergg0**，源码 **aca1f4b9801ab7b7c7073ac7973bb028cd6df435**。恢复表中 013 分支、Root Directory、Dockerfile/context、空 command override（python online.py）及原环境；保持同一服务/规格/域名/自动部署关闭，然后回滚该已保留镜像并复验旧沙盘健康与建局。不得选 013 之前的早期短局版本。

013 证据 `experiments/supply-exp-005/evidence/deploy013/deployment.json` 记录当时 live，不能单凭历史记录保证今天仍可回滚。若镜像已不可用，应暂停更新；从固定 013 源码重建只算替代候选，须先验收并单独批准，不能冒称原镜像回滚。

当前实时配置与回滚可用性的核查结论见 REPORT017.md。Render 连接器要求先由用户确认工作区；未确认前不调用该工作区管理读取，更不修改服务。
