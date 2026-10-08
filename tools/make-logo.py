"""[Define404] 가게냥 로고: 부킹냥(booking-meo)과 같은 고양이 머리 도형에 가게 차양을 얹는다.
사용: python3 tools/make-logo.py   → web/logo.svg, web/favicon.svg
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W = H = 120
BRAND = "#1E6B52"
WHITE = "#FFFFFF"
INNER = "#FFB6A3"
DARK = "#1D2421"
WHISKER = "#CFDAD4"
AWNING = "#F2C14E"

# 고양이 머리 도형 (booking-meo tools/make-mascot.py 와 같은 값)
EAR_L = [(27, 56), (33, 20), (55, 42)]
EAR_R = [(93, 56), (87, 20), (65, 42)]
IN_L = [(34, 48), (36, 30), (48, 42)]
IN_R = [(86, 48), (84, 30), (72, 42)]
HEAD = (60, 68, 80, 66)
EYES = [(46, 67, 9, 11), (74, 67, 9, 11)]
NOSE = [(56, 75), (64, 75), (60, 80)]
MOUTH = [[(60, 80), (55, 84)], [(60, 80), (65, 84)]]
WHISKERS = [[(24, 74), (40, 76)], [(25, 82), (40, 80)], [(96, 74), (80, 76)], [(95, 82), (80, 80)]]


def pts(p):
    return " ".join(f"{x},{y}" for x, y in p)


def awning():
    # 두 귀 사이에 얹은 작은 가게 차양: 줄무늬 지붕 + 물결 끝단
    x0, x1, top, bot = 44, 76, 15, 27
    n = 4
    w = (x1 - x0) / n
    parts = [f'<polygon points="{pts([(x0 + 4, top), (x1 - 4, top), (x1, bot), (x0, bot)])}" fill="{WHITE}"/>']
    for i in range(0, n, 2):
        a, b = x0 + i * w, x0 + (i + 1) * w
        ta, tb = x0 + 4 + i * (w - 2), x0 + 4 + (i + 1) * (w - 2)
        parts.append(f'<polygon points="{pts([(ta, top), (tb, top), (b, bot), (a, bot)])}" fill="{AWNING}"/>')
    r = w / 2
    for i in range(n):
        cx = x0 + r + i * w
        c = AWNING if i % 2 == 0 else WHITE
        parts.append(f'<path d="M{cx - r},{bot} a{r},{r * 0.8} 0 0 0 {2 * r},0 Z" fill="{c}"/>')
    return "".join(parts)


def cat_svg(detail=True):
    parts = [
        f'<polygon points="{pts(EAR_L)}" fill="{WHITE}"/>',
        f'<polygon points="{pts(IN_L)}" fill="{INNER}"/>',
        f'<polygon points="{pts(EAR_R)}" fill="{WHITE}"/>',
        f'<polygon points="{pts(IN_R)}" fill="{INNER}"/>',
        f'<ellipse cx="{HEAD[0]}" cy="{HEAD[1]}" rx="{HEAD[2] / 2}" ry="{HEAD[3] / 2}" fill="{WHITE}"/>',
        awning(),
    ]
    parts += [f'<ellipse cx="{x}" cy="{y}" rx="{w / 2}" ry="{h / 2}" fill="{DARK}"/>' for x, y, w, h in EYES]
    parts.append(f'<polygon points="{pts(NOSE)}" fill="{INNER}"/>')
    if detail:
        parts += [f'<polyline points="{pts(m)}" fill="none" stroke="{DARK}" stroke-width="2" stroke-linecap="round"/>' for m in MOUTH]
        parts += [f'<polyline points="{pts(w)}" fill="none" stroke="{WHISKER}" stroke-width="2" stroke-linecap="round"/>' for w in WHISKERS]
    return "".join(parts)


def svg(detail):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
            f'<circle cx="60" cy="60" r="60" fill="{BRAND}"/>{cat_svg(detail)}</svg>')


(ROOT / "web" / "logo.svg").write_text(svg(True))
(ROOT / "web" / "favicon.svg").write_text(svg(False))
print("ok")
