# Test harness: initialize only from existing legal fixture + accepted Actions.
import sys
import server
from test006 import CASES,pending
from bounded import warm_start
if __name__=='__main__':
 warm_start()
 if sys.argv[1]=='three-clips':server.state,server.initial=server.load('prepare','new')
 else:server.state=pending(CASES[sys.argv[1]]);server.initial=server.state
 print('ready',flush=True);server.HTTPServer(('127.0.0.1',8765),server.Handler).serve_forever()
