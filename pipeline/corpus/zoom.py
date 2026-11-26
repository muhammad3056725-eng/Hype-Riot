# HYPE RIOT starter corpus — Round 2 Pixel Zoom-Out sprites (16x16).
# Bitmaps are built programmatically so dimensions are guaranteed.
# Chars map to the neon palette in the web renderer:
#   '.' background   'K' black   'W' white   'R' red    'G' green
#   'Y' yellow/gold  'B' blue    'P' pink    'U' purple 'C' cream
#   'O' orange       'T' teal    'N' brown   'S' silver/grey

def _grid():
    return [["."] * 16 for _ in range(16)]

def _rect(g, r0, r1, c0, c1, ch):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            g[r][c] = ch

def _disc(g, cr, cc, rad, ch):
    for r in range(16):
        for c in range(16):
            if (r - cr) ** 2 + (c - cc) ** 2 <= rad * rad:
                g[r][c] = ch

def _rows(g):
    return ["".join(r) for r in g]

def creeper():
    g = _grid()
    _rect(g, 2, 13, 2, 13, "G")
    _rect(g, 5, 6, 4, 5, "K"); _rect(g, 5, 6, 10, 11, "K")      # eyes
    _rect(g, 7, 8, 7, 8, "K")                                     # nose
    _rect(g, 9, 11, 5, 6, "K"); _rect(g, 9, 11, 9, 10, "K")       # mouth sides
    _rect(g, 9, 9, 7, 8, "K")
    return _rows(g)

def pokeball():
    g = _grid()
    _disc(g, 7.5, 7.5, 6.5, "W")
    for r in range(16):
        for c in range(16):
            if g[r][c] == "W" and r < 7:
                g[r][c] = "R"
    _rect(g, 7, 8, 1, 14, "K")
    for r in range(16):
        for c in range(16):
            if g[r][c] == "K" and (r - 7.5) ** 2 + (c - 7.5) ** 2 > 42:
                g[r][c] = "."
    _disc(g, 7.5, 7.5, 2.2, "K")
    _disc(g, 7.5, 7.5, 1.2, "W")
    return _rows(g)

def mushroom():
    g = _grid()
    _rect(g, 2, 7, 1, 14, "R")
    _rect(g, 2, 2, 3, 12, "R")
    _disc(g, 4, 4, 1.6, "W"); _disc(g, 4, 11, 1.6, "W"); _disc(g, 3, 7.5, 1.4, "W")
    _rect(g, 8, 12, 4, 11, "C")
    _rect(g, 9, 10, 6, 6, "K"); _rect(g, 9, 10, 9, 9, "K")       # eyes
    return _rows(g)

def ghost():
    g = _grid()
    _disc(g, 6, 7.5, 5.5, "R")
    _rect(g, 6, 12, 2, 13, "R")
    for i, c in enumerate(range(2, 14, 3)):                        # wavy skirt
        _rect(g, 13, 13, c, c + 1, "R")
    _rect(g, 5, 7, 4, 5, "W"); _rect(g, 5, 7, 10, 11, "W")         # eyes
    _rect(g, 6, 7, 5, 5, "B"); _rect(g, 6, 7, 11, 11, "B")         # pupils
    return _rows(g)

def invader():
    pattern = [
        "..X.....X..",
        "...X...X...",
        "..XXXXXXX..",
        ".XX.XXX.XX.",
        "XXXXXXXXXXX",
        "X.XXXXXXX.X",
        "X.X.....X.X",
        "...XX.XX...",
    ]
    g = _grid()
    for i, row in enumerate(pattern):
        for j, ch in enumerate(row):
            if ch == "X":
                g[4 + i][2 + j] = "U"
    return _rows(g)

def japan():
    g = _grid()
    _rect(g, 1, 14, 1, 14, "W")
    _disc(g, 7.5, 7.5, 3.2, "R")
    return _rows(g)

def france():
    g = _grid()
    _rect(g, 1, 14, 1, 5, "B"); _rect(g, 1, 14, 6, 10, "W"); _rect(g, 1, 14, 11, 14, "R")
    return _rows(g)

def germany():
    g = _grid()
    _rect(g, 1, 5, 1, 14, "K"); _rect(g, 6, 10, 1, 14, "R"); _rect(g, 11, 14, 1, 14, "Y")
    return _rows(g)

def heart():
    g = _grid()
    _disc(g, 5, 4.5, 3.0, "R"); _disc(g, 5, 11, 3.0, "R")
    for r in range(6, 14):
        w = 14 - r
        _rect(g, r, r, 8 - (w // 2), 7 + (w // 2), "R")
    return _rows(g)

def bolt():
    g = _grid()
    pts = [(1, 9), (2, 9), (3, 8), (4, 8), (5, 7), (6, 7), (7, 6),
           (6, 9), (5, 10), (4, 11), (3, 13), (2, 14)]
    for r, c in pts:
        g[r][c] = "Y"; g[r][c - 1] = "Y"
    _rect(g, 7, 8, 5, 8, "Y")
    return _rows(g)

def smiley():
    g = _grid()
    _disc(g, 7.5, 7.5, 6.5, "Y")
    _rect(g, 5, 6, 5, 5, "K"); _rect(g, 5, 6, 10, 10, "K")
    for c in range(4, 12):
        r = 10 + (1 if c in (4, 11) else 0) + (1 if c in (5, 10) else 0)
        g[r][c] = "K"
    g[11][6] = "K"; g[11][9] = "K"; g[12][7] = "K"; g[12][8] = "K"
    return _rows(g)

def triforce():
    g = _grid()
    for i in range(4):
        _rect(g, 2 + i, 2 + i, 7 - i, 8 + i, "Y")
    for i in range(4):
        _rect(g, 6 + i, 6 + i, 3 - i if 3 - i >= 0 else 0, 4 + i, "Y")
        _rect(g, 6 + i, 6 + i, 11 - i, 12 + i, "Y")
    return _rows(g)

# (answer, category, [3 distractors], bitmap)
ZOOM_ITEMS = [
    ("Creeper (Minecraft)", "Gaming", ["Slime (Minecraft)", "Zombie (Minecraft)", "Enderman"], creeper()),
    ("Poké Ball", "Gaming", ["Volleyball", "Beach Ball", "Yin Yang"], pokeball()),
    ("Super Mushroom", "Gaming", ["Toadstool House", "Cupcake", "Umbrella"], mushroom()),
    ("Blinky (Pac-Man Ghost)", "Gaming", ["Jellyfish", "Octopus", "Pac-Man"], ghost()),
    ("Space Invader", "Gaming", ["Crab", "Spider", "Robot"], invader()),
    ("Flag of Japan", "Places", ["Flag of Bangladesh", "Red Circle Logo", "Sun"], japan()),
    ("Flag of France", "Places", ["Flag of Italy", "Flag of Netherlands", "Flag of Russia"], france()),
    ("Flag of Germany", "Places", ["Flag of Belgium", "Flag of Spain", "Flag of Hungary"], germany()),
    ("Heart", "Everyday", ["Diamond", "Apple", "Strawberry"], heart()),
    ("Lightning Bolt", "Everyday", ["Zigzag", "Arrow", "Crack"], bolt()),
    ("Smiley Face", "Everyday", ["Sun", "Coin", "Moon"], smiley()),
    ("Triforce", "Gaming", ["Pyramid", "Triangle", "Pizza Slice"], triforce()),
]
