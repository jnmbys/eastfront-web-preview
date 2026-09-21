"""Software frame GIFs with truthful sampled intervals and review bookend holds."""
from PIL import Image
from pathlib import Path
import json,sys
root=Path(sys.argv[1]);out=Path(sys.argv[2] if len(sys.argv)>2 else 'evidence/ua-003')
for directory in sorted(root.iterdir()):
    timings=json.loads((directory/'frame-times.json').read_text())
    images=[Image.open(directory/t['file']).convert('RGB') for t in timings]
    durations=[max(10,round((timings[i+1]['at']-t['at'])/10)*10) if i+1<len(timings) else 20 for i,t in enumerate(timings)]
    durations[0]+=400;durations[-1]+=700
    images[0].save(out/(directory.name+'.gif'),save_all=True,append_images=images[1:],duration=durations,loop=0,optimize=False)
print('Software GIFs exported. Sampled normal-speed playback; 400/700 ms review bookend holds; GIF centisecond rounding.')
