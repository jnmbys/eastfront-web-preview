"""Optional software GIF export from the rasterizer's PNG frames; requires Pillow."""
from PIL import Image
from pathlib import Path
import sys
frames=Path(sys.argv[1]);out=Path(sys.argv[2] if len(sys.argv)>2 else 'evidence/ua-002')
for directory in sorted(frames.iterdir()):
    images=[Image.open(path).convert('RGB') for path in sorted(directory.glob('*.png'))]
    if not images: continue
    # GIF has centisecond precision; distribute rounded durations to preserve 24 ms pacing.
    durations=[(round((i+1)*2.4)-round(i*2.4))*10 for i in range(len(images))]
    durations[0]+=400;durations[-1]+=700
    images[0].save(out/(directory.name+'.gif'),save_all=True,append_images=images[1:],duration=durations,loop=0,optimize=False)
print('Software GIFs saved: normal playback plus explicitly documented bookend review holds.')
