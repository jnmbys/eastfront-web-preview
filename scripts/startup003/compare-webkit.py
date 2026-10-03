"""Quantify saved native and forced-onload/Canvas images; requires Pillow + numpy."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import numpy as np

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'evidence/startup-003')
results = {}
pairs = [
    ('webkit-native-baseline-cold-cold', 'webkit-native-candidate-cold-cold'),
    ('webkit-native-baseline-cold-cold', 'webkit-native-baseline-cold-warm'),
    ('webkit-native-candidate-cold-cold', 'webkit-native-candidate-cold-warm'),
    ('webkit-native-baseline-cold-warm', 'webkit-native-candidate-cold-warm'),
    ('webkit-canvas-baseline-cold-cold', 'webkit-canvas-candidate-cold-cold'),
]
for first, second in pairs:
    a = Image.open(root / (first + '.png')).convert('RGBA')
    b = Image.open(root / (second + '.png')).convert('RGBA')
    assert a.size == b.size
    diff = ImageChops.difference(a, b)
    values = np.asarray(diff, dtype=np.int16)
    results[first + ' vs ' + second] = {
        'differentPixels': int(np.any(values != 0, axis=2).sum()),
        'totalPixels': a.width * a.height,
        'maxChannelDifference': int(values.max()),
        'meanAbsoluteChannelDifference': sum(ImageStat.Stat(diff).mean) / 4,
        'pixelsChannelDifferenceOver2': int(np.any(values > 2, axis=2).sum()),
        'pixelsChannelDifferenceOver8': int(np.any(values > 8, axis=2).sum()),
    }
native = json.loads((root / 'webkit-native.json').read_text(encoding='utf8'))
results['sourceTypes'] = [
    {'label': row['label'], 'cache': row['cache'], 'types': {
        kind: sum(job['sourceKind'] == kind for job in row['trace']['jobs'])
        for kind in sorted({job['sourceKind'] for job in row['trace']['jobs']})
    }} for row in native['reports'] if 'trace' in row
]
(root / 'webkit-pixels.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf8')
