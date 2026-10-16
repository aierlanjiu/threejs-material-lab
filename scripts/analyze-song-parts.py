"""Build attributable per-song instrument candidates; never auto-approve them.

Run with output/lu-band-runtime/bin/python. Legacy four-source files are preserved.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import time

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output' / 'lu-band-song-parts'
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / 'output/lu-band-cache/numba'))
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')

import numpy as np
import soundfile as sf
import torch
import librosa
from demucs.pretrained import get_model
from demucs.apply import apply_model
from basic_pitch.inference import predict, Model
from basic_pitch import build_icassp_2022_model_path, FilenameSuffix

TRACKS = {
 'anime_op_we_are': ('We Are!', 'one-piece', 'output/audio/anime_op_we_are.mp3'),
 'anime_op_over_the_top': ('OVER THE TOP', 'one-piece', 'output/audio/anime_op_over_the_top.mp3'),
 'anime_op_overtaken': ('Overtaken', 'one-piece', 'output/audio/anime_op_overtaken.mp3'),
 'anime_op_one_day': ('One day', 'one-piece', 'output/audio/anime_op_one_day.mp3'),
 'anime_db_chala': ('CHA-LA HEAD-CHA-LA', 'dragon-ball', 'output/audio/anime_db_chala.mp3'),
 'anime_db_makafushigi': ('Makafushigi Adventure!', 'dragon-ball', 'output/audio/anime_db_makafushigi.mp3'),
 'anime_db_dandan': ('DAN DAN 心魅かれてく', 'dragon-ball', 'output/audio/anime_db_dandan.mp3'),
 'anime_nr_blue_bird': ('Blue Bird', 'naruto', 'output/audio/anime_nr_blue_bird.mp3'),
 'anime_nr_silhouette': ('Silhouette', 'naruto', 'output/audio/anime_nr_silhouette.mp3'),
 'anime_nr_sign': ('Sign', 'naruto', 'output/audio/anime_nr_sign.mp3'),
 'track_0': ('游京', 'general', 'audio/youjing.mp3'),
 'track_1': ('秋意浓', 'general', 'audio/qiuyinong.mp3'),
 'track_2': ('烂泥', 'general', 'audio/lanni.mp3'),
 'track_3': ('鬼', 'general', 'audio/gui.mp3'),
 'track_4': ('偏爱', 'general', 'audio/pianai.mp3'),
 'track_5': ('海鸥', 'general', 'audio/haiou.mp3'),
}
ACTORS = {
 'one-piece': {'vocals':'luffy','bass':'zoro','drums':'sanji','guitar':'usopp','piano':'law'},
 'dragon-ball': {'vocals':'goku','bass':'buu','drums':'krillin','guitar':'vegeta','piano':'gohan'},
 'naruto': {'vocals':'naruto','bass':'jiraiya','drums':'sakura','guitar':'sasuke','piano':'pain'},
}
LABELS = {'vocals':'人声候选','bass':'贝斯候选','drums':'架子鼓候选','guitar':'吉他候选','piano':'钢琴候选','other':'未识别伴奏'}

def run(command):
    result = subprocess.run(command, capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1800:])
    return result.stdout

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def features(mono, duration):
    rms = librosa.feature.rms(y=mono, frame_length=2048, hop_length=2205)[0]
    scale = max(float(np.percentile(rms, 97)), 1e-6)
    envelope = [{'time':round(i*.1,4),'value':round(float(min(1,(v/scale)**.8)),4)} for i,v in enumerate(rms) if i*.1 < duration]
    envelope.append({'time':round(duration,5),'value':0})
    strength = librosa.onset.onset_strength(y=mono, sr=22050, hop_length=512)
    indices = librosa.onset.onset_detect(onset_envelope=strength, sr=22050, hop_length=512)
    peak = max(float(np.percentile(strength,95)),1e-6)
    onsets = [{'time':round(float(i*512/22050),4),'strength':round(min(1,float(strength[i]/peak)),4)} for i in indices if i*512/22050 < duration-.05]
    return envelope, onsets

def analyze(track_id, model, pitch, device):
    title, theme, source_path = TRACKS[track_id]
    source = ROOT / source_path
    source_hash = sha(source)
    legacy_path=ROOT/'output/lu-band'/track_id/'score.json'
    legacy=json.loads(legacy_path.read_text()) if legacy_path.is_file() else {}
    known_instrumental=bool(track_id=='anime_op_overtaken' and legacy.get('instrumental') and legacy.get('sourceSha256')==source_hash)
    directory = OUT / track_id
    directory.mkdir(parents=True, exist_ok=True)
    target = directory/'score.json'
    if target.is_file():
        old = json.loads(target.read_text())
        if old.get('sourceSha256') == source_hash and old.get('models',{}).get('separation') == 'htdemucs_6s':
            if all((directory/f'{s["id"]}.mp3').is_file() and sha(directory/f'{s["id"]}.mp3') == s.get('audioSha256') for s in old.get('stems',[])):
                print(f'SKIP {track_id}: unchanged candidate data', flush=True)
                return old
    started = time.time()
    pcm = run(['ffmpeg','-v','error','-i',str(source),'-f','f32le','-ar','44100','-ac','2','pipe:1'])
    audio = np.frombuffer(pcm,dtype='<f4').reshape(-1,2).T.copy()
    duration = audio.shape[1]/44100
    reference = torch.from_numpy(audio).mean(0)
    mean, std = reference.mean(), reference.std().clamp_min(1e-8)
    print(f'SEPARATE {track_id}: {duration:.2f}s, {device}', flush=True)
    with torch.no_grad():
        separated = apply_model(model,((torch.from_numpy(audio)-mean)/std)[None],device=device,shifts=0,split=True,overlap=.25,segment=7.8,progress=True)[0].cpu()
    stems = {name:(separated[i]*std+mean/len(model.sources)).numpy() for i,name in enumerate(model.sources)}
    full = librosa.resample(audio.mean(0),orig_sr=44100,target_sr=22050)
    tempo, beat_frames = librosa.beat.beat_track(y=full,sr=22050)
    bpm = float(np.asarray(tempo).reshape(-1)[0])
    beats = librosa.frames_to_time(beat_frames,sr=22050).tolist()
    mix_rms = max(float(np.sqrt(np.mean(audio**2))),1e-8)
    results, bindings = [], []
    for name, data in stems.items():
        print(f'TRANSCRIBE {track_id}/{name}', flush=True)
        wav = directory/f'{name}.wav'
        sf.write(wav,data.T,44100,subtype='FLOAT')
        mp3 = directory/f'{name}.mp3'
        run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','192k',str(mp3)])
        mono = librosa.resample(data.mean(0),orig_sr=44100,target_sr=22050)
        envelope, onsets = features(mono,duration)
        ratio = 20*np.log10(max(float(np.sqrt(np.mean(data**2))),1e-10)/mix_rms)
        absent = ratio < -40 or (name=='vocals' and known_instrumental)
        events = []
        if name == 'drums' and not absent:
            # Whole-kit hit estimates; do not fabricate named drum sub-parts.
            events = [{'start':o['time'],'end':round(min(duration,o['time']+.14),4),'midi':36,'velocity':o['strength'],'confidence':.5} for o in onsets]
        elif name != 'other' and not absent:
            _, _, notes = predict(wav,pitch,onset_threshold=.55,frame_threshold=.3,minimum_note_length=130,
                                  minimum_frequency=30 if name=='bass' else 65,maximum_frequency=400 if name=='bass' else 2000,multiple_pitch_bends=False)
            for start,end,midi,activation,_ in notes:
                start,end=max(0,float(start)),min(duration,float(end))
                if end-start<.12: continue
                value=round(float(np.clip(activation,0,1)),4)
                events.append({'start':round(start,4),'end':round(end,4),'midi':int(midi),'velocity':value,'confidence':value})
            events.sort(key=lambda e:e['start'])
        if absent:
            onsets=[]
            for point in envelope: point['value']=0
        result={'id':name,'label':LABELS[name],'audio':f'./output/lu-band-song-parts/{track_id}/{name}.mp3','audioSha256':sha(mp3),
                'events':events,'envelope':envelope,'onsets':onsets,'relativeRmsDb':round(float(ratio),3),
                'instrumentId':name if name!='other' else None,'identityStatus':'not-detected' if absent else 'candidate',
                'transcriptionStatus':'onset-estimate' if name=='drums' else 'not-transcribed' if name=='other' else 'model-estimate'}
        results.append(result)
        if name!='other':
            bindings.append({'id':name,'stemId':name,'instrumentId':name,'actors':{t:actors[name] for t,actors in ACTORS.items()},
                             'status':'absent' if name=='vocals' and known_instrumental else 'candidate',
                             'evidence':{'separationModel':'htdemucs_6s','relativeRmsDb':result['relativeRmsDb'],'presenceEstimate':'not-detected' if absent else 'candidate'},'review':None})
        # Matched timestamps for original/isolated listening checks, not proof of identity.
        if name != 'other' and not absent:
            windows=sorted(envelope[:-1],key=lambda p:p['value'],reverse=True)
            starts=[]
            for point in windows:
                start=round(max(0,min(duration-8,point['time']-2)),2)
                if all(abs(start-prior)>15 for prior in starts): starts.append(start)
                if len(starts)==3:break
            result['reviewClips']=[]
            for index,start in enumerate(starts):
                for tag,path in [('mix',source),('stem',mp3)]:
                    clip=directory/f'{name}-review-{index}-{tag}.mp3'
                    run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(path),'-t','8','-codec:a','libmp3lame','-b:a','128k',str(clip)])
                result['reviewClips'].append({'start':start,'end':min(duration,start+8),
                    'mix':f'./output/lu-band-song-parts/{track_id}/{name}-review-{index}-mix.mp3',
                    'stem':f'./output/lu-band-song-parts/{track_id}/{name}-review-{index}-stem.mp3'})
    residual=float(np.sqrt(np.mean((audio-sum(stems.values()))**2))/mix_rms)
    unknown=next(s for s in results if s['id']=='other')
    unresolved=[{'stemId':'other','reason':'剩余伴奏的实际乐器身份尚未确认'}] if unknown['relativeRmsDb'] > -40 else []
    sections=[]
    for start in np.arange(0,duration,8):
        end=min(float(start+8),duration)
        values={s['id']:float(np.mean([p['value'] for p in s['envelope'] if start<=p['time']<end]) or 0) for s in results}
        lead=max(values,key=values.get)
        sections.append({'start':round(float(start),4),'end':round(end,4),'lead':lead if values[lead]>.06 else None,
                         'active':[name for name,value in values.items() if value>.08],'label':'能量区段估计'})
    score={'version':1,'source':'analysis','title':title,'trackId':track_id,'theme':theme,'duration':round(duration,5),
           'instrumental':known_instrumental,'sourceSha256':source_hash,'originalAudio':'./'+source_path,
           'bpmEstimate':round(bpm,4),'beatTimes':[round(float(t),5) for t in beats],'beatStatus':'model-estimate',
           'stems':results,'sections':sections,'models':{'separation':'htdemucs_6s','transcription':'Basic Pitch ONNX'},
           'notice':'逐乐器候选尚待听辨；模型分离不是原始多轨，自动音符不是已校订原谱。confidence 是模型激活，非校准概率。低能量不证明声部不存在；未知伴奏不分配演员。',
           'songBindings':{'version':1,'trackId':track_id,'sourceSha256':source_hash,'parts':bindings,'unresolved':unresolved},
           'validation':{'reconstructionRelativeRms':residual,'numericalPassed':bool(residual<.15 and all(np.isfinite(s).all() for s in stems.values())),
                         'listeningReviewed':False,'complete':False},'processingSeconds':round(time.time()-started,2)}
    target.write_text(json.dumps(score,ensure_ascii=False,separators=(',',':')))
    print(f'DONE {track_id}: {score["processingSeconds"]}s; residual={residual:.5f}; listening=PENDING; unknown={bool(unresolved)}',flush=True)
    return score

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--tracks',nargs='+',choices=TRACKS,default=list(TRACKS))
    parser.add_argument('--device',choices=['cpu','mps','cuda'],default='mps' if torch.backends.mps.is_available() else 'cpu')
    args=parser.parse_args()
    torch.set_num_threads(4)
    torch.hub.set_dir(str(ROOT/'output/lu-band-models'))
    model=get_model('htdemucs_6s')
    pitch=Model(build_icassp_2022_model_path(FilenameSuffix.onnx))
    summary=[]
    consecutive_failures=0
    for track in args.tracks:
        try:
            score=analyze(track,model,pitch,args.device)
            consecutive_failures=0
            summary.append({'trackId':track,'title':score['title'],'numericalPassed':score['validation']['numericalPassed'],
                            'verifiedParts':0,'candidateParts':sum(p['status']=='candidate' for p in score['songBindings']['parts']),
                            'unresolved':score['songBindings']['unresolved'],'status':'pending-listening-review'})
        except Exception as error:
            print(f'FAILED {track}: {error}',flush=True)
            summary.append({'trackId':track,'status':'failed','error':str(error)})
            consecutive_failures+=1
        OUT.mkdir(parents=True,exist_ok=True)
        (OUT/'audit.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
        if consecutive_failures>=2:
            print('STOP: repeated analysis failure; change the failing execution path before continuing',flush=True)
            break
    if any(item['status']=='failed' for item in summary):raise SystemExit(1)

if __name__=='__main__':main()
