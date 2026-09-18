"""Deterministic spherical Voronoi topology for contiguous sculpted lychee rind."""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import SphericalVoronoi

out = Path(__file__).resolve().parents[2] / 'assets/mascots/blender/rind-cells.json'
data = {}
for count in [72, 200, 580]:
    rng = np.random.default_rng(20260915 + count)
    i = np.arange(count)
    z = 1 - 2 * (i + .5) / count
    phi = i * np.pi * (3 - np.sqrt(5))
    points = np.column_stack([np.sqrt(1-z*z)*np.cos(phi), np.sqrt(1-z*z)*np.sin(phi), z])
    points += rng.normal(0, .014, points.shape)
    points /= np.linalg.norm(points, axis=1)[:, None]
    cells = SphericalVoronoi(points)
    cells.sort_vertices_of_regions()
    data[str(count)] = {'centers': points.tolist(), 'vertices': cells.vertices.tolist(), 'regions': [[int(i) for i in region] for region in cells.regions]}
out.write_text(json.dumps(data))
print(out, out.stat().st_size)
