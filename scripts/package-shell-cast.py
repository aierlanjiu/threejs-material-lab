"""Copy native generated layer atlases and measure their alpha rectangles.

PNG pixels are never cropped, painted, resized or otherwise edited. The rig
uses texture rectangles at runtime, keeping original alpha and native detail.
"""
from pathlib import Path
import hashlib
import json
import shutil

import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, binary_dilation

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/band-cast-v2/one-piece'
JOBS = ROOT / 'output/shell-performance-20261029/image-jobs.json'
NAMES = dict(luffy='路飞', zoro='索隆', nami='娜美', sanji='山治', chopper='乔巴',
             robin='罗宾', usopp='乌索普', ace='艾斯', law='罗', shanks='香克斯')
INSTRUMENTS = dict(luffy='主唱麦克风', zoro='贝斯', nami='手风琴', sanji='爵士鼓',
                   chopper='木琴', robin='竖琴', usopp='吉他', ace='萨克斯', law='键盘', shanks='大提琴')
TUNING = {
    'luffy': dict(neck=[.50,.98], bodyNeck=[.46,.01], mouth=[.50,.77], prop=[.60,.665,.26,.58], grips=[[.61,.57],[.27,.52]], shoulders=[[.64,.08],[.27,.08]]),
    'zoro': dict(neck=[.41,.96], mouth=[.54,.75], prop=[.55,.70,.82,None], grips=[[.78,.58],[.36,.71]]),
    'nami': dict(neck=[.51,.69], bodyNeck=[.45,.01], mouth=[.56,.56], prop=[.50,.745,.70,None], grips=[[.81,.68],[.29,.68]], hairBehind=True),
    'sanji': dict(neck=[.50,.97], bodyNeck=[.45,.01], mouth=[.52,.80], prop=[.50,.70,.96,None], grips=[[.67,.48],[.32,.48]]),
    'chopper': dict(neck=[.50,.98], mouth=[.51,.80], prop=[.50,.76,.90,None], grips=[[.68,.53],[.30,.53]]),
    'robin': dict(neck=[.50,.69], mouth=[.56,.57], prop=[.68,.62,None,.72], grips=[[.69,.54],[.55,.68]], center=.35, hairBehind=True, scale=.82),
    'usopp': dict(neck=[.42,.90], mouth=[.53,.69], prop=[.55,.71,.88,None], grips=[[.79,.59],[.36,.72]]),
    'ace': dict(neck=[.48,.95], mouth=[.58,.78], prop=[.766,.64,None,.46], grips=[[.70,.57],[.67,.71]]),
    'law': dict(neck=[.48,.96], mouth=[.54,.78], prop=[.50,.76,.95,None], grips=[[.69,.61],[.31,.61]]),
    'shanks': dict(neck=[.46,.96], bodyNeck=[.42,.02], mouth=[.50,.70], prop=[.66,.58,None,.76], grips=[[.73,.45],[.273,.675]], armFlip=[None,1], center=.36),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rectangles(path):
    im = Image.open(path)
    assert im.mode == 'RGBA'
    alpha = np.array(im)[:, :, 3]
    assert alpha.min() == 0 and alpha.max() == 255
    labs, _ = label(alpha > 32)
    sizes = np.bincount(labs.ravel())
    boxes = find_objects(labs)
    selected = []
    for k in np.argsort(sizes[1:])[-6:] + 1:
        assert sizes[k] > 4000, (path, sizes[k])
        y, x = boxes[k - 1]
        rect = [max(0, x.start-4), max(0, y.start-4),
                min(im.width, x.stop+4)-max(0, x.start-4),
                min(im.height, y.stop+4)-max(0, y.start-4)]
        # Rectangles overlap other pieces in an exploded sheet. Runtime masks
        # select this component, including its antialiased contour, only.
        owned = binary_dilation(labs == k, iterations=3) & (alpha > 0)
        rx, ry, rw, rh = rect
        runs = []
        for row, line in enumerate(owned[ry:ry+rh, rx:rx+rw]):
            edges = np.flatnonzero(np.diff(np.r_[False, line, False].astype(int)))
            for start, stop in zip(edges[::2], edges[1::2]):
                runs.append([int(row), int(start), int(stop-start)])
        selected.append({'rect': rect, 'maskRuns': runs, 'pixels': int(sizes[k]),
                         'center': [(x.start+x.stop)/2, (y.start+y.stop)/2]})
    selected.sort(key=lambda p: p['center'][1])
    ordered = sorted(selected[:3], key=lambda p:p['center'][0]) + sorted(selected[3:], key=lambda p:p['center'][0])
    names = ['body', 'head', 'leftArm', 'rightArm', 'instrument', 'mouth']
    return im.size, {name: item for name, item in zip(names, ordered)}, float(np.mean(alpha == 0))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = json.loads(JOBS.read_text())
    actors = []
    for job in jobs:
        ident = job['id']; source = Path(job['source']); target = OUT / f'{ident}.png'
        shutil.copy2(source, target)
        assert sha(source) == sha(target)
        size, layers, empty = rectangles(target)
        actor = dict(id=ident, actorId=f'one-piece/{ident}', name=NAMES[ident],
                     instrument=INSTRUMENTS[ident], atlas=f'{ident}.png', size=size,
                     sha256=sha(target), layers=layers, rig=TUNING[ident],
                     transparentFraction=empty, source='native-image-gen-layer-art',
                     status='assembly-review-draft', pixelEdits=False)
        actors.append(actor)
        print(ident, size, {k:v['rect'] for k,v in layers.items()})
    manifest = dict(version=1, title='珍珠贝壳 · 十位2.5D分层角色制作稿',
                    actors=actors, layerCount=60,
                    notice='Native generated resolution is recorded, not the requested 3K size. Rig and contact poses require visual review; no phoneme lip-sync claim.')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print('COPIED_AND_MEASURED',len(actors),'actors',60,'layers')


if __name__ == '__main__':
    main()
