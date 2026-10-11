# 003 公网发布核验

运行源码：`3d6eeb3070520fd8d3b03ee5cfdffff8baa149d4`。Render 部署 `dep-db53jkajnfac7394ant0` 为 Live，2026-10-10 21:14（北京时间）完成。后续证据提交不替代运行源码。

入口：https://eastfront-grand-preview.onrender.com/campaigns 。选择“多兵种编制候选”进入003；“原战役”和“新编制实验战役（步兵先行）”保留各自进度。不要清除访客凭证。

沿用1核/2GB、原持久盘及费用。用户在Shell核实 SAVE_DIR=/var/data/grand-public-1、强制持久盘开启、访客密钥存在、剩余741MiB。启动日志证明三模式最新存档备份校验先于监听完成，详见 deployment.json。未恢复旧快照、未迁移旧局、未访问或推进用户原战役。

发布后检查使用独立测试访客，通过实际公网HTTPS/WSS提交CLOCK与SAVE，分模式重连并待实例卸载后从Linux文件重读。public-before.json记录结果、战役ID及授权单位/编制摘要哈希。这是协议验证，不是浏览器完整试玩或平板性能验证。

第一次探针复用Client模块，未按页面导航重新捕获campaignMode，导致第二模式错误连接原战役；public-probe-scope-failure.json保留该失败。探针已按模式重新导入，并逐次断言传输战役ID和请求模式一致；没有据此修改线上代码。

剩余：整台服务重启后使用同一测试凭证核对三局（public-release-check.mjs after）；目前不能用实例卸载重载冒充整台服务重启。浏览器控制打开公网页面再次超时，已停止重试；华为/iPad真机、实际公网绘制性能及气泡视觉认可仍未通过本轮验收。

Render连接器没有Restart操作，普通trigger_deploy会取仍指向旧源码的关联分支，不能用于此次固定SHA重启。需控制台Manual Deploy → Restart service，保留当前源码和环境，再运行after检查。不要Deploy latest commit，不修改存档目录或访客密钥，不把发布前备份覆盖最新进度。

兼容回退沿用RELEASE.md：优先同版本关闭003入口并保留全部文件；旧引擎不得读取division-003。所有发布后的最新进度继续由原子保存及.bak保护。
