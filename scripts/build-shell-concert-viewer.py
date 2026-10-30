"""Package the actual stage mesh and existing cast into a file-openable viewer.

All project assets are embedded. Three.js is pinned to the same version as the
main project and is the only network dependency. No localhost server is needed.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/models/band-shell-concert'


def data_url(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')


def build():
    manifest = json.loads((ASSET / 'manifest.json').read_text())
    model = (ASSET / manifest['model']).read_bytes()
    assert hashlib.sha256(model).hexdigest() == manifest['sha256'][manifest['model']]
    assert hashlib.sha256((ASSET / manifest['environmentModel']).read_bytes()).hexdigest() == manifest['sha256'][manifest['environmentModel']]
    assert hashlib.sha256((ASSET / manifest['skyTexture']).read_bytes()).hexdigest() == manifest['sha256'][manifest['skyTexture']]
    payload = {
        'model': base64.b64encode(model).decode('ascii'),
        'environment': base64.b64encode((ASSET / manifest['environmentModel']).read_bytes()).decode('ascii'),
        'environmentSHA256': manifest['sha256'][manifest['environmentModel']],
        'sky': data_url(ASSET / manifest['skyTexture'], 'image/png'),
        'skySHA256': manifest['sha256'][manifest['skyTexture']],
        'anchors': manifest['actorAnchors'],
        'cast': {
            anchor['id']: data_url(ROOT / f"assets/band-pets/{anchor['id']}.webp", 'image/webp')
            for anchor in manifest['actorAnchors']
        },
        'sha256': manifest['sha256'][manifest['model']],
    }
    template = (ROOT / 'scripts/templates/shell-concert-viewer.html').read_text()
    module = (ROOT / 'js/ui/shell-concert-preview.js').read_text()
    packed = template.replace('/*__SHELL_DATA__*/', json.dumps(payload, separators=(',', ':')))
    packed = packed.replace('/*__SHELL_MODULE__*/', module.replace('</script', '<\\/script'))
    destination = ROOT / 'shell-concert.html'
    destination.write_text(packed)
    print(f'Built {destination.name}: {destination.stat().st_size:,} bytes; model {payload["sha256"]}')


if __name__ == '__main__':
    build()
