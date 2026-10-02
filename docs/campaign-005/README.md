# CAMPAIGN-005

报告见 [REPORT.md](REPORT.md)。本目录保存三组短程实战、完整真实检查点、逐动作双方状态、固定政策和可复跑夹具。全部新增内容限制在本目录。

## 复跑

依赖：Python 3.12、numpy 2.3.5、scipy 1.17.0、Node 24.19.0，以及仓库中的固定Git对象。完整输入版本与哈希见`PROVENANCE.json`。

首次准备复用输入008/011已经核验的`.runtime`，只读复制到本目录忽略的`.runtime`。下列参数指向含`adapter.py`和`.runtime`的实验目录，不是工作树根：

```powershell
python docs/campaign-005/prepare.py --reuse-008 C:/Users/jinyibo/eastfront/industry-integrate-008/experiments/industry-integrate-008 --reuse-011 C:/Users/jinyibo/eastfront/industry-integrate-011/experiments/industry-integrate-011
python docs/campaign-005/run.py
python docs/campaign-005/validate.py
```

本机使用的Python解释器是`C:/Users/jinyibo/eastfront/extracted/eastfront-web-preview-a3346e4c34567811fb07652cb26b706833daa183/.venv/Scripts/python.exe`；普通系统Python若没有上述依赖会在准备阶段失败。

已完成准备后可不传两个`--reuse`参数，直接验证本地副本。干净机器需要先取得这两个固定输入版本的已准备运行依赖；可在它们各自的离线研究副本按原说明执行准备步骤，**不需要运行它们的verify测试套件**。本夹具不把缺失依赖替换成近似模型，也不自动写其他工作树。运行依赖较大，未把副本提交到Git。Windows建议保持短仓库路径；复制阶段支持扩展路径，Node执行使用正常路径。

`run.py`先核验全部三组历史前缀，再续算全部三组，结果写到`.runtime/replay`；精确比较已保存的所有续算游戏状态、查询、行动接受结果、历史检查点和材料语义。原保存记录不会被复跑覆盖。事务耗时和历史侧账中的求解耗时不跨运行要求相同；每次运行内部仍检查完整材料侧账不变。

`validate.py`只读取现有证据，进行本任务的守恒、状态连续性、原Core完整性、停止边界、政策和版本检查。`analyze.py`只从已保存记录重新生成`RESULT.json`，不执行游戏动作。三个脚本均不运行旧事务测试全套。

## 文件索引

| 文件 | 内容 |
|---|---|
| `POLICY.json` / `POLICY_LOCK.json` | 执行前固定的双方政策、待决处理和哈希 |
| `START_T5.json.gz` / `PROVENANCE.json` | 同一完整真实起点、来源版本及随机状态 |
| `PREFIX-*.json.gz` | 原008/011接口逐动作完整根、历史精确核对 |
| `HANDOFF-*.json.gz` | 恢复选择后直接交给原运行入口的完整根 |
| `RUN-*.json.gz` | T6恢复选择后至T7德军战斗结束，每动作完整双方前后状态 |
| `RESULT.json` | 单位、全军补给、战斗、位置、RP、材料与守恒比较 |
| `VALIDATION.json` / `REPLAY.json` | 针对性检查和三组精确复跑结果 |
| `BLOCKERS.json` | 原35项阻塞，关闭0项 |
| `HARNESS-ERROR-A.json.gz` / `IMPLEMENTATION-NOTES.json` | 排除的控制者填写错误与工程修复透明记录 |
| `FILES.json` | 交付文件SHA256清单（不含清单自身） |

压缩文件均为标准gzip UTF-8 JSON，保留全量状态，不依赖HTTP服务。`query.mjs`只在克隆状态上调用原Core做合法性、战力、待决选择及完整性查询；任何查询返回状态都不会作为游戏状态提交。实际动作只走原权威入口。

本次终点固定为T7 `GERMAN_RECOVERY`刚进入、尚未执行恢复，pending为空。没有苏军T7、E7、补材料或重复运输。原Core没有战役VP/W账，结果标为不可用。局部链通过不代表长期平衡、35项阻塞解除或运行接入获批。
