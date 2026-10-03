"""Check the documented Windows launcher against an occupied loopback port."""
import json,os,socket,subprocess
from paths import HERE
def main():
    if os.name!='nt':raise SystemExit('This launcher check is Windows-specific.')
    with socket.socket() as guard:
        guard.bind(('127.0.0.1',0));guard.listen(1);port=guard.getsockname()[1]
        result=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(HERE/'start.ps1'),'-Port',str(port)],
            capture_output=True,env=dict(os.environ,PYTHONIOENCODING='utf-8'),timeout=30,creationflags=subprocess.CREATE_NO_WINDOW)
        error=result.stderr.decode('utf8',errors='replace')
        assert result.returncode==2,(result.returncode,error)
        assert '端口不可用' in error and '未终止其他进程' in error
        with socket.socket() as probe:assert probe.connect_ex(('127.0.0.1',port))==0
    with socket.socket() as probe:assert probe.connect_ex(('127.0.0.1',port))!=0
    (HERE/'LAUNCHER.json').write_bytes((json.dumps(dict(task='INDUSTRY-INTEGRATE-017',status='PASS',
        command='start.ps1 -Port <occupied loopback port>; default Python detection',
        processExitCode=result.returncode,existingListenerNotTerminated=True,testListenerClosed=True,
        scenarioInstantiated=False),indent=2)+'\n').encode())
    print('LAUNCHER_PASS_PORT_CONFLICT_NO_OTHER_PROCESS_TERMINATED')
if __name__=='__main__':main()
