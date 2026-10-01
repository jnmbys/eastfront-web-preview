# 实际新镜像的单次私有验收

**尚未执行，不是通过证据。** 在现有服务的Live部署 `dep-dav1e1npn0mc739lk1ng` 的Render **Shell** 中执行下面一段；不在本机终端执行。若当前Live ID不同，先停止。代码核对实际环境的应用SHA，下载不可变017验收驱动并验证SHA256，然后只运行既有配送/四会话/忙碌/3秒回滚定向检查。

```sh
python - <<'PY'
import os,sys,json,hashlib,urllib.request,tempfile,runpy
from pathlib import Path
fixed='813b4072568352e95d0726fe5fe04060c889c554'
meta={'expected_deploy':'dep-dav1e1npn0mc739lk1ng','expected_source':fixed,'environment':{k:os.getenv(k) for k in ['RENDER_GIT_COMMIT','RENDER_SERVICE_ID','RENDER_INSTANCE_ID']}}
print(json.dumps(meta),flush=True)
if meta['environment']['RENDER_GIT_COMMIT']!=fixed or meta['environment']['RENDER_SERVICE_ID']!='srv-dathekek1f9s7389ksvg':
    raise SystemExit('BLOCKED: actual image identity not verified; do not substitute environment values.')
os.chdir('/app')
url='https://raw.githubusercontent.com/jnmbys/eastfront-web-preview/583d179ffabd146d18d1d40577516bb012a09387/experiments/supply-ci-017/verify.py'
data=urllib.request.urlopen(url,timeout=20).read()
assert hashlib.sha256(data).hexdigest()=='6f8edffa5c2661f195134ac3d7e7fcb64a73d8503db858c2e41b92fa1036afe6'
folder=Path(tempfile.mkdtemp(prefix='supply018-'));script=folder/'verify.py';script.write_bytes(data)
read=lambda p:Path(p).read_text().strip() if Path(p).exists() else None
meta['cgroup_before']={p:read('/sys/fs/cgroup/'+p) for p in ['cpu.max','memory.max','memory.swap.max','memory.events','memory.peak']}
meta['pid1_command']=read('/proc/1/cmdline')
sys.argv=[str(script),str(folder/'report.json')];code=1
try:
    runpy.run_path(str(script),run_name='__main__');code=0
except SystemExit as e:
    code=e.code if isinstance(e.code,int) else 1
finally:
    meta['exit_code']=code
    meta['cgroup_after']={p:read('/sys/fs/cgroup/'+p) for p in ['memory.events','memory.peak']}
    meta['report_path']=str(folder/'report.json')
    (folder/'identity.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(meta),flush=True)
raise SystemExit(code)
PY
```

将完整输出交回，包括开头身份、末尾report及identity。若下载或身份核对失败，保留缺项，不改版本/环境继续；不要循环重试。若实际配送/状态一致性/3秒验收失败，停止试玩，按已批准013回滚方案处理。

驱动只在独立Python验收进程内临时设置回环HTTP cookie/origin，并绑定 `127.0.0.1` 随机端口。合法检查点仅放进该进程自己的会话表；它没有访问运行中的公网会话，没有添加HTTP注入接口，也不编辑 `/app` 源文件或平台环境变量。故障仅模拟已执行动作后的投影延迟，以核对既有3秒原子回滚。

cgroup数据属于当前实例累计值，包含当前服务、Shell验收进程及临时Node/求解器，不能称服务单进程RSS；`memory.peak`不重置，OOM计数应比较前后增量。此实际镜像验收不替代真实浏览器截图，也不改变规格。若Shell并非目标实例或资源不可确认，应报告缺项，不能以其他容器结果替代。
