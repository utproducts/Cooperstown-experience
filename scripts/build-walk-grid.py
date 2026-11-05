"""Builds the walking grid for the bundled campus map (assets/images/asv-site-map.jpg).

Each cell of an N x N grid over the picture gets a walking cost from what's drawn there: white walkways are
cheapest, then pavement, parking and lawn; fields and buildings are a last resort (a pin can sit on one); water and
everything off the campus are blocked. The app finds the best path on it (src/lib/walk.ts).

    python3 scripts/build-walk-grid.py   # needs Pillow, numpy, scipy
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'assets/images/asv-site-map.jpg'
OUT = 'src/data/asv-walk-grid.json'
N = 240

# Reference colours on the map and the cost of walking through each (0 = can't).
CLASSES = [
    ((13, 46, 89), 0),      # off campus (navy)
    ((93, 196, 214), 0),    # water
    ((137, 205, 186), 0),   # water edge
    ((192, 190, 187), 2),   # pavement, plazas
    ((104, 104, 104), 3),   # roads and parking lots
    ((182, 218, 179), 4),   # lawn
    ((242, 223, 195), 4),   # player village grounds
    ((110, 150, 105), 5),   # amphitheater lawn
    ((35, 133, 77), 9),     # fields (go around)
    ((70, 180, 80), 9),     # infields
    ((255, 216, 51), 9),    # infields
    ((40, 90, 160), 9),     # buildings
    ((30, 60, 110), 9),     # buildings
    ((40, 40, 40), 9),      # dugouts, bleachers
]


def main():
    img = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int32)
    h, w, _ = img.shape
    refs = np.array([c for c, _ in CLASSES])
    costs = np.array([k for _, k in CLASSES])
    # Nearest reference colour per pixel.
    d = ((img[:, :, None, :] - refs[None, None, :, :]) ** 2).sum(-1)
    cost = costs[d.argmin(-1)]

    # Walkways are long white lines; field names, bases and icons are small white blobs, so keep only big ones.
    white = (img > 232).all(-1)
    labels, n = ndimage.label(white)
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl and max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) >= 90:
            keep[i] = True
    walkway = ndimage.binary_dilation(keep[labels], iterations=2)

    cells = []
    for gy in range(N):
        row = []
        for gx in range(N):
            y0, y1 = gy * h // N, (gy + 1) * h // N
            x0, x1 = gx * w // N, (gx + 1) * w // N
            if walkway[y0:y1, x0:x1].any():
                row.append('1')
                continue
            vals, counts = np.unique(cost[y0:y1, x0:x1], return_counts=True)
            row.append(str(vals[counts.argmax()]))
        cells.append(''.join(row))
    json.dump({'size': N, 'rows': cells}, open(OUT, 'w'), separators=(',', ':'))
    flat = ''.join(cells)
    print(OUT, {k: flat.count(k) for k in '0123456789'}, file=sys.stderr)


main()
