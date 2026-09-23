# MP-006 同环境一次对照（尚未执行）

使用同一 iPad / Safari / 校园网 / 无 VPN，以及同一新版前端。保持视口、缩放、Unit Models、动画设置一致。另一位玩家也保持同一设备和连接条件。

正式入口：
- A（v2 / 回退）：https://jnmbys.github.io/eastfront-web-preview/?transportDiagnostics=1&snapshotFormat=snapshot-v2-inline-view
- B（v3）：https://jnmbys.github.io/eastfront-web-preview/?transportDiagnostics=1&snapshotFormat=snapshot-v3-map-table

仅在发布确认后使用这两个链接；旧版入口不支持 B。

按 A → B → B → A 四批交错执行，每批 5 次，合计每种格式 10 次。每批新页面、新房间，采用相同场景、相同苏军前五个单位和相同五个合法部署格/顺序；先离开旧房间并关闭旧标签，避免两个页面争用同一身份。不要把切换造成的重连计入部署等待。

每批双方均等待地图全部三种 LOD 完成（地图细节加载提示消失且没有失败提示）再部署。导出会记录每次发送时 `lodCompleted=3` 与 `lodFailed=false`；未满足者不计入对照。每次等控件恢复再进行下一次。

打开“连接诊断”，完成五次后刷新服务器证据一次，按“导出 JSON”，依次保存 A1、B1、B2、A2。导出不含 token、完整状态或单位坐标。每次实际格式必须与所选格式相同，无格式回退、QUERY_MATCH 或 RESYNC_MATCH。

汇总：
```
node scripts/mp006/summarize-device.mjs A1.json B1.json B2.json A2.json > device-comparison.json
```

记录实际格式、完整 UTF-8 JSON 字节、发送→ACK、ACK→对应回调、解析（含信封检查）、校验、重建（含表结构检查）、同步应用/通知、发送→控件恢复。原 MP-005C 时间事件保持不变，额外拆分通过独立诊断事件记录。诊断额外 JSON.parse 与计时均有开销，两组一致开启；这些是应用层计时，不能区分网络、中间节点与浏览器调度，控件恢复不是像素呈现。

`confirmAt=null` 时不计算点击→发送。客户端与服务器时钟不能相减。历史三次样本不纳入候选改善百分比。若本次未体现等待改善，保存这一次结果并停止叠加编码方案及反复连接测试。

真机验收：PENDING。没有用户设备访问能力；未将本机 Node 数据称为 iPad 或云浏览器结果。
