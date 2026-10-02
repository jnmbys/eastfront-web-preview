# CAMPAIGN-004 离线复跑

结论和能力缺口见[REPORT.md](REPORT.md)。这是一组直接调用既有新补给权威入口的研究夹具，所有输出仅在本目录。没有修改、启动或部署生产服务。

## 环境

- 本地Git对象包含运行基线`813b4072568352e95d0726fe5fe04060c889c554`及用户指定的三个研究提交。普通完整仓库的相关分支已含这些对象；若为浅克隆，须先取得对象，再离线运行。
- Python 3.12、NumPy 2.3.5、SciPy 1.17.0；Node 22或以上；本地TypeScript编译器。本次Python 3.12.14、TypeScript 5.9.3，完整版本在PROVENANCE.json。
- 使用已有符合版本的虚拟环境；不要禁用Python断言。准备脚本不会联网下载依赖。

在仓库根目录执行，`<本地tsc路径>`指已有TypeScript包的`bin/tsc`文件：

```text
python docs/campaign-004/prepare.py --tsc <本地tsc路径>
python docs/campaign-004/run.py
python docs/campaign-004/analyze.py
python docs/campaign-004/test_seams.py
```

`prepare.py`将固定运行子树恢复到本目录忽略的`.runtime`，调用原恢复夹具脚本和本地编译器；原工程不写入。`run.py`先核对原运行文件及编译物哈希，再从空部署运行固定seed17的同一条实际动作链。`analyze.py`只读取保存证据。测试重新执行同一条请求序列，比较所有接受/拒绝和每步哈希；它不是另一个策略实验。

全程保留原3秒事务预算。若依赖缺失、哈希不符、Core拒绝预期动作或配送超时，停止并报告失败，不放宽预算、不提高来源、不写假状态继续。Windows环境已实际执行；本轮不宣称其他平台或线上资源限制已验收。

## 读取证据

```python
import gzip, json
from pathlib import Path
rows = json.loads(gzip.decompress(Path('docs/campaign-004/ACTIONS.json.gz').read_bytes()))
print([(r['label'], r['accepted']) for r in rows])
```

原数量q为四分之一SP；Core的RP、MP以及运输工作量W/T不要混作SP。装备、P/E、工业候补在运行模型中缺失，未知不是0，也不由夹具补齐。

输入原文位于`inputs/industry004`、`inputs/rule002r1`、`inputs/campaign003`；保留原研究的权限状态和参数。`layout-source.json`来自固定R1引用，不是新批准地图。运行配置、Core和地图没有因这些文档而改变。

输入目录是原文选摘，保留原相对链接，未复制被引用的全部研究账本；需要查看这些引用时，应在PROVENANCE.json指定的原提交和原路径中打开。选摘不改变原文，也不将历史“待审”说明升级为运行授权。
