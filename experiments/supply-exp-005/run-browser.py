import subprocess,time,urllib.request,os,pathlib,sys
root=pathlib.Path(__file__).resolve().parent
server=subprocess.Popen(['python3','server.py'],cwd=root,stdout=open(root/'evidence/browser-server.log','w'),stderr=subprocess.STDOUT)
try:
 for k in range(60):
  try:urllib.request.urlopen('http://127.0.0.1:8765/',timeout=1);break
  except Exception:time.sleep(.2)
 env=dict(os.environ);env.setdefault('CHROMIUM_PATH',str(root.parent/'browser-runtime/chromium'))
 testfile=sys.argv[1] if len(sys.argv)>1 else 'browser-test.cjs'
 p=subprocess.run(['node',testfile],cwd=root,env=env,timeout=240,capture_output=True,text=True);(root/'evidence'/(pathlib.Path(testfile).stem+'.log')).write_text(p.stdout+p.stderr);print(p.stdout+p.stderr);raise SystemExit(p.returncode)
finally:server.terminate();server.wait(timeout=10)
