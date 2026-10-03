"""Compare exact RGBA pixels and event traces. Requires Pillow and numpy."""
import hashlib
import json
from pathlib import Path
from PIL import Image
import numpy as np

root = Path('evidence/startup-003-r1')
matrix = json.loads((root / 'webkit-matrix.json').read_text(encoding='utf8'))
reference_hash = next(r['rgbaSha256'] for r in matrix['reports'] if r['label'] == 'original' and r['cache'] == 'warm')
old_lod_data = json.loads(Path('evidence/startup-003/webkit-native-initial.json').read_text(encoding='utf8'))
old_lod_hashes = next(r['lifecycle']['hashes'] for r in old_lod_data['reports'] if r['label'] == 'baseline' and 'lifecycle' in r)
reference = root / 'webkit-matrix-original-0-cold-warm.png'
good = np.asarray(Image.open(reference).convert('RGBA')).astype(np.int16)
pairs = []
for row in matrix['reports']:
    if 'rgbaSha256' not in row:
        continue
    name = f"webkit-matrix-{row['label']}-{row['repeat']}-{row['scenario']}-{row['cache']}"
    a = np.asarray(Image.open(root / (name + '.png')).convert('RGBA')).astype(np.int16)
    assert a.shape == good.shape
    delta = np.abs(a - good)
    count = int(np.any(delta != 0, axis=2).sum())
    diff_name = name + '-diff.png'
    # Exact RGB difference, opaque for viewing; numbers include all RGBA channels.
    Image.fromarray(delta[:, :, :3].astype(np.uint8)).save(root / diff_name)
    pairs.append({'image': name + '.png', 'reference': reference.name, 'diff': diff_name,
                  'differentPixels': count, 'totalPixels': int(a.shape[0] * a.shape[1]),
                  'maxChannelDifference': int(delta.max()),
                  'meanAbsoluteChannelDifference': float(delta.mean())})
    if row['label'].startswith('r1') or row['cache'] == 'warm':
        assert count == 0, name

rows = []
for path in sorted(root.glob('*.json')):
    data = json.loads(path.read_text(encoding='utf8'))
    if 'reports' not in data:
        continue
    assert data.get('complete'), f'Incomplete browser run: {path}'
    for row in data['reports']:
        if row.get('engine') == 'webkit' and row.get('label', '').startswith('r1') and 'lifecycle' in row:
            assert row['lifecycle']['hashes'] == old_lod_hashes
        if 'trace' not in row:
            continue
        jobs, events = row['trace']['jobs'], row['events']
        decodes, decode_ms, tail_ms, matched = {}, 0, 0, 0
        for event in events:
            if event['kind'] == 'decode-start':
                decodes.setdefault(event['file'], []).append(event['at'])
            elif event['kind'] in ['decode-resolve', 'decode-reject'] and decodes.get(event['file']):
                decode_ms += event['at'] - decodes[event['file']].pop(0)
        for job in jobs:
            resources = [r for r in row['resources'] if r['path'].endswith('/' + job['file'])
                         and r['start'] >= job['start'] - 1 and r['responseEnd'] <= job['end']]
            if resources:
                matched += 1
                tail_ms += job['end'] - resources[-1]['responseEnd']
        blank = [e['id'] for e in events if e['kind'] == 'texture-consumed' and not e['visible']]
        if row['label'].startswith('r1'):
            assert not blank
            if row['engine'] == 'webkit':
                assert row['rgbaSha256'] == reference_hash
        rows.append({'dataset': path.name, 'engine': row['engine'], 'label': row['label'],
                     'repeat': row['repeat'], 'scenario': row['scenario'], 'cache': row['cache'],
                     'wallMs': row['wallMs'], 'jobs': len(jobs),
                     'duplicateJobs': len(jobs) - len({j['id'] for j in jobs}),
                     'requests': row['server']['requests'], 'duplicateRequests': row['server']['duplicates'],
                     'recoveries': row['server']['recoveries'],
                     'jobElapsedSumMs': sum(j['elapsedMs'] for j in jobs),
                     'resourceElapsedSumMs': sum(r['duration'] for r in row['resources']),
                     'decodePromiseSumMs': decode_ms,
                     'responseEndToReadySumMs': tail_ms, 'matchedReadyIntervals': matched,
                     'bitmapMs': row['draw']['bitmapMs'], 'bitmapCalls': row['draw']['bitmapCalls'],
                     'drawImageMs': row['draw']['ms'], 'drawImageCalls': row['draw']['calls'],
                     'pixelReadMs': row['draw']['readMs'],
                     'cpuWorkMs': sum(t['workMs'] for t in row['timings']),
                     'peakJobs': row['trace']['peakActive'], 'peakResident': row['trace']['peakResident'],
                     'peakDecodedRGBABytes': row['trace']['peakBytes'],
                     'activeAtEnd': row['trace']['active'], 'residentAtEnd': row['trace']['resident'],
                     'blankGroundTexturesConsumed': blank,
                     'emptyCanvasRejected': len([e for e in events if e['kind'] == 'canvas-reject']),
                     'rgbaSha256': row['rgbaSha256']})

assets = []
for path in sorted(Path('public/assets/terrain').rglob('*')):
    if path.suffix.lower() not in ['.webp', '.png']:
        continue
    with Image.open(path) as img:
        a = np.asarray(img.convert('RGBA'))
        visible = int(np.count_nonzero(a[:, :, 3]))
        assert visible > 0, f'Fully transparent terrain asset: {path}'
        assets.append({'path': path.as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                       'width': img.width, 'height': img.height, 'visiblePixels': visible,
                       'maxStripeRGBABytes': img.width * min(32, img.height) * 4})

def save(name, value):
    (root / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf8', newline='\n')

save('pixel-differences.json', pairs)
save('asset-visibility.json', {'scope': 'All checked-in public terrain PNG/WebP assets', 'assets': assets,
     'maxStripeRGBABytes': max(a['maxStripeRGBABytes'] for a in assets)})
save('summary.json', {'scope': '640 production hexes, visual seed 17, complete medium terrain surface; excludes DOM/session/network query startup',
     'timing': 'Single samples, sums overlap. Native decode Promise includes transfer/scheduling, NOT isolated decode CPU. drawImage/readback are synchronous API timings, NOT GPU completion. Resource memory is owned RGBA estimate, NOT browser RSS/GPU/network cache. Pixel differences require zero tolerance.',
     'rows': rows})
print(json.dumps({'pixels': pairs, 'assetsChecked': len(assets), 'summaryRows': len(rows)}, indent=2))
