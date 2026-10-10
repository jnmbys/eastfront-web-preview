# 官方 DLC 参考范围调整（2026-10-10）

用户撤销关闭所有可选 DLC 的限制。参考改为 HOI4 1.19.3 + 已拥有、实际启用的官方 DLC，无 Mod；BlackICE 不参与。已有需求及属性提取保留，科技、第五排、团属支援等资格仍须逐项核验，不由文件存在自动开放。

## 已观察的三个层次

- Steam 属性 → DLC，完整列表 8 项，安装勾选均开启：Anniversary Pack、Death or Dishonor、German Historical Portraits、Poland - United and Ready、Rocket Launcher Unit Pack、Together for Victory、Waking the Tiger、Wallpaper。
- 安装目录存在 44 个可选 DLC 描述文件。完整文件名单见 evidence/owned-dlc-review.json；描述文件存在不代表拥有。
- 当前 dlc_load.json 保留原 9 个 Mod、disabled_dlcs 为空。这不是无 Mod 运行证据，也不证明 Steam 授权。未启动新局，未记录新的主菜单版本或校验码。

## 当前核验障碍

安装根目录存在 cream_api.ini、steam_api64_o.dll，以及与之并存的 steam_api64.dll。未修改或删除这些文件；不将此环境的 DLC 返回值当成官方拥有清单。继续引擎行为验证需要经过确认的官方 Steam 安装及本账号真实 DLC 组合。仅建立空播放集无法证明底层程序为官方原版。本轮没有启动游戏、修改游戏配置、购买 DLC 或创建测试播放集。

## 保留与代码

完整备份位于本机 runtime/hoi4-full-backup-20261010-owned-dlc，包含用户目录、启动器 Roaming 配置和本游戏 Steam 本地云存档，保留逐文件 SHA256 清单；个人数据不提交 Git。此前 settings.txt 精确恢复失败的结论仍有效，新备份不冒充首次探测前版本。

reference-profile.json 更新参考策略和已观察清单，实际启用组合标 UNVERIFIED，不将未知解释为关闭全部 DLC。模板 ID 回执、平板布局、有来源属性及需求核算保留。7 项现有定向事务测试通过；不部署，不推进网页用户战役。
