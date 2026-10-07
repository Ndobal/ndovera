"""Split the Ndovera logo into the six layers the splash animation assembles.

    python tool/split_logo.py <logo.png> <out_dir> [preview.png]

Each opaque shape in the logo (one colour, connected) is given to the design
element it belongs to: shield, letter N, gold curve, torch, graduation cap or
swoosh. Faint anti-aliased edge pixels go to the layer of their nearest
labelled neighbour. Every layer keeps the full 512x512 canvas, so the layers
stack at identical positions, and every pixel lands in exactly one layer:
the layers recombine to the original logo exactly (checked before writing).

The table below was read off the 512x512 logo (public/android-chrome-512x512.png).
If the artwork changes, rerun with a preview path and adjust the table.
"""
import sys
from collections import deque
from PIL import Image

LAYERS = ['shield', 'letter_n', 'gold_curve', 'torch', 'graduation_cap', 'swoosh']

# (colour, bounding box x0, x1, y0, y1) -> layer. Matched by box centre.
SHAPES = [
    ('gold', 261, 406, 171, 302, 'gold_curve'),
    ('gold', 240, 287, 303, 345, 'gold_curve'),
    ('gold', 224, 300, 21, 124, 'torch'),       # flame
    ('gold', 222, 303, 128, 170, 'torch'),      # cup
    ('gold', 243, 282, 173, 277, 'torch'),      # shaft
    ('gold', 97, 216, 96, 323, 'shield'),       # inner gold line, left
    ('gold', 309, 361, 96, 118, 'shield'),      # inner gold line, top right
    ('gold', 167, 384, 364, 455, 'shield'),     # inner gold line, bottom
    ('gold', 193, 405, 275, 376, 'swoosh'),
    ('gold', 63, 158, 314, 375, 'swoosh'),
    ('gold', 415, 465, 182, 259, 'swoosh'),
    ('gold', 413, 432, 195, 240, 'swoosh'),
    ('gold', 274, 349, 338, 400, 'swoosh'),
    ('gold', 380, 405, 302, 325, 'swoosh'),
    ('gold', 430, 445, 154, 207, 'graduation_cap'),  # tassel
    ('green', 158, 315, 170, 343, 'letter_n'),
    ('green', 126, 207, 198, 360, 'letter_n'),
    ('green', 141, 439, 276, 476, 'shield'),    # lower border and point
    ('green', 78, 220, 70, 364, 'shield'),      # left border
    ('green', 304, 445, 71, 155, 'shield'),     # top right border
    ('green', 333, 441, 126, 189, 'graduation_cap'),
    ('green', 331, 489, 168, 325, 'swoosh'),
    ('green', 43, 232, 302, 393, 'swoosh'),
    ('green', 233, 293, 362, 404, 'swoosh'),
]
PREVIEW = {'shield': (0, 110, 100), 'letter_n': (40, 60, 200), 'gold_curve': (230, 140, 0),
           'torch': (220, 30, 30), 'graduation_cap': (150, 0, 180), 'swoosh': (60, 180, 60)}


def main(src, out_dir, preview_path=None):
    im = Image.open(src).convert('RGBA')
    W, H = im.size
    px = im.load()

    def kind(x, y):
        r, g, b, a = px[x, y]
        if a <= 24:
            return None
        return 'gold' if (r > g and r - b > 25) else 'green'

    K = [[kind(x, y) for x in range(W)] for y in range(H)]
    label = [[None] * W for _ in range(H)]
    seen = [[False] * W for _ in range(H)]
    small = []
    for y in range(H):
        for x in range(W):
            k = K[y][x]
            if not k or seen[y][x]:
                continue
            pts = []
            q = deque([(x, y)])
            seen[y][x] = True
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and K[ny][nx] == k:
                            seen[ny][nx] = True
                            q.append((nx, ny))
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            match = None
            if len(pts) > 100:
                best = None
                for colour, x0, x1, y0, y1, layer in SHAPES:
                    if colour != k:
                        continue
                    d = abs((x0 + x1) / 2 - cx) + abs((y0 + y1) / 2 - cy)
                    if best is None or d < best[0]:
                        best = (d, layer)
                if best and best[0] > 12 and len(pts) > 1000:
                    raise SystemExit(f'Unmapped {k} shape at x={min(xs)}-{max(xs)} y={min(ys)}-{max(ys)} ({len(pts)}px): add it to SHAPES')
                if best:
                    match = best[1]
                    if best[0] > 12:
                        print(f'note: {k} shape at x={min(xs)}-{max(xs)} y={min(ys)}-{max(ys)} ({len(pts)}px) -> {match} (nearest)')
            for p in pts:
                label[p[1]][p[0]] = match
            if match is None:
                small.extend(pts)

    # Specks and faint edge pixels: take the layer of the nearest labelled pixel.
    pending = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] > 0 and label[y][x] is None]
    radius = 1
    while pending:
        rest = []
        for x, y in pending:
            found = None
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and label[ny][nx]:
                        found = label[ny][nx]
                        break
                if found:
                    break
            if found:
                label[y][x] = found
            else:
                rest.append((x, y))
        pending = rest
        radius += 1
        if radius > 64:
            # Isolated stray pixels in the artwork: keep them (so recombination stays exact) in the shield.
            for x, y in pending:
                label[y][x] = 'shield'
            pending = []

    layers = {name: Image.new('RGBA', (W, H), (0, 0, 0, 0)) for name in LAYERS}
    lpx = {name: layers[name].load() for name in LAYERS}
    for y in range(H):
        for x in range(W):
            if label[y][x]:
                lpx[label[y][x]][x, y] = px[x, y]

    # The layers must recombine to the original exactly.
    for y in range(H):
        for x in range(W):
            hits = [name for name in LAYERS if lpx[name][x, y][3] > 0]
            if px[x, y][3] > 0:
                assert len(hits) == 1 and lpx[hits[0]][x, y] == px[x, y], (x, y)
            else:
                assert not hits, (x, y)

    for name in LAYERS:
        layers[name].save(f'{out_dir}/{name}.png', optimize=True)
    im.save(f'{out_dir}/logo.png', optimize=True)

    if preview_path:
        prev = Image.new('RGB', (W, H), (255, 255, 255))
        pp = prev.load()
        for y in range(H):
            for x in range(W):
                if label[y][x]:
                    pp[x, y] = PREVIEW[label[y][x]]
        prev.save(preview_path)
    print('layers written; recombination is exact')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
