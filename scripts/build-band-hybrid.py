"""Build complete, source-derived arrangements and compact shared instrument banks.

No original recording is replaced. Generated MIDI events identify new performed
parts; model transcriptions remain estimates, never human-verified original scores.
Run using output/lu-band-runtime/bin/python.
"""
from pathlib import Path
import hashlib
import json
import math
import subprocess

import mido
import numpy as np
import soundfile as sf
import tinysoundfont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/band-audio'
FONT = ROOT / 'output/lu-band-arrangement/bolero-trial/GeneralUser-GS.sf2'
ANALYSIS = ROOT / 'output/lu-band-song-parts'
RATE = 32000
PROGRAMS = {'bass':33,'guitar':24,'electric-guitar':27,'harp':46,'saxophone':66,'accordion':21,
            'marimba':12,'synthesizer':89,'cello':42,'flute':73,'theremin':80,
            'piano':0,'tuba':58,'shakuhachi':77,'ocarina':79,'shamisen':106,
            'organ':19,'taiko':116}
PERCUSSION = {'drums','hand-drums','snare','udu'}
SUSTAIN = {'saxophone','accordion','synthesizer','cello','flute','theremin','tuba','shakuhachi','ocarina','organ'}
ORIGINAL = {'vocals':'vocals','bass':'bass','drums':'drums','guitar':'guitar','piano':'piano'}
SOURCE_FILES = dict(zip([f'track_{i}' for i in range(6)],
                       ['youjing','qiuyinong','lanni','gui','pianai','haiou']))


def run(args, data=None):
    p = subprocess.run(args, input=data, capture_output=True, timeout=180)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors='replace')[-1200:])
    return p.stdout


def sha(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''):
            h.update(b)
    return h.hexdigest()


def write_json(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))


def encode(data, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','-',
         '-codec:a','libmp3lame','-b:a','96k',str(path)], data.astype('float32').tobytes())


def bank(kind):
    drums = kind == 'percussion'
    pitches = [36,37,38,42,45,46,47,49,60,61,62,64,65,80] if drums else list(range(28,89,4))
    samples = []
    for pitch in pitches:
        path = OUT/'samples'/kind/f'{pitch}.mp3'
        if not path.exists():
            synth = tinysoundfont.Synth(gain=-9, samplerate=RATE)
            font = synth.sfload(str(FONT))
            synth.program_select(0,font,128 if drums else 0,0 if drums else PROGRAMS[kind],is_drums=drums)
            assert synth.noteon(0,pitch,100)
            data = np.frombuffer(synth.generate(round(1.75*RATE)),dtype='float32').reshape(-1,2).copy()
            synth.noteoff(0,pitch)
            tail = np.frombuffer(synth.generate(round(.45*RATE)),dtype='float32').reshape(-1,2).copy()
            data = np.concatenate([data,tail]); peak=float(abs(data).max())
            if peak < 1e-7:
                raise RuntimeError(f'Silent soundfont note {kind}/{pitch}')
            data *= min(8, .65/peak)
            data[-round(.08*RATE):] *= np.linspace(1,0,round(.08*RATE))[:,None]
            encode(data,path)
        cycles=round(.5*440*2**((pitch-69)/12))
        samples.append({'midi':pitch,'audio':'./'+str(path.relative_to(ROOT)),
                        'audioSha256':sha(path),'loopStart':.75,
                        'loopEnd':.75+cycles/(440*2**((pitch-69)/12))})
    return {'sustain':kind in SUSTAIN,'percussion':drums,'samples':samples}


def overlap(events, a, b):
    return [e for e in events if e['start'] < b and e['end'] > a]


def harmonic_plan(score):
    duration=score['duration']; raw={s['id']:s for s in score['stems']}
    beats=np.array(score['beatTimes']);beats=beats[(beats>=0)&(beats<duration)]
    if len(beats)<8:
        beats=np.arange(0,duration,60/score['bpmEstimate'])
    cells=[]
    for i in range(0,len(beats)-1,2):
        a=float(beats[i]);b=float(beats[min(i+2,len(beats)-1)])
        if b-a<.1:continue
        weights=np.zeros(12); bass=np.zeros(12)
        for sid in ['piano','guitar','bass']:
            for e in overlap(raw[sid]['events'],a,b):
                length=max(0,min(e['end'],b)-max(a,e['start']))
                w=length*e['velocity']
                weights[e['midi']%12]+=w*(1.2 if sid=='piano' else .6)
                if sid=='bass' and e['midi']<55 and e['confidence']>.4:
                    bass[e['midi']%12]+=w
        if weights.sum()<.02:
            cells.append({'start':a,'end':b,'root':None,'tones':[]});continue
        root=int(np.argmax(bass)) if bass.max()>.12 else int(np.argmax(weights))
        major=weights[(root+4)%12];minor=weights[(root+3)%12]
        third=3 if minor>major else 4
        cells.append({'start':a,'end':b,'root':root,'tones':[root,(root+third)%12,(root+7)%12]})
    if cells:
        cells[0]['start']=0
        cells[-1]['end']=duration
    return cells,beats


def notes_for(role, score, harmony, beats, index):
    kind=role['instrumentKind'];duration=score['duration'];events=[]
    if kind=='vocals':return events
    envelopes={s['id']:(np.array([p['time'] for p in s['envelope']]),np.array([p['value'] for p in s['envelope']])) for s in score['stems']}
    def energy(sid,t):
        times,values=envelopes[sid];return float(np.interp(t,times,values))
    voice=next(s for s in score['stems'] if s['id']=='vocals')
    vtimes=np.array([p['time'] for p in voice['envelope']]);vlevels=np.array([p['value'] for p in voice['envelope']])
    def add(at,pitch,length,velocity):
        at=max(0,float(at));end=min(duration-.03,at+max(.06,length))
        if end<=at:return
        rhythm=kind in PERCUSSION or kind=='taiko'
        level=energy('drums' if rhythm else 'bass',at) if rhythm or kind in ['bass','tuba'] else max(energy(sid,at) for sid in ['piano','guitar','other'])
        if level < (.10 if rhythm else .025):return
        velocity*=.45+.55*min(1,level)
        events.append({'start':round(at,5),'end':round(end,5),'midi':int(np.clip(pitch,24,96)),
                       'velocity':round(float(np.clip(velocity,.15,.85)),4),'confidence':1})
    def voice_on(t):return float(np.interp(t,vtimes,vlevels))>.22
    for k,c in enumerate(harmony):
        if c['root'] is None:continue
        a,b=c['start'],c['end'];root=c['root'];tones=c['tones'];step=(b-a)/2
        chord=[48+p for p in tones]
        nearby=beats[(beats>=a-.02)&(beats<b-.02)]
        if kind in PERCUSSION or kind=='taiko':
            for j,t in enumerate(nearby):
                if kind=='drums':
                    add(t,36 if (k*2+j)%2==0 else 38,.10,.65)
                    add(t,42,.06,.35);add(t+step*.5,42,.06,.26)
                elif kind=='snare':
                    if (k*2+j)%2:add(t,38,.10,.57)
                elif kind=='hand-drums':
                    add(t+step*.5,60 if j%2 else 64,.13,.48)
                elif kind=='udu':
                    if k%2==0:add(t,64,.19,.43)
                elif k%4==0 and j==0:add(t,48,.3,.58)
        elif kind in ['bass','tuba']:
            for j,t in enumerate(nearby):
                pitch=36+root if kind=='bass' else 36+root
                add(t,pitch,min(step*.8,b-t-.02),.66 if kind=='bass' else .45)
        elif kind in ['guitar','shamisen']:
            for j,t in enumerate(nearby):
                for n,p in enumerate(chord):
                    add(t+n*.013,p,.38 if kind=='guitar' else .18,.48-n*.05)
                if kind=='guitar' and k%4>1:
                    for n,p in enumerate(chord[1:]):add(t+step*.72+n*.012,p,.17,.30)
        elif kind in ['harp','piano','marimba']:
            spacing=step*.5 if kind=='harp' else step
            for j,t in enumerate(np.arange(a,b-.06,spacing)):
                if kind=='marimba' and (k+j)%3:continue
                add(t,chord[(j+index)%3]+(12 if kind!='piano' else 0),min(.7,spacing*.78),.37)
        elif kind in ['saxophone','flute','shakuhachi','ocarina','theremin']:
            # New answering fragments; rests follow actual vocal activity.
            for j,t in enumerate(nearby):
                if voice_on(t+.12) or (k+j+index)%3:continue
                add(t+.08,chord[(k+j+index)%3]+12,min(step*.7,b-t-.05),.40)
        elif kind=='cello':
            add(a,48+root,(b-a)*.87,.46)
        else:
            if kind=='synthesizer' and (k+index)%2:continue
            if kind=='accordion' and k%3==1:continue
            shift=12 if index%2 else 0
            for p in chord[:2 if kind=='accordion' else 3]:
                add(a+.025,p+shift,(b-a)*.83,.31 if kind=='synthesizer' else .36)
    events.sort(key=lambda e:(e['start'],e['midi']))
    previous={}
    for e in events:
        old=previous.get(e['midi'])
        if old and old['end']>=e['start']:old['end']=max(old['start']+.001,e['start']-.003)
        previous[e['midi']]=e
    return events


def build_score(folder,roles):
    source=json.loads((folder/'score.json').read_text());track=source['trackId']
    original=ROOT/'audio'/f'{SOURCE_FILES[track]}.mp3' if track in SOURCE_FILES else ROOT/'output/audio'/f'{track}.mp3'
    assert sha(original)==source['sourceSha256'],track
    harmony,beats=harmonic_plan(source);stems=[];themes={};controls=[]
    for s in source['stems']:
        if s['id'] not in set(ORIGINAL.values()):continue
        path=OUT/'controls'/track/f'{s["id"]}.mp3';path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists():
            run(['ffmpeg','-v','error','-y','-i',str(folder/f'{s["id"]}.wav'),
                 '-ar','22050','-codec:a','libmp3lame','-b:a','64k',str(path)])
        controls.append({'id':s['id'],'audio':'./'+str(path.relative_to(ROOT)),
                         'audioSha256':sha(path),'envelope':s['envelope'],'onsets':s['onsets']})
    for index,role in enumerate(roles):
        kind=role['instrumentKind'];sid=role['id'];theme=role['theme'];themes.setdefault(theme,[])
        technique='voice' if kind=='vocals' else 'strike' if kind in PERCUSSION or kind in ['taiko','marimba'] else 'wind' if kind in ['saxophone','flute','tuba','shakuhachi','ocarina'] else 'sustain' if kind in ['cello','theremin'] else 'pluck' if kind in ['guitar','bass','harp','shamisen'] else 'keys'
        events=notes_for(role,source,harmony,beats,index)
        if kind=='vocals':
            base=next(s for s in source['stems'] if s['id']=='vocals')
            envelope=base['envelope'];onsets=base['onsets']
        else:
            points={0:0,source['duration']:0}
            for e in events:
                points[e['start']]=max(points.get(e['start'],0),e['velocity'])
                points[e['end']]=max(points.get(e['end'],0),.0)
            envelope=[{'time':t,'value':v} for t,v in sorted(points.items())]
            onsets=[{'time':e['start'],'strength':e['velocity']} for e in events]
        bank_id='percussion' if kind in PERCUSSION else 'electric-guitar' if kind=='guitar' and theme!='one-piece' else kind
        stems.append({'id':sid,'label':role['instrument'],'instrumentId':kind,'bank':bank_id,
                      'events':events,'envelope':envelope,'onsets':onsets,'percussion':technique=='strike'})
        themes[theme].append({'actorId':sid,'stemId':sid,'instrumentId':kind,'technique':technique,
                              'originalStemId':ORIGINAL.get(kind),'activitySource':'envelope' if kind=='vocals' else 'events'})
    family_path=folder/'family-bindings.json'
    sections=json.loads(family_path.read_text())['sections'] if family_path.exists() else source['sections']
    sections=[{**s,'lead':None,'leadInstrument':next((x['lead'] for x in source['sections'] if x['start']<=(s['start']+s['end'])/2<x['end']),'vocals'),
               'active':[stem['id'] for stem in stems if any(e['start']<s['end'] and e['end']>s['start'] for e in stem['events']) or stem['instrumentId']=='vocals'],
               'energy':round(float(np.mean([p['value'] for x in source['stems'] for p in x['envelope'] if s['start']<=p['time']<s['end']]) or 0),4)} for s in sections]
    # Analysis sections can round their tail a few milliseconds beyond audio.
    for s in sections:s['end']=min(s['end'],source['duration'])
    result={'version':1,'source':'arrangement','title':source['title'],'trackId':track,
            'duration':source['duration'],'bpmEstimate':source['bpmEstimate'],'beatTimes':source['beatTimes'],
            'sourceSha256':source['sourceSha256'],'timeSignature':[4,4],
            'arrangement':{'version':2,'provenance':'source-derived-sample-events-v1',
                           'mixMode':'original-plus-synth','takeoverBars':4,'themes':themes},
            'hybrid':{'version':1,'bankManifest':'./assets/band-audio/banks.json','originalStems':controls,
                      'mix':{'original':.64,'synth':.25,'originalFloor':.35,'soloBed':.075,'soloSynth':.9}},
            'stems':stems,'sections':sections,
            'notice':'原曲为主，新增独立采样演奏；原曲声部分离及和声参考为模型估计，未经逐曲人工校谱。'}
    write_json(OUT/'scores'/f'{track}.json',result)
    # Complete editable MIDI per theme; recorded vocals intentionally stay audio.
    for theme,parts in themes.items():
        midi=mido.MidiFile();meta=mido.MidiTrack();midi.tracks.append(meta)
        tempo=mido.bpm2tempo(source['bpmEstimate']);meta.append(mido.MetaMessage('set_tempo',tempo=tempo))
        for i,part in enumerate(parts):
            stem=next(s for s in stems if s['id']==part['stemId'])
            if part['instrumentId']=='vocals':continue
            t=mido.MidiTrack();midi.tracks.append(t);t.append(mido.MetaMessage('track_name',name=part['actorId']))
            queue=[];channel=9 if stem['bank']=='percussion' else i if i<9 else 10
            t.append(mido.Message('program_change',channel=channel,program=PROGRAMS.get(part['instrumentId'],0)))
            for e in stem['events']:
                queue.extend([(round(mido.second2tick(e['start'],480,tempo)),1,e['midi'],round(e['velocity']*127)),
                              (round(mido.second2tick(e['end'],480,tempo)),0,e['midi'],0)])
            last=0
            for tick,on,pitch,velocity in sorted(queue):
                t.append(mido.Message('note_on' if on else 'note_off',channel=channel,note=pitch,velocity=velocity,time=tick-last));last=tick
        midi.save(OUT/'scores'/f'{track}-{theme}.mid')
    print('FULL SONG',track,round(source['duration'],2),'sec',sum(len(s['events']) for s in stems),'new notes',flush=True)
    return {'id':track,'title':source['title'],'duration':source['duration'],
            'score':'./assets/band-audio/scores/'+track+'.json','sha256':sha(OUT/'scores'/f'{track}.json')}


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    roles=json.loads(run(['node','--input-type=module','-e',
                         "import {INSTRUMENTS} from './js/avatar/instrument-manifest.js'; console.log(JSON.stringify(INSTRUMENTS))"],None))
    banks={}
    for kind in [*PROGRAMS,'percussion']:
        banks[kind]=bank(kind);print('BANK',kind,flush=True)
    write_json(OUT/'banks.json',{'version':1,'source':'GeneralUser-GS-2.0.3','sourceSha256':sha(FONT),'banks':banks})
    (OUT/'SOUNDFONT-LICENSE.txt').write_text((FONT.parent/'LICENSE.txt').read_text())
    tracks=[]
    for folder in sorted(ANALYSIS.iterdir()):
        if (folder/'score.json').is_file():tracks.append(build_score(folder,roles))
    assert len(tracks)==16
    write_json(OUT/'catalog.json',{'version':1,'tracks':tracks,'themes':['one-piece','dragon-ball','naruto'],
                                 'scoreStatus':'source-derived arrangements; human listening review pending'})


if __name__=='__main__':main()
