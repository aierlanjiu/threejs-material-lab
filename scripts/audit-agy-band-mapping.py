"""Check supplied AGY annotations against actual sources and measured stem activity.

This checks timing evidence; it does not certify instrument identity or listening.
Run from any directory with Python 3. No third-party packages are required.
"""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'output/lu-band-song-parts'
FAMILIES = {'vocals', 'bass', 'percussion', 'plucked_strings', 'keys', 'winds', 'bowed_strings'}
STEMS = {'vocals': 'vocals', 'bass': 'bass', 'percussion': 'drums', 'plucked_strings': 'guitar', 'keys': 'piano'}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(time, intervals, tolerance=0):
    return any(start-tolerance <= time < end+tolerance for start, end in intervals)


def measured_intervals(envelope, duration, threshold=.20, gap=.35, minimum=.20):
    """Activity of a model-separated signal, never a claim of an isolated instrument."""
    ranges = []
    for point in envelope:
        if point['value'] < threshold or point['time'] >= duration:
            continue
        start, end = point['time'], min(duration, point['time']+.10)
        if ranges and start-ranges[-1][1] <= gap:
            ranges[-1][1] = end
        else:
            ranges.append([start, end])
    return [[round(a, 3), round(b, 3)] for a, b in ranges if b-a >= minimum]


def lyric_times(track_id):
    path = ROOT / f'output/audio/{track_id}.lrc'
    if not path.is_file():
        return []
    lines = []
    for line in path.read_text().splitlines():
        for minutes, seconds, text in re.findall(r'\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)', line):
            time, text = int(minutes)*60+float(seconds), text.strip()
            if time < .1 or not text or any(word in text for word in ['前奏', '间奏', '尾奏', '主歌', '副歌', '序奏', '变奏', '高潮', '推进', '动机', '《']):
                continue
            lines.append((time, text))
    return lines


def main():
    mapping_path = DATA / 'lu_band_mapping.json'
    mapping = json.loads(mapping_path.read_text())
    result = {'version': 1, 'inputSha256': digest(mapping_path),
              'method': 'source-hash, interval validation, measured separated-signal activity and existing LRC cross-check',
              'nativeAudioClaimVerified': False, 'instrumentIdentityVerified': False,
              'notice': 'AGY self-reported audioReceived/confidence are not listening evidence. Signal activity may include separation leakage. Proposed intervals are candidates, not human-approved transcriptions.',
              'tracks': []}
    for track_id, track in mapping['tracks'].items():
        score_path = DATA / track_id / 'score.json'
        score = json.loads(score_path.read_text())
        errors, warnings = [], []
        source_path = (ROOT / score['originalAudio'].removeprefix('./')).resolve()
        if not source_path.is_relative_to(ROOT):
            raise ValueError('Unexpected source path')
        if track['sourceSha256'] != score['sourceSha256'] or digest(source_path) != score['sourceSha256']:
            errors.append('source hash mismatch')
        if abs(track['duration']-score['duration']) > .06:
            errors.append('duration mismatch')
        previous = 0
        for section in track['sections']:
            if abs(section['start']-previous) > .01 or section['end'] <= section['start']:
                errors.append('invalid or discontinuous section')
            if not set(section['activeFamilies']).issubset(FAMILIES):
                errors.append('invalid section family')
            previous = section['end']
        if abs(previous-score['duration']) > .06:
            errors.append('sections do not cover actual duration')
        activities = {item['family']: item['intervals'] for item in track['activity']}
        for family, intervals in activities.items():
            if family not in FAMILIES or any(a < 0 or b <= a or b > score['duration']+.06 for a, b in intervals):
                errors.append('invalid family activity interval')
        comparison, candidates = {}, []
        for family, stem_id in STEMS.items():
            stem = next(stem for stem in score['stems'] if stem['id'] == stem_id)
            if digest((ROOT / stem['audio'].removeprefix('./')).resolve()) != stem['audioSha256']:
                errors.append(f'{stem_id}: audio hash mismatch')
            points = [point for point in stem['envelope'] if point['value'] > .20]
            total = sum(point['value']**2 for point in points)
            outside = sum(point['value']**2 for point in points if not inside(point['time'], activities.get(family, [])))
            ratio = round(outside/max(total, 1e-8), 4)
            comparison[family] = {'separatedEnergyOutsideAnnotation': ratio, 'stemId': stem_id}
            if family in activities and ratio > .10:
                warnings.append(f'{family}: {ratio:.1%} of active separated-signal energy falls outside supplied intervals')
            if family in activities:
                candidates.append({'family': family, 'stemId': stem_id,
                                   'intervals': measured_intervals(stem['envelope'], score['duration']),
                                   'provenance': 'measured-model-separated-signal', 'status': 'candidate'})
        voice = next(stem for stem in score['stems'] if stem['id'] == 'vocals')
        conflicts = []
        if not track.get('instrumental'):
            for time, _ in lyric_times(track_id):
                peak = max((point['value'] for point in voice['envelope'] if time-.3 <= point['time'] < time+1.2), default=0)
                if not inside(time, activities.get('vocals', []), .5) and peak >= .3:
                    conflicts.append({'time': time, 'vocalEnvelopePeak': peak})
            if conflicts:
                warnings.append('existing vocal lyric markers and measured vocal signal conflict with supplied rest intervals')
        result['tracks'].append({'trackId': track_id, 'sourceSha256': score['sourceSha256'],
                                 'structurePassed': not errors, 'errors': errors, 'warnings': warnings,
                                 'comparison': comparison, 'lyricSignalConflicts': conflicts,
                                 'measuredActivityCandidates': candidates,
                                 'unisolatedFamilies': [family for family in activities if family not in STEMS]})
    result['summary'] = {'tracks': len(result['tracks']), 'sections': sum(len(t['sections']) for t in mapping['tracks'].values()),
                         'structurePassed': sum(t['structurePassed'] for t in result['tracks']),
                         'tracksWithTimingWarnings': sum(bool(t['warnings']) for t in result['tracks']),
                         'lyricSignalConflicts': sum(len(t['lyricSignalConflicts']) for t in result['tracks'])}
    target = DATA / 'agy-mapping-audit.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
    print(target)
    for track in result['tracks']:
        if track['warnings']:
            print(track['trackId'], '; '.join(track['warnings']))
    if any(not t['structurePassed'] for t in result['tracks']):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
