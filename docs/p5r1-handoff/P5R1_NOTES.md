# P5R1 — City S02 视觉语义微修

**READY FOR LEADER REVIEW**。不宣称 Formal PASS。

唯一修改的生产文件：`city/small/S02.png`。以已通过 P5 的原 ZIP 为基线；其 SHA-256 见 changed-assets 清单。

将横向贯穿聚落、向下伸向外缘及上侧短支线的明显土路表面替换为不规则草地/土壤纹理，弱化“中心道路通向边缘”的方向。近建筑局部庭院痕迹可保留。未添加铁路或平行轨道线。

图像编辑使用内置 image_gen；集成时只采用道路及其少量过渡区域内的生成颜色像素，区域外保留原像素，整个 alpha 通道逐像素保留。建筑布局、聚落外形/透明轮廓、512×512 尺寸及原 anchor 语义保持。编辑区域遮罩用于审计和评审，不是新增运行时资产。

其余 122 张生产 raster、manifest.json、原有所有其他文件逐字节保留。asset ID、路径、family/variant、sourceSize、LOD、transform、确定性及数量均未改变。没有修改 Core、Geometry 或 Renderer。UI Worker 可直接替换该同路径 PNG，无需代码变更。

评审：review/P5R1/S02_before_after.png；S02_transparent.png；City_Hex_schematic.png。示意合成使用包内地表和真实交付 S02，另绘简单示意 Hex/铁路；未绘战略 Road。它不是实际 UI 截图，不使用真实地图坐标，也不作为生产 Geometry。本轮未运行正式地图，因此不宣称真实 OUTER_CITY 29,-5 的 UI 复验通过。

原 P5/P4 文档和 review 为历史记录；本次结果以 P5R1_* 文档及 review/P5R1 为准。完整包内仍为 123 张生产 raster。
