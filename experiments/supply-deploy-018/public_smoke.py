"""Public HTTPS smoke only; no checkpoint injection or browser claims."""
import json,time,hashlib,urllib.request,urllib.error,http.cookiejar,uuid
from pathlib import Path
from datetime import datetime,timezone
BASE="https://eastfront-supply-sandbox.onrender.com"
VERSION="SUPPLY-INTEGRATE-015-v1"
OUT=Path(__file__).parent/'evidence'
report={"started":datetime.now(timezone.utc).isoformat(),"kind":"external HTTPS; not browser or private container verification","requests":[],"checks":[]}
clients=[]
def request(name,client,path="/experiment",body=None,origin=BASE):
    headers={}
    if body is not None: headers={"Content-Type":"application/json","Origin":origin}
    req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    start=time.perf_counter()
    try:r=client.open(req,timeout=30)
    except urllib.error.HTTPError as e:r=e
    with r:
        raw=r.read();status=r.status
        cookie=r.headers.get("Set-Cookie","")
        entry={"name":name,"status":status,"seconds":time.perf_counter()-start,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()}
        if cookie:
            entry["cookie_flags"]={k:k.lower() in cookie.lower() for k in ["Secure","HttpOnly","SameSite=Strict"]}
        try:data=json.loads(raw)
        except (ValueError,UnicodeDecodeError):data=None
        if data and "error" in data:entry["error"]=data["error"]
        if data and "supply" in data:entry.update(mode=data["supply"]["mode"],revision=data["matchRevision"],transaction_seconds=data["supply"]["seconds"])
        if path=="/healthz":entry["response"]=data
        report["requests"].append(entry)
        print(name,status,round(entry["seconds"],3),flush=True)
        return status,data,entry
def check(name,ok):
    report["checks"].append({"name":name,"passed":bool(ok)})
    if not ok:raise AssertionError(name)
def post(name,c,**body):return request(name,c,body=dict(version=VERSION,**body))
try:
    plain=urllib.request.build_opener()
    st,p,_=request("health",plain,"/healthz")
    check("health version",st==200 and p["version"]==VERSION and p["ready"])
    for path in ["/?supply=experiment","/app/main.js","/app/web/startupShell.js","/app/experimental/supplyClient.js","/styles.css"]:
        st,p,_=request("asset "+path,plain,path);check(path,st==200)
    for mode in ["new","old"]:
        jar=http.cookiejar.CookieJar()
        c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));clients.append(c)
        st,p,e=post("open "+mode,c,op="open",mode=mode)
        check(mode+" creation",st==200 and p["supply"]["mode"]==mode)
        check(mode+" secure cookie",all(e["cookie_flags"].values()))
    a,b=clients
    st,p,_=post("mode lock",a,op="open",mode="old");check("mode lock Chinese rejection",st==422 and "锁定" in p["error"])
    st,p,_=post("query new",a,op="query",revision=0);check("query new initial",st==200 and p["matchRevision"]==0)
    d=p["model"]["deployment"];q,r=map(int,d["zoneKeys"][0].split(","))
    st,p,_=post("one legal deployment",a,op="action",id="018-smoke-"+uuid.uuid4().hex,revision=0,action={"type":"DEPLOY_INITIAL_UNIT","deploymentUnitId":d["roster"][0]["id"],"hex":{"q":q,"r":r}})
    check("legal deployment within transaction budget",st==200 and p["matchRevision"]==1 and p["supply"]["seconds"]<=3)
    st,p,_=post("old isolated",b,op="query",revision=0)
    check("old session unchanged revision and mode",st==200 and p["matchRevision"]==0 and p["supply"]["mode"]=="old")
    for side in ["GERMAN","SOVIET"]:
        st,p,_=post("switch "+side,a,op="switch",viewer=side);check("switch "+side,st==200 and p["matchRevision"]==1)
    st,p,_=request("reject cross-origin",a,body={"version":VERSION,"op":"query","revision":1},origin="https://example.invalid")
    check("Origin restriction",st==403)
except Exception as e:
    report["failure"]=repr(e)
finally:
    for i,c in enumerate(clients):
        try:post("cleanup "+str(i),c,op="close")
        except Exception as e:report.setdefault("cleanup_errors",[]).append(repr(e))
    report["finished"]=datetime.now(timezone.utc).isoformat()
    report["passed"]="failure" not in report and "cleanup_errors" not in report
    (OUT/"public-https-smoke.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    print("RESULT",report["passed"],report.get("failure",""),flush=True)
raise SystemExit(0 if report["passed"] else 1)
