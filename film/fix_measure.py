with open('film/synthesize_audio.py', 'r') as f:
    code = f.read()

old_func = """def measure_audio(wav_path):
    \"\"\"Runs ebur128 scanner on wav/mp4 to measure Integrated LUFS and True Peak.\"\"\"
    cmd = [
        'ffmpeg', '-nostats', '-i', str(wav_path),
        '-filter_complex', 'ebur128=peak=true',
        '-f', 'null', '-'
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    out = res.stderr
    
    lufs = None
    true_peak = None
    for line in out.splitlines():
        if 'Integrated loudness:' in line:
            parts = line.split('I:')
            if len(parts) > 1:
                lufs = float(parts[1].replace('LUFS', '').strip())
        if 'True peak:' in line and 'Peak:' in line:
            parts = line.split('Peak:')
            if len(parts) > 1:
                true_peak = float(parts[1].replace('dBFS', '').replace('dBTP', '').strip())
    return lufs, true_peak"""

new_func = """def measure_audio(wav_path):
    \"\"\"Runs ebur128 scanner on wav/mp4 to measure Integrated LUFS and True Peak.\"\"\"
    cmd = [
        'ffmpeg', '-nostats', '-i', str(wav_path),
        '-filter_complex', 'ebur128=peak=true',
        '-f', 'null', '-'
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    lines = res.stderr.splitlines()
    lufs = None
    true_peak = None
    for i, line in enumerate(lines):
        if 'Integrated loudness:' in line and i + 1 < len(lines):
            lufs = float(lines[i+1].split('I:')[1].replace('LUFS', '').strip())
        if 'True peak:' in line and i + 1 < len(lines):
            true_peak = float(lines[i+1].split('Peak:')[1].replace('dBFS', '').replace('dBTP', '').strip())
    return lufs, true_peak"""

assert old_func in code, "old_func not found"
code = code.replace(old_func, new_func)
with open('film/synthesize_audio.py', 'w') as f:
    f.write(code)
print("Updated measure_audio successfully")
