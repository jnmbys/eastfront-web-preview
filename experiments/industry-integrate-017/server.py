"""Local CLI entry; implementation name avoids original runtime module collisions."""
import sys
from local_http import main
if __name__=='__main__':sys.exit(main())
