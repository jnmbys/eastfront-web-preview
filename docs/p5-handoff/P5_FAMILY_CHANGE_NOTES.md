# P5 family change notes

状态：READY FOR LEADER REVIEW。共修订 73 张，冻结 50 张；没有遗漏约定的资产家族。

| 家族 | 本轮改动 | 保留项 |
|---|---|---|
| Forest | 12 mass + 6 fringe；把模糊团块细化为树冠、叶簇、局部明暗与高低差；林缘保留分离的稀疏布局 | 4 clearing masks；12/6/4 数量及选择规则 |
| City | 4 small + 6 medium + 4 major + 8 components；增加屋脊、瓦面、墙体、窗洞、烟囱与局部地表过渡；提高建筑与地面的区分 | 22 个既有文件/ID、锚点和三档聚落角色；权威道路另行渲染 |
| Marsh | 8 wet + 5 pool + 4 reed；以低饱和水色、岸泥、莎草、芦苇和局部反光丰富层次 | 湿地、水池、芦苇三层继续独立，可复用组合 |
| Hill | 6 material companion；增加克制的土壤/短草细节 | 6 height masks 原字节；高度与最终明暗仍由既有 Renderer 决定 |
| Rough | 6 base + 4 rock cluster；岩石裂隙、风化、苔痕及地表过渡 | 10 个既有变体，分层与 LOD 规则 |
| 其他 | 无外观改动 | Ground、Plain、River、Road、Railway、Bridge 原字节 |

每张资产都以对应 P4R3 文件单独编辑，未以单一成品的旋转、镜像或色调变化伪造变体。生产素材不含参考地图裁片。交付时执行合同尺寸归一化与 PNG 编码；Hill 将生成的 RGB 材质置回原 alpha 遮罩（原叠加强度逐像素保留），其余素材保留生成的真实 alpha。

清单与前后文件哈希：`P5_ASSET_HASHES.csv`。所有生产路径、变体数量及 companion 配对均可由最终 ZIP 审计复核。
