import subprocess
from synthesize_audio import measure_audio

wav_in = 'output/film/film_master.wav'
wav_out = 'output/film/film_master_final.wav'
aac_out = 'output/film/film_master_final.m4a'

subprocess.run([
    'ffmpeg', '-y', '-v', 'error',
    '-i', wav_in,
    '-af', 'volume=0.3dB,alimiter=limit=-1.8dB:attack=3:release=50:asc=1:level=false',
    wav_out
], check=True)

subprocess.run([
    'ffmpeg', '-y', '-v', 'error',
    '-i', wav_out,
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    aac_out
], check=True)

lufs, tp = measure_audio(aac_out)
print(f"Final audio saved to {aac_out}: Integrated = {lufs:.2f} LUFS, True Peak = {tp:.2f} dBTP")
