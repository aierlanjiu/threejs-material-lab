"""Run inside an already-open Blender to avoid background Metal startup.

Creates a separate scene and writes only that scene to the deliverable .blend.
Keeps the original scene, current file path and delivered GLB. Does not render.
"""
from pathlib import Path
import runpy
import sys
import traceback

BUILDER = Path(__file__).resolve().with_name('build-shell-concert.py')
previous_arguments = sys.argv[:]
try:
    sys.argv = ['blender', '--', '--new-scene', '--blend-only', '--no-render', '--device', 'CPU']
    runpy.run_path(str(BUILDER), run_name='__main__')
except Exception:
    log = BUILDER.parent.parent / 'output/shell-concert-20261029/native-build-error.txt'
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(traceback.format_exc())
    print('SHELL_CONCERT_NATIVE_ERROR', str(log), flush=True)
    raise
finally:
    sys.argv = previous_arguments
