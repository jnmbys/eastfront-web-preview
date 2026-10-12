# 装备优先级作者交付
独立工作区 hoi4-equipment-priority-001，同名分支；不Push/合并/部署，旧服务和存档不动。

- 生产/后勤与招募页调整总体取向；部队详情、招募行选择个体级别。已发运货物不撤回。
- 短缺同输入：FIELD一件到现役；RECRUIT一件到招募；EQUAL首轮现役、下一轮招募。高对象齐装/断路不阻塞合法招募。控制夹具只转移既有库存并设置接收进度，非自然战果。
- 正常种子219031，一天288步：招募到296人、49件步枪，未完成训练部署；原部队存在损耗和在途。没有赠资源。
- 浏览器1280×720：实际点击总体RECRUIT、招募高、G-019低、保存、刷新重连；恢复总体及招募设置。web-field.png/web-production.png。现役重连后的设置由保存/协议检查覆盖，未冒称再次点击检查。
- 真进程重启60步在途存档，再12步与未重启对照一致；双席身份、越权、重复、旧代次与隔离通过。取消实际返运、失守挂起/夺回恢复；0.03/0.04预留跨期、断路、对象消失清理组件检查。对象消失用清理入口，未声称自然战斗消灭。
- F1真实advance及边界回归通过。

复跑（工作区根）：node experiments/hoi4-equipment-priority-001/{check,protocol,normal,transit-check,restart-check}.mjs（逐个运行）；node --test experiments/hoi4-equipment-priority-001/reservation.test.mjs；node experiments/hoi4-factory-conversion-001/advance-f1.mjs after；node experiments/hoi4-factory-conversion-001/advance-f1-boundaries.mjs。
证据 evidence/hoi4-equipment-priority-001。构建 node experiments/hoi4-equipment-priority-001/build.mjs；运行须指定独立SAVE_DIR、PORT、STOP_FILE后 node experiments/hoi4-equipment-priority-001/server.mjs。

限制：未做真机、公网或长期平衡；默认FIELD是装备顺序兼容，不是旧交错时间序列逐项一致（见MODEL）。追加新地图另提交和说明。作者验证供独立审查。

收口补充：地图独立提交 61df5c501708898b81bca708596319e6f9c4349e。随后仅补本方分配反馈：已齐装不再显示混合短缺原因，库存不足及本轮已先供对象可见；不改变分配结果。feedback-check.mjs 和双身份protocol复验。最终source以运行 /release/info 的 build.source 为准。
关闭仅本轮4300：读取 evidence/province-hinterland-001/ui-process.json 的 root，在该目录创建 stop 文件，server会保存并退出；不要按端口杀其他服务。最终保存目录为该root/saves。
