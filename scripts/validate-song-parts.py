"""Verify candidate files and encoded timing; does not approve instrument identity."""
from pathlib import Path
import csv
import hashlib
import json
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import correlate, correlation_lags, resample_poly

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'output/lu-band-song-parts'

def digest(path):
    result=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):result.update(block)
    return result.hexdigest()

def run(command):
    result=subprocess.run(command,capture_output=True,timeout=45)
    if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace')[-1000:])
    return result.stdout

def main():
    rows=json.loads((OUT/'audit.json').read_text())
    results=[]
    mapping=[]
    for row in rows:
        folder=OUT/row['trackId'];score=json.loads((folder/'score.json').read_text())
        source=ROOT/score['originalAudio'].removeprefix('./')
        result={'trackId':score['trackId'],'sourceDigestPassed':digest(source)==score['sourceSha256'],'stems':[],
                'semanticIdentityReviewed':False,'fullSongAccepted':False}
        for stem in score['stems']:
            mp3=folder/f'{stem["id"]}.mp3'
            info=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(mp3)]))
            duration=float(info['format']['duration'])
            data={'stemId':stem['id'],'digestPassed':digest(mp3)==stem['audioSha256'],
                  'durationDeltaSeconds':round(duration-score['duration'],6),'encodedTiming':None}
            clips=stem.get('reviewClips',[])
            start=clips[0]['start'] if clips else max(0,min(score['duration']-2,score['duration']/2))
            with sf.SoundFile(folder/f'{stem["id"]}.wav') as wave:
                wave.seek(int(round(start*wave.samplerate)))
                original=resample_poly(wave.read(int(1.5*wave.samplerate),dtype='float32',always_2d=True).mean(1),1,2)
            encoded=np.frombuffer(run(['ffmpeg','-v','error','-ss',str(start),'-i',str(mp3),'-t','1.5','-ac','1','-ar','22050','-f','f32le','pipe:1']),dtype='<f4')
            size=min(len(original),len(encoded));a=original[200:size-200];b=encoded[200:size-200]
            if len(a)>1000 and float(np.sqrt(np.mean(a*a)))>1e-7:
                a=a-a.mean();b=b-b.mean();values=correlate(a,b,mode='full',method='fft');lags=correlation_lags(len(a),len(b),mode='full');keep=np.abs(lags)<=2205
                index=int(np.argmax(values[keep]));lag=int(lags[keep][index]);normal=max(float(np.linalg.norm(a)*np.linalg.norm(b)),1e-12)
                confidence=float(values[keep][index]/normal)
                data['encodedTiming']={'lagMs':round(lag/22050*1000,4),'correlation':round(confidence,6),
                                       'startSeconds':start,'passed':abs(lag/22050)<=.02 if confidence>=.8 else None}
                if confidence<.8:data['encodedTiming']['reason']='相关性不足，不能据此确认编码时差'
            else:data['encodedTiming']={'passed':None,'reason':'该窗信号过弱，不能据此验证时差'}
            result['stems'].append(data)
        result['assetChecksPassed']=result['sourceDigestPassed'] and all(s['digestPassed'] and abs(s['durationDeltaSeconds'])<.08 and s['encodedTiming']['passed'] is not False for s in result['stems'])
        results.append(result)
        for part in score['songBindings']['parts']:
            mapping.append({'trackId':score['trackId'],'title':score['title'],'partId':part['id'],'instrumentCandidate':part['instrumentId'],
                            'status':part['status'],'onePieceActor':part['actors']['one-piece'],'dragonBallActor':part['actors']['dragon-ball'],
                            'narutoActor':part['actors']['naruto'],'petInstrumentMatch':'requires-check','unresolvedBacking':bool(score['songBindings']['unresolved'])})
        print(f'VALIDATE {score["trackId"]}: assetChecks={result["assetChecksPassed"]}; identity=PENDING',flush=True)
    (OUT/'asset-validation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    with (OUT/'song-actor-candidates.csv').open('w',newline='',encoding='utf-8-sig') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(mapping[0]));writer.writeheader();writer.writerows(mapping)
    if not all(r['assetChecksPassed'] for r in results):raise SystemExit(1)

if __name__=='__main__':main()
