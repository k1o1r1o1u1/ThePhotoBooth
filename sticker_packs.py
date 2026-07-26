"""
Sticker Pack Renderer — draws themed decorative elements (hearts, stars, dots,
paw prints, sparkles, bows) directly onto a PIL collage image.

Each pack is a list of sticker definitions with:
  - shape: 'heart' | 'star' | 'circle' | 'paw' | 'sparkle4' | 'diamond'
  - x, y: position in pixels on the 1182×3544 frame
  - size: radius/size in pixels
  - color: RGB tuple
  - rotation: degrees (optional)
"""

import math
from PIL import ImageDraw

# ── Collage geometry constants (must match app.py) ──────────────────────────
FRAME_W, FRAME_H = 1182, 3544
PHOTO_W, PHOTO_H = 1022, 752
LEFT_MARGIN = (FRAME_W - PHOTO_W) // 2
TOP_MARGIN = LEFT_MARGIN
GUTTER = 80

# Photo slot Y positions (top of each photo)
PHOTO_TOPS = [TOP_MARGIN + i * (PHOTO_H + GUTTER) for i in range(4)]
# Photo slot bottoms
PHOTO_BOTTOMS = [y + PHOTO_H for y in PHOTO_TOPS]


# ═══════════════════════════════════════════════════════════════════════════
# Shape drawing primitives
# ═══════════════════════════════════════════════════════════════════════════

def _draw_circle(draw, cx, cy, r, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)


def _draw_star(draw, cx, cy, r, color, points=5, rotation=0):
    """Draw a filled star polygon."""
    angle_step = math.pi / points
    offset = math.radians(rotation) - math.pi / 2
    coords = []
    for i in range(2 * points):
        radius = r if i % 2 == 0 else r * 0.4
        angle = offset + i * angle_step
        coords.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    draw.polygon(coords, fill=color)


def _draw_heart(draw, cx, cy, size, color):
    """Draw a filled heart using two circles and a triangle."""
    r = size * 0.42
    offset_x = r * 0.72
    offset_y = r * 0.25
    # Two upper circles
    draw.ellipse([cx - offset_x - r, cy - offset_y - r,
                  cx - offset_x + r, cy - offset_y + r], fill=color)
    draw.ellipse([cx + offset_x - r, cy - offset_y - r,
                  cx + offset_x + r, cy - offset_y + r], fill=color)
    # Bottom triangle
    draw.polygon([
        (cx - offset_x - r, cy - offset_y + r * 0.15),
        (cx + offset_x + r, cy - offset_y + r * 0.15),
        (cx, cy + size * 0.72)
    ], fill=color)


def _draw_diamond(draw, cx, cy, size, color):
    """Draw a 4-pointed diamond/sparkle."""
    draw.polygon([
        (cx, cy - size),
        (cx + size * 0.3, cy),
        (cx, cy + size),
        (cx - size * 0.3, cy)
    ], fill=color)


def _draw_sparkle4(draw, cx, cy, size, color):
    """Draw a 4-pointed sparkle star (thin arms)."""
    arm = size
    thin = size * 0.18
    # Vertical arm
    draw.polygon([(cx, cy - arm), (cx + thin, cy), (cx, cy + arm), (cx - thin, cy)], fill=color)
    # Horizontal arm
    draw.polygon([(cx - arm, cy), (cx, cy - thin), (cx + arm, cy), (cx, cy + thin)], fill=color)


def _draw_paw(draw, cx, cy, size, color):
    """Draw a paw print: one large pad + four toe pads."""
    pad_r = size * 0.35
    toe_r = size * 0.18
    # Main pad
    draw.ellipse([cx - pad_r, cy - pad_r * 0.2, cx + pad_r, cy + pad_r * 1.2], fill=color)
    # Toe pads
    offsets = [(-0.55, -0.65), (-0.2, -0.9), (0.2, -0.9), (0.55, -0.65)]
    for ox, oy in offsets:
        tx = cx + size * ox
        ty = cy + size * oy
        draw.ellipse([tx - toe_r, ty - toe_r, tx + toe_r, ty + toe_r], fill=color)


def _draw_bow(draw, cx, cy, size, color):
    """Draw a cute bow shape."""
    r = size * 0.4
    # Left loop
    draw.ellipse([cx - r * 2.2, cy - r, cx - r * 0.3, cy + r], fill=color)
    # Right loop
    draw.ellipse([cx + r * 0.3, cy - r, cx + r * 2.2, cy + r], fill=color)
    # Center knot
    knot = size * 0.18
    draw.ellipse([cx - knot, cy - knot, cx + knot, cy + knot], fill=color)


# Shape dispatcher
SHAPE_DRAWERS = {
    'circle': _draw_circle,
    'star': lambda draw, cx, cy, r, color, **kw: _draw_star(draw, cx, cy, r, color, rotation=kw.get('rotation', 0)),
    'heart': _draw_heart,
    'diamond': _draw_diamond,
    'sparkle4': _draw_sparkle4,
    'paw': _draw_paw,
    'bow': _draw_bow,
}


# ═══════════════════════════════════════════════════════════════════════════
# Sticker Pack Definitions
# ═══════════════════════════════════════════════════════════════════════════

# Helpers for positioning in margins / gutters
_right_edge = FRAME_W - LEFT_MARGIN
_bottom_strip = FRAME_H - TOP_MARGIN

def _gutter_y(slot_idx):
    """Y center of the gutter below photo slot_idx (0-2)."""
    return PHOTO_BOTTOMS[slot_idx] + GUTTER // 2

def _margin_positions(slot_idx):
    """Return (top_left, top_right, bot_left, bot_right) corners of margins for a photo slot."""
    top = PHOTO_TOPS[slot_idx]
    bot = PHOTO_BOTTOMS[slot_idx]
    return {
        'tl': (LEFT_MARGIN // 2, top + 30),
        'tr': (_right_edge + LEFT_MARGIN // 2, top + 30),
        'bl': (LEFT_MARGIN // 2, bot - 30),
        'br': (_right_edge + LEFT_MARGIN // 2, bot - 30),
    }

# Photo corner helper — returns (x,y) for corners of photo slot i
# Offsets push stickers inward onto the photo from corners
def _photo_corner(slot, corner, inset=60):
    """Get (x,y) on a photo corner. corner: 'tl','tr','bl','br'."""
    t = PHOTO_TOPS[slot]
    b = PHOTO_BOTTOMS[slot]
    l = LEFT_MARGIN
    r = LEFT_MARGIN + PHOTO_W
    if corner == 'tl': return (l + inset, t + inset)
    if corner == 'tr': return (r - inset, t + inset)
    if corner == 'bl': return (l + inset, b - inset)
    if corner == 'br': return (r - inset, b - inset)


STICKER_PACKS = {
    'none': [],

    'girlypop': [
        # --- Margin / gutter stickers (big) ---
        {'shape': 'heart', 'x': 45, 'y': PHOTO_TOPS[0] - 20, 'size': 50, 'color': (255, 150, 180)},
        {'shape': 'bow', 'x': FRAME_W - 45, 'y': PHOTO_TOPS[0] - 15, 'size': 48, 'color': (255, 120, 170)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': PHOTO_TOPS[0] - 28, 'size': 22, 'color': (255, 210, 60)},
        {'shape': 'heart', 'x': 42, 'y': _gutter_y(0), 'size': 40, 'color': (230, 130, 170)},
        {'shape': 'bow', 'x': FRAME_W // 2, 'y': _gutter_y(0), 'size': 44, 'color': (255, 140, 180)},
        {'shape': 'circle', 'x': FRAME_W - 42, 'y': _gutter_y(0), 'size': 20, 'color': (255, 210, 60)},
        {'shape': 'heart', 'x': FRAME_W - 42, 'y': _gutter_y(1), 'size': 42, 'color': (255, 150, 180)},
        {'shape': 'circle', 'x': 40, 'y': _gutter_y(1), 'size': 22, 'color': (255, 210, 60)},
        {'shape': 'bow', 'x': FRAME_W // 2 + 60, 'y': _gutter_y(1), 'size': 40, 'color': (255, 140, 180)},
        {'shape': 'heart', 'x': 45, 'y': _gutter_y(2), 'size': 44, 'color': (230, 130, 170)},
        {'shape': 'circle', 'x': FRAME_W - 38, 'y': _gutter_y(2), 'size': 24, 'color': (255, 210, 60)},
        {'shape': 'bow', 'x': FRAME_W // 2, 'y': _gutter_y(2), 'size': 42, 'color': (255, 160, 190)},
        {'shape': 'heart', 'x': FRAME_W - 45, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 48, 'color': (255, 150, 180)},
        {'shape': 'heart', 'x': 45, 'y': PHOTO_BOTTOMS[3] + 35, 'size': 40, 'color': (230, 130, 170)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 22, 'color': (255, 210, 60)},
        # --- On photos (corners) ---
        {'shape': 'heart', 'x': _photo_corner(0, 'tr')[0], 'y': _photo_corner(0, 'tr')[1], 'size': 45, 'color': (255, 160, 190)},
        {'shape': 'bow', 'x': _photo_corner(1, 'tl')[0], 'y': _photo_corner(1, 'tl')[1], 'size': 40, 'color': (255, 120, 170)},
        {'shape': 'heart', 'x': _photo_corner(2, 'br')[0], 'y': _photo_corner(2, 'br')[1], 'size': 42, 'color': (230, 130, 170)},
        {'shape': 'heart', 'x': _photo_corner(3, 'tl')[0], 'y': _photo_corner(3, 'tl')[1], 'size': 38, 'color': (255, 150, 180)},
        {'shape': 'circle', 'x': _photo_corner(1, 'br')[0], 'y': _photo_corner(1, 'br')[1], 'size': 18, 'color': (255, 210, 60)},
        {'shape': 'circle', 'x': _photo_corner(3, 'tr')[0], 'y': _photo_corner(3, 'tr')[1], 'size': 20, 'color': (255, 210, 60)},
    ],

    'cute_stars': [
        # --- Margin / gutter stickers ---
        {'shape': 'star', 'x': 48, 'y': PHOTO_TOPS[0] - 18, 'size': 45, 'color': (255, 200, 60), 'rotation': 15},
        {'shape': 'sparkle4', 'x': FRAME_W - 45, 'y': PHOTO_TOPS[0] - 12, 'size': 38, 'color': (100, 220, 255)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': PHOTO_TOPS[0] - 25, 'size': 28, 'color': (130, 200, 255)},
        {'shape': 'star', 'x': 42, 'y': _gutter_y(0), 'size': 40, 'color': (170, 130, 255), 'rotation': 30},
        {'shape': 'circle', 'x': FRAME_W - 40, 'y': _gutter_y(0), 'size': 30, 'color': (130, 200, 255)},
        {'shape': 'sparkle4', 'x': FRAME_W // 2, 'y': _gutter_y(0), 'size': 32, 'color': (0, 220, 200)},
        {'shape': 'circle', 'x': 40, 'y': _gutter_y(1), 'size': 28, 'color': (130, 200, 255)},
        {'shape': 'star', 'x': FRAME_W // 2, 'y': _gutter_y(1), 'size': 36, 'color': (170, 130, 255), 'rotation': 45},
        {'shape': 'sparkle4', 'x': FRAME_W - 42, 'y': _gutter_y(1), 'size': 34, 'color': (255, 140, 200)},
        {'shape': 'star', 'x': FRAME_W - 45, 'y': _gutter_y(2), 'size': 42, 'color': (255, 200, 60), 'rotation': 20},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': _gutter_y(2), 'size': 26, 'color': (130, 200, 255)},
        {'shape': 'sparkle4', 'x': 45, 'y': _gutter_y(2), 'size': 30, 'color': (0, 220, 200)},
        {'shape': 'star', 'x': 48, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 40, 'color': (170, 130, 255), 'rotation': -20},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': PHOTO_BOTTOMS[3] + 32, 'size': 28, 'color': (130, 200, 255)},
        {'shape': 'star', 'x': FRAME_W - 48, 'y': PHOTO_BOTTOMS[3] + 28, 'size': 38, 'color': (255, 200, 60), 'rotation': 35},
        # --- On photos (corners) ---
        {'shape': 'star', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 42, 'color': (255, 200, 60), 'rotation': 10},
        {'shape': 'sparkle4', 'x': _photo_corner(1, 'tr')[0], 'y': _photo_corner(1, 'tr')[1], 'size': 36, 'color': (100, 220, 255)},
        {'shape': 'star', 'x': _photo_corner(2, 'tl')[0], 'y': _photo_corner(2, 'tl')[1], 'size': 38, 'color': (170, 130, 255), 'rotation': -15},
        {'shape': 'sparkle4', 'x': _photo_corner(3, 'br')[0], 'y': _photo_corner(3, 'br')[1], 'size': 40, 'color': (255, 140, 200)},
        {'shape': 'circle', 'x': _photo_corner(0, 'br')[0], 'y': _photo_corner(0, 'br')[1], 'size': 22, 'color': (0, 220, 200)},
        {'shape': 'circle', 'x': _photo_corner(2, 'tr')[0], 'y': _photo_corner(2, 'tr')[1], 'size': 20, 'color': (255, 200, 60)},
    ],

    'kawaii_paws': [
        # --- Margin / gutter ---
        {'shape': 'paw', 'x': 48, 'y': PHOTO_TOPS[0] - 12, 'size': 50, 'color': (255, 180, 200)},
        {'shape': 'sparkle4', 'x': FRAME_W - 42, 'y': PHOTO_TOPS[0] - 10, 'size': 32, 'color': (255, 220, 100)},
        {'shape': 'paw', 'x': FRAME_W - 48, 'y': _gutter_y(0), 'size': 46, 'color': (255, 180, 200)},
        {'shape': 'sparkle4', 'x': 40, 'y': _gutter_y(0), 'size': 30, 'color': (255, 220, 100)},
        {'shape': 'paw', 'x': 45, 'y': _gutter_y(1), 'size': 48, 'color': (200, 180, 230)},
        {'shape': 'sparkle4', 'x': FRAME_W // 2, 'y': _gutter_y(1), 'size': 34, 'color': (255, 220, 100)},
        {'shape': 'paw', 'x': FRAME_W - 45, 'y': _gutter_y(1), 'size': 44, 'color': (255, 180, 200)},
        {'shape': 'paw', 'x': 48, 'y': _gutter_y(2), 'size': 46, 'color': (200, 180, 230)},
        {'shape': 'sparkle4', 'x': FRAME_W - 42, 'y': _gutter_y(2), 'size': 32, 'color': (255, 220, 100)},
        {'shape': 'paw', 'x': FRAME_W - 48, 'y': PHOTO_BOTTOMS[3] + 32, 'size': 52, 'color': (255, 180, 200)},
        {'shape': 'sparkle4', 'x': 42, 'y': PHOTO_BOTTOMS[3] + 35, 'size': 30, 'color': (255, 220, 100)},
        {'shape': 'paw', 'x': FRAME_W // 2, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 48, 'color': (200, 180, 230)},
        # --- On photos ---
        {'shape': 'paw', 'x': _photo_corner(0, 'bl')[0], 'y': _photo_corner(0, 'bl')[1], 'size': 44, 'color': (255, 180, 200)},
        {'shape': 'paw', 'x': _photo_corner(1, 'tr')[0], 'y': _photo_corner(1, 'tr')[1], 'size': 40, 'color': (200, 180, 230)},
        {'shape': 'sparkle4', 'x': _photo_corner(2, 'tl')[0], 'y': _photo_corner(2, 'tl')[1], 'size': 34, 'color': (255, 220, 100)},
        {'shape': 'paw', 'x': _photo_corner(3, 'br')[0], 'y': _photo_corner(3, 'br')[1], 'size': 46, 'color': (255, 180, 200)},
        {'shape': 'sparkle4', 'x': _photo_corner(0, 'tr')[0], 'y': _photo_corner(0, 'tr')[1], 'size': 30, 'color': (255, 220, 100)},
    ],

    'party_confetti': [
        # --- Margin / gutter --- lots of scattered confetti
        {'shape': 'circle', 'x': 40, 'y': PHOTO_TOPS[0] - 22, 'size': 24, 'color': (255, 80, 120)},
        {'shape': 'circle', 'x': FRAME_W // 3, 'y': PHOTO_TOPS[0] - 26, 'size': 20, 'color': (60, 200, 255)},
        {'shape': 'diamond', 'x': FRAME_W - 42, 'y': PHOTO_TOPS[0] - 15, 'size': 30, 'color': (255, 200, 60)},
        {'shape': 'circle', 'x': FRAME_W * 2 // 3, 'y': PHOTO_TOPS[0] - 20, 'size': 22, 'color': (180, 100, 255)},
        {'shape': 'circle', 'x': 38, 'y': _gutter_y(0), 'size': 22, 'color': (60, 200, 255)},
        {'shape': 'diamond', 'x': FRAME_W // 2, 'y': _gutter_y(0), 'size': 28, 'color': (255, 80, 120)},
        {'shape': 'circle', 'x': FRAME_W - 38, 'y': _gutter_y(0), 'size': 20, 'color': (100, 220, 100)},
        {'shape': 'diamond', 'x': FRAME_W - 40, 'y': _gutter_y(1), 'size': 30, 'color': (180, 100, 255)},
        {'shape': 'circle', 'x': FRAME_W // 2 - 30, 'y': _gutter_y(1), 'size': 22, 'color': (60, 200, 255)},
        {'shape': 'diamond', 'x': 42, 'y': _gutter_y(1), 'size': 26, 'color': (100, 220, 100)},
        {'shape': 'circle', 'x': 40, 'y': _gutter_y(2), 'size': 24, 'color': (180, 100, 255)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': _gutter_y(2), 'size': 18, 'color': (255, 200, 60)},
        {'shape': 'diamond', 'x': FRAME_W - 40, 'y': _gutter_y(2), 'size': 30, 'color': (255, 80, 120)},
        {'shape': 'circle', 'x': FRAME_W // 3, 'y': PHOTO_BOTTOMS[3] + 32, 'size': 24, 'color': (60, 200, 255)},
        {'shape': 'diamond', 'x': FRAME_W * 2 // 3, 'y': PHOTO_BOTTOMS[3] + 28, 'size': 28, 'color': (100, 220, 100)},
        {'shape': 'circle', 'x': 42, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 22, 'color': (255, 80, 120)},
        {'shape': 'circle', 'x': FRAME_W - 40, 'y': PHOTO_BOTTOMS[3] + 34, 'size': 26, 'color': (180, 100, 255)},
        # --- On photos ---
        {'shape': 'diamond', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 32, 'color': (255, 200, 60)},
        {'shape': 'circle', 'x': _photo_corner(0, 'br')[0], 'y': _photo_corner(0, 'br')[1], 'size': 22, 'color': (60, 200, 255)},
        {'shape': 'circle', 'x': _photo_corner(1, 'tl')[0], 'y': _photo_corner(1, 'tl')[1], 'size': 20, 'color': (255, 80, 120)},
        {'shape': 'diamond', 'x': _photo_corner(2, 'tr')[0], 'y': _photo_corner(2, 'tr')[1], 'size': 28, 'color': (100, 220, 100)},
        {'shape': 'circle', 'x': _photo_corner(3, 'bl')[0], 'y': _photo_corner(3, 'bl')[1], 'size': 24, 'color': (180, 100, 255)},
        {'shape': 'diamond', 'x': _photo_corner(3, 'tr')[0], 'y': _photo_corner(3, 'tr')[1], 'size': 26, 'color': (255, 200, 60)},
    ],

    'dreamy_sparkle': [
        # --- Margin / gutter ---
        {'shape': 'sparkle4', 'x': 48, 'y': PHOTO_TOPS[0] - 15, 'size': 42, 'color': (220, 190, 120)},
        {'shape': 'diamond', 'x': FRAME_W - 45, 'y': PHOTO_TOPS[0] - 18, 'size': 28, 'color': (255, 240, 200)},
        {'shape': 'sparkle4', 'x': FRAME_W // 2, 'y': PHOTO_TOPS[0] - 22, 'size': 36, 'color': (240, 220, 160)},
        {'shape': 'sparkle4', 'x': 42, 'y': _gutter_y(0), 'size': 38, 'color': (255, 240, 200)},
        {'shape': 'sparkle4', 'x': FRAME_W - 42, 'y': _gutter_y(0), 'size': 34, 'color': (220, 190, 120)},
        {'shape': 'diamond', 'x': FRAME_W // 2, 'y': _gutter_y(0), 'size': 24, 'color': (255, 240, 200)},
        {'shape': 'sparkle4', 'x': FRAME_W - 42, 'y': _gutter_y(1), 'size': 40, 'color': (255, 240, 200)},
        {'shape': 'diamond', 'x': 45, 'y': _gutter_y(1), 'size': 28, 'color': (220, 190, 120)},
        {'shape': 'sparkle4', 'x': FRAME_W // 2, 'y': _gutter_y(1), 'size': 36, 'color': (240, 220, 160)},
        {'shape': 'sparkle4', 'x': 45, 'y': _gutter_y(2), 'size': 36, 'color': (220, 190, 120)},
        {'shape': 'sparkle4', 'x': FRAME_W - 42, 'y': _gutter_y(2), 'size': 38, 'color': (255, 240, 200)},
        {'shape': 'sparkle4', 'x': FRAME_W // 2, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 42, 'color': (220, 190, 120)},
        {'shape': 'diamond', 'x': 48, 'y': PHOTO_BOTTOMS[3] + 32, 'size': 26, 'color': (255, 240, 200)},
        {'shape': 'diamond', 'x': FRAME_W - 48, 'y': PHOTO_BOTTOMS[3] + 28, 'size': 30, 'color': (220, 190, 120)},
        # --- On photos ---
        {'shape': 'sparkle4', 'x': _photo_corner(0, 'tr')[0], 'y': _photo_corner(0, 'tr')[1], 'size': 38, 'color': (220, 190, 120)},
        {'shape': 'diamond', 'x': _photo_corner(1, 'bl')[0], 'y': _photo_corner(1, 'bl')[1], 'size': 26, 'color': (255, 240, 200)},
        {'shape': 'sparkle4', 'x': _photo_corner(2, 'tl')[0], 'y': _photo_corner(2, 'tl')[1], 'size': 36, 'color': (240, 220, 160)},
        {'shape': 'sparkle4', 'x': _photo_corner(3, 'tr')[0], 'y': _photo_corner(3, 'tr')[1], 'size': 40, 'color': (220, 190, 120)},
        {'shape': 'diamond', 'x': _photo_corner(3, 'bl')[0], 'y': _photo_corner(3, 'bl')[1], 'size': 24, 'color': (255, 240, 200)},
    ],

    'y2k_vibes': [
        # --- Margin / gutter ---
        {'shape': 'star', 'x': 48, 'y': PHOTO_TOPS[0] - 18, 'size': 48, 'color': (255, 20, 147), 'rotation': 10},
        {'shape': 'heart', 'x': FRAME_W - 48, 'y': PHOTO_TOPS[0] - 12, 'size': 44, 'color': (0, 191, 255)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': PHOTO_TOPS[0] - 24, 'size': 28, 'color': (180, 255, 20)},
        {'shape': 'star', 'x': FRAME_W - 45, 'y': _gutter_y(0), 'size': 42, 'color': (255, 20, 147), 'rotation': -15},
        {'shape': 'heart', 'x': 45, 'y': _gutter_y(0), 'size': 38, 'color': (0, 191, 255)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': _gutter_y(0), 'size': 24, 'color': (180, 255, 20)},
        {'shape': 'star', 'x': 42, 'y': _gutter_y(1), 'size': 40, 'color': (0, 191, 255), 'rotation': 25},
        {'shape': 'heart', 'x': FRAME_W - 45, 'y': _gutter_y(1), 'size': 42, 'color': (255, 20, 147)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': _gutter_y(1), 'size': 26, 'color': (180, 255, 20)},
        {'shape': 'heart', 'x': 45, 'y': _gutter_y(2), 'size': 44, 'color': (255, 20, 147)},
        {'shape': 'star', 'x': FRAME_W - 45, 'y': _gutter_y(2), 'size': 42, 'color': (0, 191, 255), 'rotation': -20},
        {'shape': 'star', 'x': 48, 'y': PHOTO_BOTTOMS[3] + 30, 'size': 44, 'color': (180, 255, 20), 'rotation': 30},
        {'shape': 'heart', 'x': FRAME_W - 48, 'y': PHOTO_BOTTOMS[3] + 32, 'size': 48, 'color': (255, 20, 147)},
        {'shape': 'circle', 'x': FRAME_W // 2, 'y': PHOTO_BOTTOMS[3] + 28, 'size': 28, 'color': (0, 191, 255)},
        # --- On photos ---
        {'shape': 'star', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 45, 'color': (255, 20, 147), 'rotation': 15},
        {'shape': 'heart', 'x': _photo_corner(1, 'br')[0], 'y': _photo_corner(1, 'br')[1], 'size': 40, 'color': (0, 191, 255)},
        {'shape': 'star', 'x': _photo_corner(2, 'tr')[0], 'y': _photo_corner(2, 'tr')[1], 'size': 42, 'color': (180, 255, 20), 'rotation': -10},
        {'shape': 'heart', 'x': _photo_corner(3, 'tl')[0], 'y': _photo_corner(3, 'tl')[1], 'size': 44, 'color': (255, 20, 147)},
        {'shape': 'circle', 'x': _photo_corner(1, 'tl')[0], 'y': _photo_corner(1, 'tl')[1], 'size': 22, 'color': (180, 255, 20)},
        {'shape': 'circle', 'x': _photo_corner(3, 'br')[0], 'y': _photo_corner(3, 'br')[1], 'size': 24, 'color': (0, 191, 255)},
    ],
}


def draw_sticker_pack(collage_img, pack_name):
    """Draw all stickers from a named pack onto the given PIL Image (in-place)."""
    stickers = STICKER_PACKS.get(pack_name, [])
    if not stickers:
        return
    draw = ImageDraw.Draw(collage_img)
    for s in stickers:
        shape = s['shape']
        drawer = SHAPE_DRAWERS.get(shape)
        if not drawer:
            continue
        kwargs = {}
        if 'rotation' in s:
            kwargs['rotation'] = s['rotation']
        drawer(draw, s['x'], s['y'], s['size'], s['color'], **kwargs)
