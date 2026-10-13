"""Package GPT-generated pose pixels into stable, transparent game atlases.

No character pixels are drawn or repaired here. Rows are separated using alpha
gutters; every pose in a row shares the same crop and scale so limbs can move
without normalizing away the movement. Run with the bundled Pillow runtime.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent


def connected_pose(cell):
    # Separate a pose from small pieces of neighboring cells. Dilation joins
    # antialiased strings/stands; it does not draw new character pixels.
    alpha = cell.getchannel('A')
    mask = alpha.point(lambda value: 255 if value >= 64 else 0).filter(ImageFilter.MaxFilter(9))
    width, height = cell.size
    center = (width//2, height//2)
    pixels = mask.load()
    seed = center if pixels[center] else None
    if seed is None:
        for reach in range(1, max(width, height)):
            candidates = [(center[0]+dx, center[1]+dy) for dx,dy in [(0,reach),(0,-reach),(reach,0),(-reach,0)]]
            seed = next(((x,y) for x,y in candidates if 0<=x<width and 0<=y<height and pixels[x,y]), None)
            if seed is not None:
                break
    if seed is None:
        raise ValueError('Missing generated pose')
    ImageDraw.floodfill(mask, seed, 128)
    keep = mask.point(lambda value: 255 if value == 128 else 0)
    cell.putalpha(ImageChops.multiply(alpha, keep))
    return cell


def prepare(job, destination):
    source = Path(job['source'])
    image = Image.open(source).convert('RGBA')
    width, height = image.size
    alpha = image.getchannel('A')
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{source.name}: actual alpha transparency is required")
    mask = alpha.point(lambda value: 255 if value >= 64 else 0)
    mass = [mask.crop((0, y, width, y + 1)).histogram()[255] for y in range(height)]
    rows = len(job['ids'])
    boundaries = [0]
    for row in range(1, rows):
        center = height * row / rows
        reach = height / rows * .12
        candidates = range(round(center - reach), round(center + reach))
        cut = min(candidates, key=lambda y: (sum(mass[max(0, y-1):y+2]), abs(y-center)))
        boundaries.append(cut)
    boundaries.append(height)
    report = []
    for row, identity in enumerate(job['ids']):
        if identity in job.get('skipIds', []):
            continue
        cells = [connected_pose(image.crop((round(col*width/4), boundaries[row], round((col+1)*width/4), boundaries[row+1]))) for col in range(4)]
        bounds = [cell.getchannel('A').point(lambda value: 255 if value >= 64 else 0).getbbox() for cell in cells]
        if any(bound is None for bound in bounds):
            raise ValueError(f'{identity}: missing pose')
        crop = (min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds))
        scale = min(232/(crop[2]-crop[0]), 289/(crop[3]-crop[1]))
        size = (round((crop[2]-crop[0])*scale), round((crop[3]-crop[1])*scale))
        atlas = Image.new('RGBA', (1024, 320))
        # A single row baseline and one horizontal registration preserve motion.
        x = round((256-size[0])/2)
        y = round(320*.94)-size[1]
        hashes = []
        for col, cell in enumerate(cells):
            pose = cell.crop(crop).resize(size, Image.Resampling.LANCZOS)
            atlas.alpha_composite(pose, (col*256+x, y))
            hashes.append(hashlib.sha256(pose.tobytes()).hexdigest())
        if len(set(hashes)) < 4:
            raise ValueError(f'{identity}: repeated static poses')
        path = ROOT / 'assets/band-pets' / f'{identity}.webp'
        path.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(path, 'WEBP', quality=92, method=6)
        encoded = Image.open(path).convert('RGBA')
        if encoded.size != (1024, 320) or encoded.getchannel('A').getextrema()[0] != 0:
            raise ValueError(f'{identity}: invalid encoded atlas')
        feet = [b[3] for b in bounds]
        report.append({'id': identity, 'asset': str(path.relative_to(ROOT)), 'size': list(encoded.size), 'frameCount':4,
                       'rowCuts':boundaries[row:row+2], 'sharedCrop':list(crop), 'scale':scale,
                       'baselineSpreadPixels':round((max(feet)-min(feet))*scale, 2), 'bytes':path.stat().st_size,
                       'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    destination.mkdir(parents=True, exist_ok=True)
    copied = destination / f"generated-{job['job']}.png"
    if not copied.exists():
        shutil.copy2(source, copied)
    return report


def contact_sheet(reports, destination):
    sheet = Image.new('RGB', (1280, ((len(reports)+4)//5)*320), '#28222a')
    for i, report in enumerate(reports):
        atlas = Image.open(ROOT / report['asset']).convert('RGBA')
        pose = atlas.crop((512, 0, 768, 320))
        sheet.paste(pose, ((i%5)*256, (i//5)*320), pose)
    sheet.save(destination / 'pet-contact-sheet.jpg', quality=92)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', type=Path)
    args = parser.parse_args()
    jobs = json.loads(args.manifest.read_text())
    destination = args.manifest.parent
    reports = []
    for job in jobs:
        reports.extend(prepare(job, destination))
    (destination / 'asset-validation.json').write_text(json.dumps({'generatedOnly':True,'characters':reports}, ensure_ascii=False, indent=2))
    contact_sheet(reports, destination)
    print(json.dumps({'characters':len(reports),'frames':len(reports)*4,'bytes':sum(r['bytes'] for r in reports),'maxBaselineSpread':max(r['baselineSpreadPixels'] for r in reports)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
