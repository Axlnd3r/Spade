"""Static SVG line charts with no dependencies (S4 Task 2).

Colors follow the dataviz reference palette. Categorical slots are taken in a
fixed order and stepped separately for light and dark. Text uses text tokens,
never the series color. Each series is direct-labeled at its last point and
listed in the legend. The markers carry native `<title>` tooltips. The table
view lives in docs/sim/summary.md.
"""
import math
from xml.sax.saxutils import escape

LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]

W, H = 760, 400
LEFT, RIGHT, TOP, BOTTOM = 84, 160, 86, 44


def nice_ticks(lo: float, hi: float, count: int = 5) -> list[float]:
    if hi <= lo:
        hi = lo + 1
    raw = (hi - lo) / count
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    start = math.floor(lo / step) * step
    ticks = []
    t = start
    while t <= hi + step * 1e-9:
        ticks.append(round(t, 10))
        t += step
    if ticks[-1] < hi:
        ticks.append(ticks[-1] + step)
    return ticks


def fmt(v: float) -> str:
    a = abs(v)
    if a >= 1e6:
        return f"{v / 1e6:,.3f}".rstrip("0").rstrip(".") + " jt"
    if a >= 1e3:
        return f"{v / 1e3:,.1f}".rstrip("0").rstrip(".") + " rb"
    return f"{v:,.0f}"


def style() -> str:
    def tokens(colors, surface, primary, secondary, muted, grid):
        series = "".join(f"--s{i + 1}:{c};" for i, c in enumerate(colors))
        return (f"--surface:{surface};--text-primary:{primary};--text-secondary:{secondary};"
                f"--text-muted:{muted};--grid:{grid};{series}")

    light = tokens(LIGHT, "#fcfcfb", "#0b0b0b", "#52514e", "#6f6e69", "#e6e5e0")
    dark = tokens(DARK, "#1a1a19", "#f0efec", "#c3c2b7", "#9a9990", "#33332f")
    return (
        f"svg{{{light}}}"
        f"@media (prefers-color-scheme: dark){{svg{{{dark}}}}}"
        "text{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;}"
        ".bg{fill:var(--surface)}.title{fill:var(--text-primary);font-size:16px;font-weight:600}"
        ".sub{fill:var(--text-secondary);font-size:12px}.tick{fill:var(--text-muted);font-size:11px}"
        ".grid{stroke:var(--grid);stroke-width:1}.axis{stroke:var(--text-muted);stroke-width:1}"
        ".label{fill:var(--text-primary);font-size:12px}.line{fill:none;stroke-width:2;"
        "stroke-linejoin:round;stroke-linecap:round}"
    )


def line_chart(series: dict[str, list[float]], title: str, y_label: str, path: str,
               x_label: str = "hari") -> None:
    """One line per series over x = 1..n. Up to 8 series, in fixed slot order."""
    assert 1 <= len(series) <= 8, "a 9th series folds into Other, never a new hue"
    n = max(len(v) for v in series.values())
    values = [x for v in series.values() for x in v]
    ticks = nice_ticks(min(values), max(values))
    y_lo, y_hi = ticks[0], ticks[-1]
    pw, ph = W - LEFT - RIGHT, H - TOP - BOTTOM

    def sx(i: int) -> float:
        return LEFT + (i / max(n - 1, 1)) * pw

    def sy(v: float) -> float:
        return TOP + ph - (v - y_lo) / (y_hi - y_lo) * ph

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" '
           f'aria-label="{escape(title)}"><style>{style()}</style>',
           f'<rect class="bg" width="{W}" height="{H}" rx="8"/>',
           f'<text class="title" x="{LEFT}" y="26">{escape(title)}</text>',
           f'<text class="sub" x="{LEFT}" y="44">{escape(y_label)}</text>']
    for t in ticks:
        y = sy(t)
        out.append(f'<line class="grid" x1="{LEFT}" x2="{LEFT + pw}" y1="{y:.1f}" y2="{y:.1f}"/>')
        out.append(f'<text class="tick" x="{LEFT - 8}" y="{y + 4:.1f}" text-anchor="end">{fmt(t)}</text>')
    out.append(f'<line class="axis" x1="{LEFT}" x2="{LEFT + pw}" y1="{TOP + ph}" y2="{TOP + ph}"/>')
    for d in sorted({0, n - 1, *range(9, n, 10)}):
        out.append(f'<text class="tick" x="{sx(d):.1f}" y="{TOP + ph + 18}" text-anchor="middle">{d + 1}</text>')
    out.append(f'<text class="tick" x="{LEFT + pw}" y="{TOP + ph + 34}" text-anchor="end">{escape(x_label)}</text>')

    # Legend in its own row above the plot, below the subtitle.
    lx = LEFT
    for i, name in enumerate(series):
        out.append(f'<rect x="{lx}" y="56" width="12" height="12" rx="3" fill="var(--s{i + 1})"/>')
        out.append(f'<text class="label" x="{lx + 17}" y="66">{escape(name)}</text>')
        lx += 17 + 8 * len(name) + 18

    ends = []
    for i, (name, vals) in enumerate(series.items()):
        pts = " ".join(f"{sx(j):.1f},{sy(v):.1f}" for j, v in enumerate(vals))
        out.append(f'<polyline class="line" stroke="var(--s{i + 1})" points="{pts}"/>')
        for j in sorted({0, len(vals) - 1, *range(9, len(vals), 10)}):
            out.append(f'<circle cx="{sx(j):.1f}" cy="{sy(vals[j]):.1f}" r="4" fill="var(--s{i + 1})" '
                       f'stroke="var(--surface)" stroke-width="2"><title>{escape(name)}, {x_label} {j + 1}: '
                       f'{vals[j]:,.0f}</title></circle>')
        ends.append([sy(vals[-1]), name])

    # Direct labels at the right end, nudged apart so they never overlap.
    ends.sort()
    for k in range(1, len(ends)):
        ends[k][0] = max(ends[k][0], ends[k - 1][0] + 14)
    for y, name in ends:
        out.append(f'<text class="label" x="{LEFT + pw + 10}" y="{y + 4:.1f}">{escape(name)}</text>')
    out.append("</svg>")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out) + "\n")
