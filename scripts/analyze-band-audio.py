"""Local Demucs + Basic Pitch pipeline. Outputs remain under ignored output/."""
from pathlib import Path
import argparse, hashlib, json, os, subprocess, time

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / 'output/lu-band-cache/numba'))
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')

import numpy as np
import soundfile as sf
import torch
import librosa
import pretty_midi
from demucs.pretrained import get_model
from demucs.apply import apply_model
from basic_pitch.inference import predict, Model
from basic_pitch import build_icassp_2022_model_path, FilenameSuffix

TRACKS = {
 'anime_op_we_are': ('We Are!', 'one-piece'),
 'anime_op_over_the_top': ('OVER THE TOP', 'one-piece'),
 'anime_op_overtaken': ('Overtaken', 'one-piece'),
 'anime_op_one_day': ('One day', 'one-piece'),
 'anime_db_chala': ('CHA-LA HEAD-CHA-LA', 'dragon-ball'),
 'anime_db_makafushigi': ('Makafushigi Adventure!', 'dragon-ball'),
 'anime_db_dandan': ('DAN DAN 心魅かれてく', 'dragon-ball'),
 'anime_nr_blue_bird': ('Blue Bird', 'naruto'),
 'anime_nr_silhouette': ('Silhouette', 'naruto'),
 'anime_nr_sign': ('Sign', 'naruto'),
}
LABELS = {'vocals':'人声／主旋律','bass':'低音','drums':'鼓／打击','other':'共享伴奏'}

def run(command):
    result = subprocess.run(command, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-2000:])
    return result.stdout

def features(audio, duration):
    hop, sr = 2205, 22050
    rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=hop)[0]
    scale = max(float(np.percentile(rms, 97)), 1e-6)
    envelope = [{'time':round(min(i*.1,duration),4), 'value':round(float(min(1,(v/scale)**.8)),4)} for i,v in enumerate(rms) if i*.1 < duration]
    envelope.append({'time':round(duration,5),'value':0})
    strength = librosa.onset.onset_strength(y=audio, sr=sr, hop_length=512)
    indices = librosa.onset.onset_detect(onset_envelope=strength, sr=sr, hop_length=512, backtrack=False)
    peak = max(float(np.percentile(strength,95)),1e-6)
    onsets = [{'time':round(float(i*512/sr),4),'strength':round(min(1,float(strength[i]/peak)),4)} for i in indices if i*512/sr < duration-.05]
    return envelope,onsets

def write_musicxml(directory, title, bpm):
    from music21 import converter, metadata, tempo, meter
    score = converter.parse(str(directory/'score.mid'), quantizePost=True)
    score.metadata = metadata.Metadata(title=title+' · 自动转写待校谱', composer='Demucs / Basic Pitch; estimated tempo and 4/4 layout')
    for part in score.parts:
        part.insert(0,tempo.MetronomeMark(number=bpm))
        if not part.getElementsByClass(meter.TimeSignature):part.insert(0,meter.TimeSignature('4/4'))
    score.write('musicxml', fp=str(directory/'score.musicxml'))

def analyze(track_id, model, pitch_model, device):
    title, theme = TRACKS[track_id]
    source = ROOT/'output/audio'/f'{track_id}.mp3'
    directory = ROOT/'output/lu-band'/track_id
    directory.mkdir(parents=True,exist_ok=True)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    result_path = directory/'score.json'
    if result_path.exists():
        existing=json.loads(result_path.read_text())
        if existing.get('sourceSha256') == source_hash and (track_id!='anime_op_overtaken' or existing.get('instrumental')) and all((directory/f'{s}.mp3').exists() for s in LABELS):
            print(f'SKIP {track_id}: verified existing source',flush=True)
            return
    started=time.time()
    pcm=run(['ffmpeg','-v','error','-i',str(source),'-f','f32le','-ar','44100','-ac','2','pipe:1'])
    audio=np.frombuffer(pcm,dtype='<f4').reshape(-1,2).T.copy()
    duration=audio.shape[1]/44100
    stems={}
    if all((directory/f'{name}.wav').exists() for name in model.sources):
        stems={name:sf.read(directory/f'{name}.wav',dtype='float32',always_2d=True)[0].T for name in model.sources}
    else:
        reference=torch.from_numpy(audio).mean(0)
        mean,std=reference.mean(),reference.std().clamp_min(1e-8)
        wav=(torch.from_numpy(audio)-mean)/std
        print(f'SEPARATE {track_id}: {duration:.1f}s, device={device}',flush=True)
        with torch.no_grad():
            separated=apply_model(model,wav[None],device=device,shifts=0,split=True,overlap=.25,segment=7.8,progress=True)[0].cpu()*std+mean
        stems={name:separated[i].numpy() for i,name in enumerate(model.sources)}
        for name,stem in stems.items():sf.write(directory/f'{name}.wav',stem.T,44100,subtype='FLOAT')
    full_mono=librosa.resample(audio.mean(0),orig_sr=44100,target_sr=22050)
    bpm=float(np.asarray(librosa.beat.beat_track(y=full_mono,sr=22050)[0]).reshape(-1)[0])
    if not np.isfinite(bpm) or bpm<40 or bpm>240:bpm=120
    midi=pretty_midi.PrettyMIDI(initial_tempo=bpm)
    results=[]
    for name,stem in stems.items():
        print(f'TRANSCRIBE {track_id}/{name}',flush=True)
        run(['ffmpeg','-v','error','-y','-i',str(directory/f'{name}.wav'),'-codec:a','libmp3lame','-b:a','160k',str(directory/f'{name}.mp3')])
        mono=librosa.resample(stem.mean(0),orig_sr=44100,target_sr=22050)
        envelope,onsets=features(mono,duration)
        events=[]
        if name=='drums':
            for onset in onsets:
                pos=int(onset['time']*22050)
                clip=mono[max(0,pos-128):pos+2048]
                spectrum=np.abs(np.fft.rfft(clip*np.hanning(len(clip))))
                freq=np.fft.rfftfreq(len(clip),1/22050)
                power=[float(np.sum(spectrum[(freq>=lo)&(freq<hi)]**2)) for lo,hi in [(35,180),(180,2500),(2500,10000)]]
                note=[36,38,42][int(np.argmax(power))]
                events.append({'start':onset['time'],'end':round(min(duration,onset['time']+.14),4),'midi':note,'velocity':onset['strength'],'confidence':.5})
        else:
            _, _, notes = predict(directory/f'{name}.wav',pitch_model,onset_threshold=.55,frame_threshold=.3,minimum_note_length=130,minimum_frequency=30 if name=='bass' else 65,maximum_frequency=400 if name=='bass' else 2000,multiple_pitch_bends=False)
            for start,end,pitch,amplitude,_ in notes:
                start,end=max(0,float(start)),min(duration,float(end))
                if end-start<.12:continue
                # Basic Pitch amplitude is model activation, not calibrated probability.
                confidence=float(np.clip(amplitude,0,1))
                events.append({'start':round(start,4),'end':round(end,4),'midi':int(pitch),'velocity':round(confidence,4),'confidence':round(confidence,4)})
        events.sort(key=lambda event:event['start'])
        if name=='vocals' and track_id=='anime_op_overtaken':
            # Known instrumental source: separation bleed must not become singing.
            events=[];onsets=[]
            for point in envelope:point['value']=0
        instrument=pretty_midi.Instrument(program={'bass':33,'vocals':53,'other':0,'drums':0}[name],is_drum=name=='drums',name=name)
        for event in events:
            instrument.notes.append(pretty_midi.Note(velocity=max(1,min(127,round(event['velocity']*127))),pitch=event['midi'],start=event['start'],end=event['end']))
        midi.instruments.append(instrument)
        results.append({'id':name,'label':LABELS[name],'audio':f'./output/lu-band/{track_id}/{name}.mp3','events':events,'envelope':envelope,'onsets':onsets,'rms':float(np.sqrt(np.mean(stem**2)))})
    midi.write(str(directory/'score.mid'))
    xml_error=None
    try:write_musicxml(directory,title,bpm)
    except Exception as error:xml_error=str(error)
    sections=[]
    by_id={stem['id']:stem for stem in results}
    for start in np.arange(0,duration,8):
        end=min(float(start+8),duration)
        energy={name:float(np.mean([pt['value'] for pt in by_id[name]['envelope'] if start<=pt['time']<end]) or 0) for name in LABELS}
        lead=max(energy,key=lambda name:energy[name]*{'vocals':1.15,'other':.85,'bass':.65,'drums':.45}[name])
        if max(energy.values())<.06:lead=None
        sections.append({'start':round(float(start),4),'end':round(end,4),'lead':lead,'active':[name for name,value in energy.items() if value>.08],'label':'自动声部调度'})
    score={'version':1,'source':'analysis','title':title,'trackId':track_id,'theme':theme,'instrumental':track_id=='anime_op_overtaken','duration':round(duration,5),'sourceSha256':source_hash,'originalAudio':f'./output/audio/{track_id}.mp3','bpmEstimate':round(bpm,3),'models':{'separation':'htdemucs / Demucs 4.0.1, shifts=0','transcription':'Basic Pitch 0.4.0 ONNX'},'notice':'自动转写待校谱；鼓为频段起音估计，吉他与和声共享 other；拍速与 MusicXML 4/4 排版为估计。confidence 为模型激活，非校准概率。器乐曲不激活人声残留。','stems':results,'sections':sections,'musicxmlError':xml_error,'processingSeconds':round(time.time()-started,2),'reconstructionRelativeRms':float(np.sqrt(np.mean((audio-sum(stems.values()))**2))/max(np.sqrt(np.mean(audio**2)),1e-8))}
    result_path.write_text(json.dumps(score,ensure_ascii=False,separators=(',',':')))
    print(f'DONE {track_id}: {duration:.1f}s; notes={[len(s["events"]) for s in results]}; {score["processingSeconds"]:.1f}s; xml={xml_error or "ok"}',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--tracks',nargs='*',default=list(TRACKS))
    parser.add_argument('--device',default='mps' if torch.backends.mps.is_available() else 'cpu')
    args=parser.parse_args()
    torch.set_num_threads(4)
    torch.hub.set_dir(str(ROOT/'output/lu-band-models'))
    model=get_model('htdemucs')
    pitch_model=Model(build_icassp_2022_model_path(FilenameSuffix.onnx))
    for track in args.tracks:analyze(track,model,pitch_model,args.device)
