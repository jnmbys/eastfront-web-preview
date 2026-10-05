# 地理依据、许可与转换

实际访问日期：2026-10-05。连续参考窗：白俄罗斯中部至东部、明斯克以东的别列津纳河—上第聂伯河—西德维纳河分水岭及附近河谷；不是把东欧不同地区拼贴。地形、交通和开局战线是为这个参考窗原创概化的候选。

## 逐项查看及采用范围

|官方资料|实际查看|具体借鉴与边界|
|---|---|---|
|[War in the East 2，第7–11章官方PDF](https://ftp.matrixgames.com/pub/WarInTheEast2/WarintheEast2Chapter7-11.pdf)|第7章地图/地形，印刷页135–138；渲染查看PDF第3页（印刷136）|一格主要地形与格边河障分离，林地/湿地约束走廊，道路连接受阻地区、铁路是接通网络。只借方法，不复制商业图面或其10英里尺度、战斗参数。|
|[GMT Army Group Center官方页](https://www.gmtgames.com/p-594-barbarossa-army-group-center-1941-2nd-edition.aspx)、[官方Map C规划图](https://www.gmtgames.com/bagc/agc_mapc.pdf)|下载并渲染整张规划图，观察河流、湖群及城镇交通交会；阅读官方[Playbook](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/bagc/Barb-AGC_PlayBook_Final_Lo-Res.pdf)开头及目录|借鉴支流汇入主河、森林/湖区留下通行走廊、路轨通过聚落与渡河点形成分叉。Map C主要在本窗以西，不取其格位或描摹整图。标准规则另一个链接403，未声称读到。|
|[Natural Earth 1:10m物理数据](https://www.naturalearthdata.com/downloads/10m-physical-vectors/)、[河流](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/)、[湖泊](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/)|实际下载v5.0.0全球河流、欧洲补充河流、湖泊并提取本窗矢量|保留Daugava、Dnieper、Berezina、Drut、Sozh、Ula、Neris的相对位置、连续河段与汇合关系；湖泊概化为Naroch/Lukoml附近各一格。没有把现代水库面积直接当1941地形。|
|[ESA WorldCover data access](https://esa-worldcover.org/en/data-access)|实际阅读数据年份、分类数据获取和许可说明|认识林地、草地、湿地、水体应分开处理及现代数据时间限制。未下载/抽取10m栅格；本次森林/湿地多边形不是WorldCover实测分类结果。|
|[UNESCO Berezinsky](https://www.unesco.org/en/mab/berezinsky)|阅读保护区地理与生态概述|北部近分水岭低地的森林、泥炭湿地、湖泊相邻关系；仅作定性空间关系依据，不把保护区面积比例外推整个战区。|

Natural Earth遵循[公共领域条款](https://www.naturalearthdata.com/about/terms-of-use/)，本仓提交的是其裁剪矢量与独立原创布局。欧洲补充数据源于JRC CCM；此处使用Natural Earth发布的概化版本，不另分发原始CCM数据。ESA数据为CC BY 4.0；本仓没有重发其像素。商业PDF仅本地阅读，未将页面或截图纳入游戏/仓库。地图截图全部是游戏自行渲染的本场景。

## 转换与原创部分

1. `extract-reference.py`按经纬窗逐线段裁剪，保留断开的part，禁止跨出窗河段被错误直连；SHA256固定在hydrology.json。
2. 地理经纬度映射到纸面格网，再用原Core纸面↔轴坐标转换。河线吸附到真实六角顶点图，河流是邻格共享边，不是穿越格中心的贴图。
3. 保留Drut的现代Lake Centerline几何作为连续河道参考，不模拟该水库面积。初版过滤它导致断河，最终恢复这段公开数据。Berezina河口简化误差为约1条六角边，显式连接到Dnieper，修正边记录在map-diff。各命名河流连通与三处汇流都有检查。
4. 森林、丘陵和湿地采用layout.json里的非周期多边形：北部林湖/泥炭低地，中西与东北分水岭丘陵，中央较开阔走廊，南部河谷湿地及高岸林地。没有均匀随机撒点，也没有把现代植被/高度认定为1941状态。尚未使用DEM验证局部坡降。
5. 路轨先连接指定聚落、工区、站场、目标和侧向联络，作者侧寻路避湖、惩罚湿地/丘陵/跨河；桥梁只由真实路轨跨河边产生。运行时移动、铁路和运输读取同一Core边。道路与轨道容量依旧001，没有免费航运或自动工兵。

## 可复跑

游戏和检查只需要已提交hydrology.json，不需要GIS库。根目录运行 `node experiments/grand-campaign-002/check.mjs` 确定性生成map.json/map-diff并执行短验证。

如需从官方原数据重建水系：安装pyshp至临时 `.geo-reference/python`，将下列URL下载为 `.geo-reference/rivers.zip`、`rivers-europe.zip`、`lakes.zip`；再运行 `python experiments/grand-campaign-002/extract-reference.py`。该临时目录被忽略，不进入游戏构建。

- https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_lake_centerlines.zip
- https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_europe.zip
- https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_lakes.zip

`python -m pip install --target .geo-reference/python pyshp` 仅供重建，正常运行无需安装。重建后先比对hydrology.json中的原压缩包哈希；来源若更新须重新审查，不宣称重建数据与v5相同。10公里与纬经窗是近似战略尺度，河边吸附和保留旧渲染格网都会产生形变，不用于实际测距或历史定位。
