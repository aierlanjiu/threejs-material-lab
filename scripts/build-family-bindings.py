"""Create explicitly machine-estimated bindings with measured activity and provenance."""
from pathlib import Path
from datetime import datetime, timezone
import json
import hashlib

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT/'output/lu-band-song-parts'
EXPECTED = {'vocals':'vocals','drums':'percussion','bass':'bass','guitar':'plucked_strings','piano':'keys'}
POOLS = {
 'one-piece': {'vocals':['luffy'],'bass':['zoro'],'percussion':['sanji','chopper'],'plucked_strings':['usopp','robin'],'keys':['law','nami'],'winds':['ace'],'bowed_strings':['shanks']},
 'dragon-ball': {'vocals':['goku'],'bass':[],'percussion':['krillin'],'plucked_strings':['vegeta'],'keys':['gohan','bulma','cell','trunks'],'winds':['piccolo','buu'],'bowed_strings':[]},
 'naruto': {'vocals':['naruto'],'bass':['jiraiya'],'percussion':['sakura','gaara','madara'],'plucked_strings':['sasuke'],'keys':['pain'],'winds':['itachi','ninja-06'],'bowed_strings':[]},
}


def merge_intervals(intervals, gap=0):
    result=[]
    for start,end in sorted(intervals):
        if result and start-result[-1][1] <= gap+1e-6:
            result[-1][1]=max(end,result[-1][1])
        else:
            result.append([start,end])
    return [[round(a,4),round(b,4)] for a,b in result]


def signal_intervals(stem,duration):
    return merge_intervals([[p['time'],min(duration,p['time']+.1)] for p in stem['envelope'] if p['value']>.12 and p['time']<duration],gap=.30)


def main():
    mapping = json.loads((DATA/'lu_band_mapping.json').read_text())
    summary = []
    corrected = {'version':1,'method':'local-PCM-AST-and-measured-activity','nativeListeningVerified':False,
                 'notice':'家族音色为模型估计；声部活动由实际分轨信号给出。时间采样粒度不等于识别精度。共享声轨不能当作独立乐器轨。','tracks':{}}
    for score_path in sorted(DATA.glob('*/score.json')):
        score = json.loads(score_path.read_text())
        path = score_path.with_name('family-classification.json')
        raw = path.read_bytes()
        classification = json.loads(raw)
        assert classification['sourceSha256'] == score['sourceSha256']
        assert classification['method'] == 'local-PCM-AST-AudioSet-classification'
        used = {theme:set() for theme in POOLS}
        parts = []
        for stem in score['stems']:
            evidence = next((item for item in classification['stems'] if item['id'] == stem['id']), None)
            if not evidence:
                continue
            assert evidence['audioSha256'] == stem['audioSha256']
            windows = evidence['windows']
            if stem['id'] != 'other':
                scores = {family: sorted(window['families'][family] for window in windows)[len(windows)//2] for family in POOLS['one-piece']}
                expected = EXPECTED[stem['id']]
                best = max(scores, key=scores.get)
                families = [expected] if scores[expected] >= .10 and scores[expected] >= scores[best]*.55 else [best] if scores[best] >= .15 else []
            else:
                families = [family for family in ['keys','winds','bowed_strings','plucked_strings'] if sum(window['families'][family] >= .18 for window in windows) >= 2]
            for family in families:
                identity = [[0,score['duration']]] if stem['id'] != 'other' else [[window['start'],window['end']] for window in windows if window['families'][family] >= .18]
                intervals = merge_intervals([[max(a,c),min(b,d)] for a,b in signal_intervals(stem,score['duration']) for c,d in identity if min(b,d)>max(a,c)])
                if not intervals:
                    continue
                actors = {}
                for theme, pool in POOLS.items():
                    actor = next((actor for actor in pool[family] if actor not in used[theme]), None)
                    actors[theme] = actor
                    if actor:
                        used[theme].add(actor)
                if not any(actors.values()):
                    continue
                # The entire attributable stem is retained. Activity windows are
                # used for coarse family identity only, never pitch-based splitting.
                parts.append({'id': f"{stem['id']}-{family}", 'stemId': stem['id'], 'instrumentId': stem['instrumentId'],
                              'familyId': family, 'actors': actors, 'status': 'estimated', 'activeIntervals': intervals,
                              'activitySource': 'envelope' if not stem['events'] else 'events', 'sharedAudio': stem['id'] == 'other',
                              'review': {'reviewer': 'AST AudioSet model + measured stem activity', 'method': 'local-PCM-family-cross-check', 'at': datetime.now(timezone.utc).isoformat()},
                              'evidence': {'model': classification['model'], 'revision': classification['revision'],
                                           'classificationSha256': hashlib.sha256(raw).hexdigest(), 'audioSha256': stem['audioSha256'],
                                           'score': round(max(window['families'][family] for window in windows),5)}})
        result = {'version':1, 'trackId':score['trackId'], 'sourceSha256':score['sourceSha256'],
                  'audioDigests':{stem['id']:stem['audioSha256'] for stem in score['stems']},
                  'method':'AST-family-classification-and-measured-stem-events-v1', 'nativeAudioListeningVerified':False,
                  'notice':'模型估计；音色类别按10秒音频窗口分析，实际动作由分轨事件和能量驱动。共享伴奏的多个家族联动控制，未声称各乐器独立分离。',
                  'sections':mapping['tracks'][score['trackId']]['sections'], 'parts':parts}
        target = score_path.with_name('family-bindings.json')
        target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        sections=[]
        voice=next(s for s in score['stems'] if s['id']=='vocals')
        for section in result['sections']:
            points=[p for p in voice['envelope'] if section['start']<=p['time']<section['end']]
            share=sum(p['value']>.3 for p in points)/max(1,len(points))
            label='过渡（有人声）' if section['label']=='间奏' and share>.3 else section['label']
            sections.append({**section,'label':label,'activeFamilies':sorted({p['familyId'] for p in parts if any(a<section['end'] and b>section['start'] for a,b in p['activeIntervals'])})})
        corrected['tracks'][score['trackId']]={'sourceSha256':score['sourceSha256'],'duration':score['duration'],'sections':sections,
            'activity':[{'family':p['familyId'],'stemId':p['stemId'],'actors':p['actors'],'sharedAudio':p['sharedAudio'],'intervals':p['activeIntervals'],
                         'eventsSource':f"{score['trackId']}/score.json#stems/{p['stemId']}/events"} for p in parts]}
        summary.append({'trackId':score['trackId'],'parts':len(parts),'actors':{theme:len(actors) for theme,actors in used.items()}})
    (DATA/'family-binding-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    (DATA/'corrected-lu-band-mapping.json').write_text(json.dumps(corrected,ensure_ascii=False,indent=2)+'\n')
    for row in summary:
        print(row)


if __name__ == '__main__':
    main()
