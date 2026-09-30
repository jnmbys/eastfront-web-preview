# Leader审批用：仅更新现有隔离服务

**当前结论：有条件预览候选，尚不满足发布门槛。没有部署。** 容器缺失阻塞仍需补测；治理文件位置待补充。这里的“原配置”来自固定基线保存的013证据，并非本轮读取的实时Render配置。

目标唯一限定 `eastfront-supply-sandbox` / `srv-dathekek1f9s7389ksvg`，Singapore，原单实例0.5 CPU/512MiB；autoDeploy关闭、PR预览关闭；不新增资源、磁盘、数据库、生产Secrets或WSS。Render workspace必须由Leader/用户确认后才能调用管理工具。本轮未获取或改变任何凭据。

| 配置 | 原版本（013证据） | 待批准版本 |
| --- | --- | --- |
| 固定运行SHA | aca1f4b9801ab7b7c7073ac7973bb028cd6df435 | supply-verify-016 最终远端核对完整SHA（见交接） |
| 分支选择 | supply-campaign-012 | supply-verify-016；仍关闭自动部署，手动指定完整SHA |
| Root Directory | experiments/supply-exp-005 | 清空，仓库根 |
| Dockerfile Path | 默认Dockerfile | experiments/supply-integrate-015/Dockerfile |
| Docker Context | 沙盘子目录 | 仓库根 `.` |
| Docker Command override | 空；CMD python online.py | 空；CMD python experiments/supply-integrate-015/service.py |
| 试玩路径 | `/` 沙盘 | `/?supply=experiment` 主体热座新/旧补给 |
| 环境 | 原配置 | 保持 COOKIE_SECURE=1、PUBLIC_ORIGIN=https://eastfront-supply-sandbox.onrender.com、BIND_HOST=0.0.0.0、PORT=10000、OPENBLAS_NUM_THREADS=1、WEB_CONCURRENCY=1、PYTHONUNBUFFERED=1；ENABLE_CAMPAIGN=1可保留，主体入口内部已开启 |

先在可用Docker宿主对最终完整SHA检出，复用015 Dockerfile/verify.py和012限资源参数；禁止把012旧沙盘镜像结果替代主体镜像：

```sh
docker build -f experiments/supply-integrate-015/Dockerfile -t eastfront-supply-verify016 .
docker run -d --name supply016-start --cpus .5 --memory 512m --memory-swap 512m --pids-limit 128 -p 127.0.0.1:18765:10000 -e COOKIE_SECURE=0 -e PUBLIC_ORIGIN=http://127.0.0.1:18765 eastfront-supply-verify016
# GET /healthz，记录ready耗时、docker inspect限制、cgroup memory.peak/memory.events；真实创建新旧局。
docker run --name supply016-target --cpus .5 --memory 512m --memory-swap 512m --pids-limit 128 --network none -e COOKIE_SECURE=0 eastfront-supply-verify016 python experiments/supply-integrate-015/verify.py
docker cp supply016-target:/app/experiments/supply-integrate-015/evidence/verification.json ./verification-container016.json
docker inspect supply016-start supply016-target
```

以上命令**本轮未执行**。需要验证退出码、代表性配送、原3秒总事务预算、完整状态/骰点/账本一致、超时回滚、容器无OOM，并采集运行中的memory.peak/memory.events。限资源上出现超过预算应失败并保留证据，不能提高CPU/内存或放宽3秒。停止和删除只限本次明确命名测试容器，保留日志和结果。通过后再提交Leader最终发布审批。

Leader批准并核对同一服务配置及回滚可用性后：保存上述配置但不自动发布，选择最终完整SHA单次手动部署；健康检查通过后访问 `https://eastfront-supply-sandbox.onrender.com/?supply=experiment`，再次验收建局、热座、配送回执。Huawei仍由真实设备验收，不能以本机1280×720冒称通过。双方更新都会清空旧内存会话，发布前说明重新建局。

回滚目标为013实际成功部署 `dep-dauattnavr4c738ergg0`，运行SHA `aca1f4b9801ab7b7c7073ac7973bb028cd6df435`。执行前确认该部署仍可回滚；恢复Root Directory `experiments/supply-exp-005`、原Dockerfile/context、空Command override（python online.py）、原分支supply-campaign-012及ENABLE_CAMPAIGN=1，再在同一服务回滚该成功镜像或手动固定SHA重建；保留原Secure cookie/域名/规格和关闭自动部署。验收旧沙盘健康与建局。不得回滚到013之前的早期短局版本，也不得移动main/source-main。回滚仍丢失内存会话，无存档恢复。
