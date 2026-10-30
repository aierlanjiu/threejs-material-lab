"""Register intact generated cels. No limb editing, deformation or inpainting."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, binary_dilation

ROOT = Path(__file__).resolve().parent.parent


def source_cels(source, count):
    image = Image.open(source).convert('RGBA')
    pixels = np.array(image)
    components, _ = label(pixels[:, :, 3] >= 80)
    objects = []
    for identity, slices in enumerate(find_objects(components), 1):
        if np.count_nonzero(components[slices] == identity) > 800:
            objects.append((identity, slices))
    if len(objects) != count:
        raise ValueError(f'Expected exactly {count} complete cels; found {len(objects)}')
    # Order by rows first; native sheets need not have exact equal gutters.
    objects.sort(key=lambda item: item[1][0].start)
    ordered = []
    for row in range(count//4):
        ordered.extend(sorted(objects[row*4:row*4+4], key=lambda item: item[1][1].start))
    return [(pixels, components, identity, str(source)) for identity, _ in ordered]


def package(source, actor, accent_source=None):
    destination = ROOT / 'assets/band-pet-actions/one-piece' / actor
    destination.mkdir(parents=True, exist_ok=True)
    original = Image.open(ROOT / f'assets/band-pets/one-piece/{actor}.webp').convert('RGBA')
    ordered = source_cels(source,16)
    if accent_source:
        ordered = ordered[:8]+source_cels(accent_source,8)
    idle = original.crop((0, 0, 256, 320))
    idle_mask = np.array(idle)[:, :, 3] >= 80
    ys, xs = np.nonzero(idle_mask)
    reference_height = int(ys.max()-ys.min()+1)
    foot_y = int(ys.max()+1)
    foot_xs = np.nonzero(idle_mask[max(0, foot_y-15):foot_y])[1]
    reference_center = (int(foot_xs.min())+int(foot_xs.max()))/2
    first = Image.new('RGBA', (320, 320))
    first.alpha_composite(idle, (32, 0))
    reference_center += 32
    frames = [first]
    records = []
    for index, (pixels, components, identity, native_source) in enumerate(ordered):
        # Keep the native connected cel plus its antialiasing fringe only.
        mask = binary_dilation(components == identity, iterations=2)
        ys, xs = np.nonzero(components == identity)
        left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)
        cell_pixels = pixels[top:bottom, left:right].copy()
        cell_pixels[:, :, 3] *= mask[top:bottom, left:right]
        cell = Image.fromarray(cell_pixels)
        scale = reference_height/(bottom-top)
        # Only a uniform full-cel scale and translation, never individual parts.
        scaled = cell.resize((round(cell.width*scale), reference_height), Image.Resampling.LANCZOS)
        foot_xs = np.nonzero((components[max(top, bottom-16):bottom] == identity))[1]
        source_center = (int(foot_xs.min())+int(foot_xs.max()))/2-left
        x = round(reference_center-source_center*scale)
        y = foot_y-reference_height
        if x < 4 or x+scaled.width > 316:
            raise ValueError(f'Frame {index}: full cel would leave safe horizontal bounds')
        frame = Image.new('RGBA', (320, 320))
        frame.alpha_composite(scaled, (x, y))
        frames.append(frame)
        records.append({'frame':index+1, 'source':Path(native_source).name, 'sourceBounds':[left,top,right,bottom],
                        'uniformScale':scale, 'translation':[x,y],
                        'sha256':hashlib.sha256(frame.tobytes()).hexdigest()})
    if len({record['sha256'] for record in records}) != 16:
        raise ValueError('Repeated cels')
    atlas = Image.new('RGBA', (320*len(frames), 320))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index*320, 0))
    atlas.save(destination/f'{actor}-actions.webp', 'WEBP', lossless=True, method=6)
    shutil.copy2(source, destination/'generated-sheet.png')
    if accent_source:
        shutil.copy2(accent_source, destination/'generated-accent-sheet.png')
    # A generated grid is a set of cels, not a guaranteed temporal ordering.
    # Arrange each nod from upright to down, then reverse the same intact cels.
    orders = {'zoro':{'play':[1,5,8,7,2,6,4,3], 'accent':[9,16,14,13,15,10,12,11]}}
    order = orders.get(actor, {'play':list(range(1,9)), 'accent':list(range(9,17))})
    clips = {'rest':[0], **{key:values+values[-2:0:-1] for key,values in order.items()}}
    if accent_source:
        clips['accent']=list(range(9,17))
    data = {'id':f'one-piece/{actor}', 'status':'sample-awaiting-style-review',
            'asset':f'{actor}-actions.webp', 'frameWidth':320, 'frameHeight':320,
            'frameCount':17, 'baseline':.94, 'fps':12,
            'clips':clips,
            'sourceSha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),
            'accentSourceSha256':hashlib.sha256(Path(accent_source).read_bytes()).hexdigest() if accent_source else None,
            'originalAssetSha256':hashlib.sha256((ROOT/f'assets/band-pets/one-piece/{actor}.webp').read_bytes()).hexdigest(),
            'frames':records}
    (destination/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print(json.dumps({'destination':str(destination),'uniqueNewCels':len(records),'atlasSize':atlas.size}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('--actor',default='zoro')
    parser.add_argument('--accent-source',type=Path)
    args = parser.parse_args()
    package(args.source,args.actor,args.accent_source)
