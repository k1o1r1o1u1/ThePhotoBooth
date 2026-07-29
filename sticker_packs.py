"""
Sticker Pack Renderer — draws themed decorative elements (hearts, stars, dots,
paw prints, sparkles, bows, banners, bulbs, ribbons, arrow hearts) directly
onto a PIL collage image.

Each pack is a list of sticker definitions with:
  - shape: 'heart' | 'star' | 'circle' | 'paw' | 'sparkle4' | 'diamond'
           | 'bow' | 'banner_flag' | 'bulb' | 'ribbon' | 'arrow_heart'
  - x, y: position in pixels on the 1182×3544 frame
  - size: radius/size in pixels
  - color: RGB tuple
  - rotation: degrees (optional)
"""

import math
import random
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


def _draw_banner_flag(draw, cx, cy, size, color, **kw):
    """Draw a triangular pennant / bunting flag pointing downward."""
    half_w = size * 0.75
    height = size * 1.3
    # Triangle pointing down
    draw.polygon([
        (cx - half_w, cy - height * 0.5),
        (cx + half_w, cy - height * 0.5),
        (cx,          cy + height * 0.5),
    ], fill=color)
    # Small top bar (string attachment)
    bar_h = size * 0.18
    draw.rectangle([cx - half_w, cy - height * 0.5 - bar_h,
                    cx + half_w, cy - height * 0.5], fill=color)


def _draw_bulb(draw, cx, cy, size, color, **kw):
    """Draw a party-light bulb: round glow body + small rectangular cap."""
    # Glow halo (lighter, larger)
    r_glow = size * 1.1
    glow_color = tuple(min(255, c + 80) for c in color)
    draw.ellipse([cx - r_glow, cy - r_glow, cx + r_glow, cy + r_glow],
                 fill=(*glow_color, 80) if len(color) == 3 else glow_color)
    # Main bulb
    r = size * 0.8
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    # Cap
    cap_w = size * 0.35
    cap_h = size * 0.45
    draw.rectangle([cx - cap_w, cy - r - cap_h, cx + cap_w, cy - r + 4],
                   fill=(60, 60, 60))


def _draw_ribbon(draw, cx, cy, size, color, **kw):
    """Draw a decorative ribbon / double-V chevron."""
    w = size
    h = size * 0.55
    # Left wing
    draw.polygon([
        (cx - w, cy - h),
        (cx,     cy),
        (cx - w, cy + h),
        (cx - w * 0.5, cy),
    ], fill=color)
    # Right wing
    draw.polygon([
        (cx + w, cy - h),
        (cx,     cy),
        (cx + w, cy + h),
        (cx + w * 0.5, cy),
    ], fill=color)
    # Center oval
    cr = size * 0.22
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=color)


def _draw_arrow_heart(draw, cx, cy, size, color, **kw):
    """Draw a heart pierced by a Cupid arrow."""
    # Heart
    _draw_heart(draw, cx, cy, size, color)
    # Arrow shaft
    arrow_color = (200, 100, 50)
    shaft_len = size * 1.4
    draw.line([(cx - shaft_len, cy - shaft_len * 0.5),
               (cx + shaft_len, cy + shaft_len * 0.5)],
              fill=arrow_color, width=max(3, int(size * 0.1)))
    # Arrowhead
    tip_x = cx + shaft_len
    tip_y = cy + shaft_len * 0.5
    head = size * 0.25
    draw.polygon([
        (tip_x, tip_y),
        (tip_x - head, tip_y - head * 0.4),
        (tip_x - head * 0.4, tip_y + head),
    ], fill=arrow_color)
    # Fletching (tail feathers)
    tail_x = cx - shaft_len
    tail_y = cy - shaft_len * 0.5
    f = size * 0.22
    draw.polygon([
        (tail_x, tail_y),
        (tail_x + f, tail_y - f),
        (tail_x + f * 0.4, tail_y + f * 0.2),
    ], fill=(220, 220, 180))


# Shape dispatcher
SHAPE_DRAWERS = {
    'circle':       _draw_circle,
    'star':         lambda draw, cx, cy, r, color, **kw: _draw_star(draw, cx, cy, r, color, rotation=kw.get('rotation', 0)),
    'heart':        _draw_heart,
    'diamond':      _draw_diamond,
    'sparkle4':     _draw_sparkle4,
    'paw':          _draw_paw,
    'bow':          _draw_bow,
    'banner_flag':  _draw_banner_flag,
    'bulb':         _draw_bulb,
    'ribbon':       _draw_ribbon,
    'arrow_heart':  _draw_arrow_heart,
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

    # ── PARTY BANNERS ─────────────────────────────────────────────────────────
    # Festive pennant flags strung across margins + confetti circles
    'party_banners': [
        # Top banner string of flags
        {'shape': 'banner_flag', 'x': 40,              'y': PHOTO_TOPS[0] - 30, 'size': 44, 'color': (255, 80,  120)},
        {'shape': 'banner_flag', 'x': FRAME_W // 4,    'y': PHOTO_TOPS[0] - 25, 'size': 40, 'color': (255, 195, 0)},
        {'shape': 'banner_flag', 'x': FRAME_W // 2,    'y': PHOTO_TOPS[0] - 30, 'size': 44, 'color': (60,  180, 255)},
        {'shape': 'banner_flag', 'x': FRAME_W * 3//4,  'y': PHOTO_TOPS[0] - 25, 'size': 40, 'color': (120, 220, 80)},
        {'shape': 'banner_flag', 'x': FRAME_W - 40,    'y': PHOTO_TOPS[0] - 30, 'size': 44, 'color': (200, 80,  255)},
        # Gutter 0 flags
        {'shape': 'banner_flag', 'x': 40,              'y': _gutter_y(0), 'size': 40, 'color': (60,  180, 255)},
        {'shape': 'banner_flag', 'x': FRAME_W // 3,    'y': _gutter_y(0), 'size': 44, 'color': (255, 80,  120)},
        {'shape': 'banner_flag', 'x': FRAME_W * 2//3,  'y': _gutter_y(0), 'size': 40, 'color': (255, 195, 0)},
        {'shape': 'banner_flag', 'x': FRAME_W - 40,    'y': _gutter_y(0), 'size': 44, 'color': (120, 220, 80)},
        # Gutter 1 flags
        {'shape': 'banner_flag', 'x': 40,              'y': _gutter_y(1), 'size': 40, 'color': (200, 80,  255)},
        {'shape': 'banner_flag', 'x': FRAME_W // 2,    'y': _gutter_y(1), 'size': 44, 'color': (255, 80,  120)},
        {'shape': 'banner_flag', 'x': FRAME_W - 40,    'y': _gutter_y(1), 'size': 40, 'color': (60,  180, 255)},
        # Gutter 2 flags
        {'shape': 'banner_flag', 'x': 40,              'y': _gutter_y(2), 'size': 42, 'color': (255, 195, 0)},
        {'shape': 'banner_flag', 'x': FRAME_W // 3,    'y': _gutter_y(2), 'size': 40, 'color': (120, 220, 80)},
        {'shape': 'banner_flag', 'x': FRAME_W * 2//3,  'y': _gutter_y(2), 'size': 42, 'color': (200, 80,  255)},
        {'shape': 'banner_flag', 'x': FRAME_W - 40,    'y': _gutter_y(2), 'size': 40, 'color': (255, 80,  120)},
        # Bottom strip
        {'shape': 'banner_flag', 'x': FRAME_W // 4,    'y': PHOTO_BOTTOMS[3] + 35, 'size': 44, 'color': (60,  180, 255)},
        {'shape': 'banner_flag', 'x': FRAME_W // 2,    'y': PHOTO_BOTTOMS[3] + 30, 'size': 40, 'color': (255, 80,  120)},
        {'shape': 'banner_flag', 'x': FRAME_W * 3//4,  'y': PHOTO_BOTTOMS[3] + 35, 'size': 44, 'color': (255, 195, 0)},
        # Confetti dots on photo corners
        {'shape': 'circle', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 22, 'color': (255, 80,  120)},
        {'shape': 'circle', 'x': _photo_corner(0, 'tr')[0], 'y': _photo_corner(0, 'tr')[1], 'size': 20, 'color': (255, 195, 0)},
        {'shape': 'circle', 'x': _photo_corner(1, 'bl')[0], 'y': _photo_corner(1, 'bl')[1], 'size': 22, 'color': (60,  180, 255)},
        {'shape': 'circle', 'x': _photo_corner(2, 'tr')[0], 'y': _photo_corner(2, 'tr')[1], 'size': 20, 'color': (120, 220, 80)},
        {'shape': 'circle', 'x': _photo_corner(3, 'br')[0], 'y': _photo_corner(3, 'br')[1], 'size': 22, 'color': (200, 80,  255)},
        {'shape': 'star',   'x': _photo_corner(1, 'tr')[0], 'y': _photo_corner(1, 'tr')[1], 'size': 30, 'color': (255, 195, 0), 'rotation': 20},
        {'shape': 'star',   'x': _photo_corner(3, 'tl')[0], 'y': _photo_corner(3, 'tl')[1], 'size': 28, 'color': (255, 80,  120), 'rotation': -15},
    ],

    # ── PARTY LIGHTS ──────────────────────────────────────────────────────────
    # Colorful glowing bulbs strung across gutters like fairy lights
    'party_lights': [
        # Top strip bulbs
        {'shape': 'bulb', 'x': 45,              'y': PHOTO_TOPS[0] - 20, 'size': 28, 'color': (255, 80,  80)},
        {'shape': 'bulb', 'x': FRAME_W // 5,    'y': PHOTO_TOPS[0] - 22, 'size': 26, 'color': (255, 200, 0)},
        {'shape': 'bulb', 'x': FRAME_W * 2//5,  'y': PHOTO_TOPS[0] - 20, 'size': 28, 'color': (80,  200, 120)},
        {'shape': 'bulb', 'x': FRAME_W * 3//5,  'y': PHOTO_TOPS[0] - 22, 'size': 26, 'color': (80,  140, 255)},
        {'shape': 'bulb', 'x': FRAME_W * 4//5,  'y': PHOTO_TOPS[0] - 20, 'size': 28, 'color': (200, 80,  255)},
        {'shape': 'bulb', 'x': FRAME_W - 45,    'y': PHOTO_TOPS[0] - 22, 'size': 26, 'color': (255, 140, 0)},
        # Gutter 0
        {'shape': 'bulb', 'x': 42,              'y': _gutter_y(0), 'size': 28, 'color': (80,  140, 255)},
        {'shape': 'bulb', 'x': FRAME_W // 4,    'y': _gutter_y(0), 'size': 26, 'color': (255, 80,  80)},
        {'shape': 'bulb', 'x': FRAME_W // 2,    'y': _gutter_y(0), 'size': 28, 'color': (80,  200, 120)},
        {'shape': 'bulb', 'x': FRAME_W * 3//4,  'y': _gutter_y(0), 'size': 26, 'color': (200, 80,  255)},
        {'shape': 'bulb', 'x': FRAME_W - 42,    'y': _gutter_y(0), 'size': 28, 'color': (255, 200, 0)},
        # Gutter 1
        {'shape': 'bulb', 'x': 42,              'y': _gutter_y(1), 'size': 28, 'color': (255, 140, 0)},
        {'shape': 'bulb', 'x': FRAME_W // 3,    'y': _gutter_y(1), 'size': 26, 'color': (80,  140, 255)},
        {'shape': 'bulb', 'x': FRAME_W * 2//3,  'y': _gutter_y(1), 'size': 28, 'color': (255, 80,  80)},
        {'shape': 'bulb', 'x': FRAME_W - 42,    'y': _gutter_y(1), 'size': 26, 'color': (80,  200, 120)},
        # Gutter 2
        {'shape': 'bulb', 'x': 42,              'y': _gutter_y(2), 'size': 28, 'color': (200, 80,  255)},
        {'shape': 'bulb', 'x': FRAME_W // 4,    'y': _gutter_y(2), 'size': 26, 'color': (255, 200, 0)},
        {'shape': 'bulb', 'x': FRAME_W // 2,    'y': _gutter_y(2), 'size': 28, 'color': (255, 80,  80)},
        {'shape': 'bulb', 'x': FRAME_W * 3//4,  'y': _gutter_y(2), 'size': 26, 'color': (80,  140, 255)},
        {'shape': 'bulb', 'x': FRAME_W - 42,    'y': _gutter_y(2), 'size': 28, 'color': (80,  200, 120)},
        # Bottom strip
        {'shape': 'bulb', 'x': 45,              'y': PHOTO_BOTTOMS[3] + 30, 'size': 28, 'color': (255, 200, 0)},
        {'shape': 'bulb', 'x': FRAME_W // 3,    'y': PHOTO_BOTTOMS[3] + 28, 'size': 26, 'color': (255, 80,  80)},
        {'shape': 'bulb', 'x': FRAME_W * 2//3,  'y': PHOTO_BOTTOMS[3] + 30, 'size': 28, 'color': (200, 80,  255)},
        {'shape': 'bulb', 'x': FRAME_W - 45,    'y': PHOTO_BOTTOMS[3] + 28, 'size': 26, 'color': (80,  140, 255)},
        # Sparkle accents on photo corners
        {'shape': 'sparkle4', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 28, 'color': (255, 220, 80)},
        {'shape': 'sparkle4', 'x': _photo_corner(1, 'br')[0], 'y': _photo_corner(1, 'br')[1], 'size': 28, 'color': (80,  200, 255)},
        {'shape': 'sparkle4', 'x': _photo_corner(2, 'tl')[0], 'y': _photo_corner(2, 'tl')[1], 'size': 26, 'color': (255, 120, 80)},
        {'shape': 'sparkle4', 'x': _photo_corner(3, 'tr')[0], 'y': _photo_corner(3, 'tr')[1], 'size': 28, 'color': (200, 80,  255)},
    ],

    # ── LOVE THEME ────────────────────────────────────────────────────────────
    # Romantic: large hearts, cupid arrows, ribbons, rose-toned sparkles
    'love_theme': [
        # Margin / gutter — big romantic hearts
        {'shape': 'heart',       'x': 45,              'y': PHOTO_TOPS[0] - 22, 'size': 52, 'color': (220, 40,  80)},
        {'shape': 'ribbon',      'x': FRAME_W // 2,    'y': PHOTO_TOPS[0] - 20, 'size': 44, 'color': (255, 120, 160)},
        {'shape': 'heart',       'x': FRAME_W - 45,    'y': PHOTO_TOPS[0] - 18, 'size': 48, 'color': (255, 80,  120)},
        # Gutter 0
        {'shape': 'heart',       'x': 42,              'y': _gutter_y(0), 'size': 46, 'color': (255, 80,  120)},
        {'shape': 'sparkle4',    'x': FRAME_W // 3,    'y': _gutter_y(0), 'size': 32, 'color': (255, 190, 210)},
        {'shape': 'heart',       'x': FRAME_W // 2,    'y': _gutter_y(0), 'size': 50, 'color': (220, 40,  80)},
        {'shape': 'sparkle4',    'x': FRAME_W * 2//3,  'y': _gutter_y(0), 'size': 30, 'color': (255, 190, 210)},
        {'shape': 'heart',       'x': FRAME_W - 42,    'y': _gutter_y(0), 'size': 44, 'color': (255, 80,  120)},
        # Gutter 1
        {'shape': 'ribbon',      'x': 42,              'y': _gutter_y(1), 'size': 42, 'color': (220, 40,  80)},
        {'shape': 'heart',       'x': FRAME_W // 2,    'y': _gutter_y(1), 'size': 52, 'color': (255, 80,  120)},
        {'shape': 'ribbon',      'x': FRAME_W - 42,    'y': _gutter_y(1), 'size': 42, 'color': (220, 40,  80)},
        # Gutter 2
        {'shape': 'heart',       'x': 42,              'y': _gutter_y(2), 'size': 48, 'color': (220, 40,  80)},
        {'shape': 'sparkle4',    'x': FRAME_W // 2,    'y': _gutter_y(2), 'size': 34, 'color': (255, 190, 210)},
        {'shape': 'heart',       'x': FRAME_W - 42,    'y': _gutter_y(2), 'size': 46, 'color': (255, 80,  120)},
        # Bottom strip
        {'shape': 'heart',       'x': 48,              'y': PHOTO_BOTTOMS[3] + 32, 'size': 52, 'color': (255, 80,  120)},
        {'shape': 'ribbon',      'x': FRAME_W // 2,    'y': PHOTO_BOTTOMS[3] + 30, 'size': 46, 'color': (220, 40,  80)},
        {'shape': 'heart',       'x': FRAME_W - 48,    'y': PHOTO_BOTTOMS[3] + 32, 'size': 50, 'color': (255, 80,  120)},
        # Cupid arrows on photos (corner accents)
        {'shape': 'arrow_heart', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 38, 'color': (255, 80,  120)},
        {'shape': 'heart',       'x': _photo_corner(0, 'br')[0], 'y': _photo_corner(0, 'br')[1], 'size': 36, 'color': (220, 40,  80)},
        {'shape': 'arrow_heart', 'x': _photo_corner(1, 'tr')[0], 'y': _photo_corner(1, 'tr')[1], 'size': 36, 'color': (255, 100, 140)},
        {'shape': 'heart',       'x': _photo_corner(2, 'bl')[0], 'y': _photo_corner(2, 'bl')[1], 'size': 38, 'color': (255, 80,  120)},
        {'shape': 'arrow_heart', 'x': _photo_corner(3, 'tr')[0], 'y': _photo_corner(3, 'tr')[1], 'size': 36, 'color': (220, 40,  80)},
        {'shape': 'ribbon',      'x': _photo_corner(3, 'bl')[0], 'y': _photo_corner(3, 'bl')[1], 'size': 34, 'color': (255, 140, 170)},
        # Rose-gold sparkle scatter
        {'shape': 'sparkle4', 'x': FRAME_W // 4,   'y': PHOTO_TOPS[0] - 15, 'size': 26, 'color': (255, 190, 210)},
        {'shape': 'sparkle4', 'x': FRAME_W * 3//4, 'y': PHOTO_TOPS[0] - 12, 'size': 24, 'color': (255, 160, 190)},
        {'shape': 'circle',   'x': FRAME_W // 3,   'y': _gutter_y(2) + 20, 'size': 14, 'color': (255, 200, 220)},
        {'shape': 'circle',   'x': FRAME_W * 2//3, 'y': _gutter_y(1) - 20, 'size': 12, 'color': (255, 200, 220)},
    ],
}

# This catalogue is intentionally shared by the kiosk and admin templates.
# Keep the display metadata beside the renderer so a new pack cannot appear in
# one editor without being available in the other.
STICKER_PACK_OPTIONS = [
    ('none', 'No Stickers'),
    ('girlypop', '💕 Girlypop'),
    ('cute_stars', '⭐ Cute Stars'),
    ('kawaii_paws', '🐾 Kawaii Paws'),
    ('party_confetti', '🎉 Party Confetti'),
    ('dreamy_sparkle', '✨ Dreamy Sparkle'),
    ('y2k_vibes', '💖 Y2K Vibes'),
    ('party_banners', '🎏 Party Banners'),
    ('party_lights', '💡 Party Lights'),
    ('love_theme', '❤️ Love Theme'),
    ('cosmic_dream', '🌌 Cosmic Dream'),
    ('tropical_pop', '🌺 Tropical Pop'),
    ('neon_arcade', '🕹️ Neon Arcade'),
    ('golden_hour', '🌅 Golden Hour'),
]

# Additional, high-contrast packs. The repeated gutter positions keep the
# photostrip polished while the photo-corner accents add personality.
STICKER_PACKS.update({
    'cosmic_dream': [
        *[{'shape': 'star', 'x': x, 'y': y, 'size': size, 'color': color, 'rotation': rot}
          for x, y, size, color, rot in [
              (45, PHOTO_TOPS[0] - 22, 42, (120, 90, 255), 15),
              (FRAME_W // 2, _gutter_y(0), 46, (255, 220, 90), -10),
              (FRAME_W - 45, _gutter_y(1), 42, (95, 190, 255), 20),
              (FRAME_W // 2, _gutter_y(2), 44, (190, 100, 255), 0),
              (45, PHOTO_BOTTOMS[3] + 30, 40, (255, 220, 90), 25),
          ]],
        *[{'shape': 'sparkle4', 'x': x, 'y': y, 'size': 30, 'color': color}
          for x, y, color in [
              (FRAME_W - 45, PHOTO_TOPS[0] - 20, (220, 180, 255)),
              (45, _gutter_y(0), (120, 220, 255)),
              (FRAME_W - 45, _gutter_y(2), (255, 190, 240)),
              (FRAME_W - 45, PHOTO_BOTTOMS[3] + 30, (180, 150, 255)),
          ]],
        {'shape': 'diamond', 'x': _photo_corner(0, 'tr')[0], 'y': _photo_corner(0, 'tr')[1], 'size': 32, 'color': (255, 230, 120)},
        {'shape': 'diamond', 'x': _photo_corner(1, 'bl')[0], 'y': _photo_corner(1, 'bl')[1], 'size': 30, 'color': (150, 210, 255)},
        {'shape': 'diamond', 'x': _photo_corner(2, 'tr')[0], 'y': _photo_corner(2, 'tr')[1], 'size': 32, 'color': (220, 160, 255)},
        {'shape': 'diamond', 'x': _photo_corner(3, 'bl')[0], 'y': _photo_corner(3, 'bl')[1], 'size': 30, 'color': (255, 230, 120)},
    ],
    'tropical_pop': [
        *[{'shape': 'circle', 'x': x, 'y': y, 'size': size, 'color': color}
          for x, y, size, color in [
              (45, PHOTO_TOPS[0] - 22, 28, (255, 100, 150)),
              (FRAME_W // 2, _gutter_y(0), 30, (255, 210, 60)),
              (FRAME_W - 45, _gutter_y(1), 28, (60, 210, 170)),
              (FRAME_W // 2, _gutter_y(2), 30, (255, 120, 70)),
              (45, PHOTO_BOTTOMS[3] + 30, 28, (80, 190, 255)),
          ]],
        *[{'shape': 'star', 'x': x, 'y': y, 'size': 38, 'color': color, 'rotation': 18}
          for x, y, color in [
              (FRAME_W - 45, PHOTO_TOPS[0] - 20, (255, 220, 70)),
              (45, _gutter_y(1), (255, 100, 150)),
              (FRAME_W - 45, _gutter_y(2), (60, 210, 170)),
              (FRAME_W - 45, PHOTO_BOTTOMS[3] + 30, (255, 130, 80)),
          ]],
        {'shape': 'heart', 'x': _photo_corner(0, 'tl')[0], 'y': _photo_corner(0, 'tl')[1], 'size': 36, 'color': (255, 100, 150)},
        {'shape': 'heart', 'x': _photo_corner(1, 'br')[0], 'y': _photo_corner(1, 'br')[1], 'size': 36, 'color': (255, 140, 80)},
        {'shape': 'heart', 'x': _photo_corner(2, 'tl')[0], 'y': _photo_corner(2, 'tl')[1], 'size': 36, 'color': (60, 210, 170)},
        {'shape': 'heart', 'x': _photo_corner(3, 'br')[0], 'y': _photo_corner(3, 'br')[1], 'size': 36, 'color': (255, 210, 60)},
    ],
    'neon_arcade': [
        *[{'shape': 'diamond', 'x': x, 'y': y, 'size': 42, 'color': color}
          for x, y, color in [
              (45, PHOTO_TOPS[0] - 20, (0, 245, 255)),
              (FRAME_W // 2, _gutter_y(0), (255, 50, 180)),
              (FRAME_W - 45, _gutter_y(1), (195, 80, 255)),
              (FRAME_W // 2, _gutter_y(2), (0, 245, 255)),
              (45, PHOTO_BOTTOMS[3] + 30, (255, 50, 180)),
          ]],
        *[{'shape': 'circle', 'x': x, 'y': y, 'size': 20, 'color': color}
          for x, y, color in [
              (FRAME_W - 45, PHOTO_TOPS[0] - 20, (255, 230, 60)),
              (45, _gutter_y(0), (195, 80, 255)),
              (FRAME_W - 45, _gutter_y(2), (255, 230, 60)),
              (FRAME_W - 45, PHOTO_BOTTOMS[3] + 30, (0, 245, 255)),
          ]],
        {'shape': 'star', 'x': _photo_corner(0, 'tr')[0], 'y': _photo_corner(0, 'tr')[1], 'size': 32, 'color': (255, 50, 180), 'rotation': 0},
        {'shape': 'star', 'x': _photo_corner(1, 'bl')[0], 'y': _photo_corner(1, 'bl')[1], 'size': 32, 'color': (0, 245, 255), 'rotation': 20},
        {'shape': 'star', 'x': _photo_corner(2, 'tr')[0], 'y': _photo_corner(2, 'tr')[1], 'size': 32, 'color': (255, 230, 60), 'rotation': -15},
        {'shape': 'star', 'x': _photo_corner(3, 'bl')[0], 'y': _photo_corner(3, 'bl')[1], 'size': 32, 'color': (195, 80, 255), 'rotation': 10},
    ],
    'golden_hour': [
        *[{'shape': 'circle', 'x': x, 'y': y, 'size': size, 'color': color}
          for x, y, size, color in [
              (45, PHOTO_TOPS[0] - 20, 32, (255, 184, 70)),
              (FRAME_W // 2, _gutter_y(0), 30, (255, 215, 120)),
              (FRAME_W - 45, _gutter_y(1), 32, (242, 125, 70)),
              (FRAME_W // 2, _gutter_y(2), 30, (255, 184, 70)),
              (45, PHOTO_BOTTOMS[3] + 30, 32, (242, 125, 70)),
          ]],
        *[{'shape': 'sparkle4', 'x': x, 'y': y, 'size': 34, 'color': color}
          for x, y, color in [
              (FRAME_W - 45, PHOTO_TOPS[0] - 20, (255, 230, 170)),
              (45, _gutter_y(1), (255, 215, 120)),
              (FRAME_W - 45, _gutter_y(2), (255, 185, 100)),
              (FRAME_W - 45, PHOTO_BOTTOMS[3] + 30, (255, 230, 170)),
          ]],
        {'shape': 'star', 'x': _photo_corner(0, 'br')[0], 'y': _photo_corner(0, 'br')[1], 'size': 34, 'color': (255, 215, 120), 'rotation': 10},
        {'shape': 'star', 'x': _photo_corner(1, 'tl')[0], 'y': _photo_corner(1, 'tl')[1], 'size': 34, 'color': (242, 125, 70), 'rotation': -15},
        {'shape': 'star', 'x': _photo_corner(2, 'br')[0], 'y': _photo_corner(2, 'br')[1], 'size': 34, 'color': (255, 184, 70), 'rotation': 20},
        {'shape': 'star', 'x': _photo_corner(3, 'tl')[0], 'y': _photo_corner(3, 'tl')[1], 'size': 34, 'color': (255, 215, 120), 'rotation': 0},
    ],
})


def _draw_scattered_accents(draw, pack_name, stickers):
    """Scatter small, deterministic accents across side rails and photo corners."""
    rng = random.Random(f'photobooth-stickers:{pack_name}')
    palette = [s['color'] for s in stickers if s.get('color')]
    if not palette:
        return

    # Use the pack's own visual language when possible, while ensuring every
    # pack receives attractive, readable accent shapes.
    supported = {'circle', 'star', 'heart', 'diamond', 'sparkle4', 'paw', 'bow', 'ribbon'}
    shapes = list(dict.fromkeys(s['shape'] for s in stickers if s.get('shape') in supported))
    if not shapes:
        shapes = ['star', 'sparkle4', 'heart']

    def accent(x, y, size):
        shape = rng.choice(shapes)
        drawer = SHAPE_DRAWERS[shape]
        kwargs = {'rotation': rng.randrange(0, 360)} if shape == 'star' else {}
        drawer(draw, x, y, size, rng.choice(palette), **kwargs)

    for slot, top in enumerate(PHOTO_TOPS):
        bottom = PHOTO_BOTTOMS[slot]

        # Two alternating side-rail accents per photo. These use the white
        # border/margin rather than the narrow gutters between images.
        left_x = rng.choice((24, 52))
        right_x = FRAME_W - rng.choice((24, 52))
        accent(left_x, rng.randint(top + 70, bottom - 70), rng.randint(16, 25))
        accent(right_x, rng.randint(top + 70, bottom - 70), rng.randint(16, 25))

        # One subtle in-photo corner accent. Keeping it near an edge preserves
        # the subject while making the design feel distributed, not striped.
        inset_x = LEFT_MARGIN + rng.choice((70, PHOTO_W - 70))
        inset_y = top + rng.choice((70, PHOTO_H - 70))
        accent(inset_x, inset_y, rng.randint(16, 23))


def draw_sticker_pack(collage_img, pack_name):
    """Draw a named pack plus balanced side and in-photo accents in-place."""
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
    _draw_scattered_accents(draw, pack_name, stickers)
