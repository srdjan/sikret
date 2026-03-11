#!/usr/bin/env python3
"""Generate a YouTube-style demo video for the sikret project.

Usage:
    python3 generate_demo.py
    # or via venv:
    /tmp/sikret-video-env/bin/python3 generate_demo.py

Produces: demo.mp4 (1920x1080, ~35s, H.264)
"""

import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

# --- Video settings ---
WIDTH, HEIGHT, FPS = 1920, 1080, 30

# --- Colors (RGB) ---
BG = (13, 17, 23)
TERM_BG = (22, 27, 34)
TERM_BAR = (33, 38, 45)
WHITE = (240, 246, 252)
GREEN = (126, 231, 135)
BLUE = (88, 166, 255)
DIM = (139, 148, 158)
YELLOW = (227, 179, 65)
CYAN = (121, 192, 255)
RED_DOT = (255, 95, 87)
YLW_DOT = (254, 188, 46)
GRN_DOT = (40, 200, 64)

# --- Terminal geometry ---
TERM_X, TERM_Y = 160, 140
TERM_W, TERM_H = 1600, 800
BAR_H = 44
PAD = 24
CONTENT_X = TERM_X + PAD
CONTENT_Y = TERM_Y + BAR_H + PAD

# --- Font config ---
FONT_PATH = "/System/Library/Fonts/Menlo.ttc"
BODY_SZ = 26
TITLE_SZ = 80
SUB_SZ = 34
SM_SZ = 22
HEAD_SZ = 44

# --- Typing ---
CPS = 18  # chars per second


class Fonts:
    def __init__(self):
        self.body = ImageFont.truetype(FONT_PATH, BODY_SZ)
        self.title = ImageFont.truetype(FONT_PATH, TITLE_SZ)
        self.sub = ImageFont.truetype(FONT_PATH, SUB_SZ)
        self.sm = ImageFont.truetype(FONT_PATH, SM_SZ)
        self.head = ImageFont.truetype(FONT_PATH, HEAD_SZ)
        self.cw = self.body.getlength("X")  # monospace char width
        self.lh = BODY_SZ + 16  # line height


def new_frame():
    return Image.new("RGB", (WIDTH, HEIGHT), BG)


def center_x(font, text):
    return (WIDTH - font.getlength(text)) / 2


def line_y(idx, fonts):
    return CONTENT_Y + idx * fonts.lh


def n_chars(text, frame, start=0, cps=CPS):
    """How many chars of text are visible at frame."""
    elapsed = max(0, frame - start)
    return min(len(text), int(elapsed * cps / FPS))


def done_frame(text, start=0, cps=CPS):
    """Frame when all chars are typed."""
    return start + int(len(text) * FPS / cps) + 1


def draw_terminal(d, fonts):
    """Draw the terminal window chrome."""
    # Body
    d.rounded_rectangle(
        (TERM_X, TERM_Y, TERM_X + TERM_W, TERM_Y + TERM_H),
        radius=12, fill=TERM_BG,
    )
    # Title bar top (rounded)
    d.rounded_rectangle(
        (TERM_X, TERM_Y, TERM_X + TERM_W, TERM_Y + BAR_H + 12),
        radius=12, fill=TERM_BAR,
    )
    # Title bar bottom (square off)
    d.rectangle(
        (TERM_X, TERM_Y + BAR_H - 6, TERM_X + TERM_W, TERM_Y + BAR_H),
        fill=TERM_BAR,
    )
    # Traffic lights
    for i, c in enumerate([RED_DOT, YLW_DOT, GRN_DOT]):
        cx, cy, r = TERM_X + 24 + i * 24, TERM_Y + BAR_H // 2, 7
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c)
    # Title text centered in bar
    t = "sikret"
    d.text((TERM_X + TERM_W / 2 - fonts.sm.getlength(t) / 2, TERM_Y + 11),
           t, fill=DIM, font=fonts.sm)


def term_text(d, idx, text, color, fonts):
    d.text((CONTENT_X, line_y(idx, fonts)), text, fill=color, font=fonts.body)


def cursor(d, x, y, fonts, frame, typing=True):
    """Block cursor - solid when typing, blinking when idle."""
    show = typing or (frame // (FPS // 3)) % 2 == 0
    if show:
        d.rectangle((x, y + 2, x + fonts.cw - 2, y + BODY_SZ + 2), fill=GREEN)


def fade(img, frame, total, frames=10):
    """Fade in at start, fade out at end of scene."""
    if frame < frames:
        f = frame / frames
    elif frame >= total - frames:
        f = (total - frame) / frames
    else:
        return img
    return ImageEnhance.Brightness(img).enhance(max(0, min(1, f)))


# ===== SCENES =====

def scene_title(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)

    d.text((center_x(fonts.title, "sikret"), 320), "sikret",
           fill=GREEN, font=fonts.title)

    s1 = "Resolve secrets from URI-based references"
    d.text((center_x(fonts.sub, s1), 450), s1, fill=WHITE, font=fonts.sub)

    s2 = "macOS Keychain   ·   1Password   ·   env vars   ·   files"
    d.text((center_x(fonts.sm, s2), 520), s2, fill=DIM, font=fonts.sm)

    s3 = "CLI + Library  ·  Deno / TypeScript  ·  zero dependencies"
    d.text((center_x(fonts.sm, s3), 560), s3, fill=DIM, font=fonts.sm)

    return fade(img, fr, tot)


def scene_problem(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)
    draw_terminal(d, fonts)

    lines = [
        ("# The problem: secrets everywhere", DIM),
        ("", None),
        ('export OPENAI_KEY="sk-live-R4nD0mStr1ng"', YELLOW),
        ('echo "$DB_PASS" >> deploy.sh', YELLOW),
        ("", None),
        ("# They leak into git, logs, .env files...", DIM),
        ("", None),
        ("# The fix: reference secrets by URI", GREEN),
        ('KEY="$(sikret resolve keychain:openai)"', CYAN),
    ]

    for i, (text, color) in enumerate(lines):
        if not text:
            continue
        show_at = i * FPS // 3
        n = n_chars(text, fr, show_at, cps=60)
        if n > 0:
            term_text(d, i, text[:n], color, fonts)

    return fade(img, fr, tot)


def scene_resolve(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)
    draw_terminal(d, fonts)

    P = "$ "

    # --- Command 1: sikret resolve env:HOME ---
    cmd1 = "sikret resolve env:HOME"
    term_text(d, 0, P, GREEN, fonts)

    n1 = n_chars(cmd1, fr, 0)
    if n1 > 0:
        d.text((CONTENT_X + fonts.cw * len(P), line_y(0, fonts)),
               cmd1[:n1], fill=WHITE, font=fonts.body)
    d1 = done_frame(cmd1, 0)

    if fr < d1:
        cursor(d, CONTENT_X + fonts.cw * (len(P) + n1),
               line_y(0, fonts), fonts, fr, typing=True)
    elif fr < d1 + FPS // 3:
        cursor(d, CONTENT_X + fonts.cw * (len(P) + len(cmd1)),
               line_y(0, fonts), fonts, fr, typing=False)

    # Output 1
    o1 = d1 + FPS // 3
    if fr >= o1:
        term_text(d, 1, "/Users/demo", BLUE, fonts)

    # --- Command 2: sikret resolve --json env:HOME ---
    c2s = o1 + int(0.8 * FPS)
    cmd2 = "sikret resolve --json env:HOME"

    if fr >= c2s:
        term_text(d, 3, P, GREEN, fonts)
        n2 = n_chars(cmd2, fr, c2s)
        if n2 > 0:
            d.text((CONTENT_X + fonts.cw * len(P), line_y(3, fonts)),
                   cmd2[:n2], fill=WHITE, font=fonts.body)
        d2 = done_frame(cmd2, c2s)

        if fr < d2:
            cursor(d, CONTENT_X + fonts.cw * (len(P) + n2),
                   line_y(3, fonts), fonts, fr, typing=True)

        o2 = d2 + FPS // 3
        if fr >= o2:
            term_text(d, 4, '{"ok": true, "value": "/Users/demo"}', CYAN, fonts)

    return fade(img, fr, tot)


def scene_exec(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)
    draw_terminal(d, fonts)

    P = "$ "

    # --- cat secrets.json ---
    cmd1 = "cat secrets.json"
    term_text(d, 0, P, GREEN, fonts)
    n1 = n_chars(cmd1, fr, 0)
    if n1 > 0:
        d.text((CONTENT_X + fonts.cw * len(P), line_y(0, fonts)),
               cmd1[:n1], fill=WHITE, font=fonts.body)
    d1 = done_frame(cmd1, 0)

    if fr < d1:
        cursor(d, CONTENT_X + fonts.cw * (len(P) + n1),
               line_y(0, fonts), fonts, fr, typing=True)

    # JSON output
    js = d1 + FPS // 4
    json_lines = [
        ("{", DIM),
        ('  "OPENAI_API_KEY": "keychain:openai-api-key",', WHITE),
        ('  "DB_PASSWORD":    "op://Private/db/password",', WHITE),
        ('  "DEBUG":          "env:DEBUG"', WHITE),
        ("}", DIM),
    ]
    if fr >= js:
        for j, (text, color) in enumerate(json_lines):
            term_text(d, 1 + j, text, color, fonts)

    # --- sikret exec ---
    c2s = js + int(1.2 * FPS)
    cmd2 = "sikret exec secrets.json -- ./my-app"

    if fr >= c2s:
        term_text(d, 7, P, GREEN, fonts)
        n2 = n_chars(cmd2, fr, c2s)
        if n2 > 0:
            d.text((CONTENT_X + fonts.cw * len(P), line_y(7, fonts)),
                   cmd2[:n2], fill=WHITE, font=fonts.body)
        d2 = done_frame(cmd2, c2s)

        if fr < d2:
            cursor(d, CONTENT_X + fonts.cw * (len(P) + n2),
                   line_y(7, fonts), fonts, fr, typing=True)

        o2 = d2 + FPS // 3
        if fr >= o2:
            term_text(d, 8, "Starting my-app with resolved secrets...", CYAN, fonts)
        if fr >= o2 + FPS // 3:
            term_text(d, 9, "  OPENAI_API_KEY = sk-live-****", DIM, fonts)
            term_text(d, 10, "  DB_PASSWORD    = ****", DIM, fonts)
            term_text(d, 11, "  DEBUG          = true", DIM, fonts)

    return fade(img, fr, tot)


def scene_inline(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)
    draw_terminal(d, fonts)

    P = "$ "
    term_text(d, 0, "# Inline refs - no JSON file needed", DIM, fonts)

    parts = [
        "sikret exec \\",
        "  --env API_KEY=keychain:openai-key \\",
        "  --env DB_PASS=op://Prod/db/pass \\",
        "  -- ./deploy.sh",
    ]

    start = FPS // 2
    offset = start
    for i, part in enumerate(parts):
        if i == 0:
            term_text(d, 2, P, GREEN, fonts)
        n = n_chars(part, fr, offset)
        if n > 0:
            x = CONTENT_X + (fonts.cw * len(P) if i == 0 else 0)
            d.text((x, line_y(2 + i, fonts)), part[:n], fill=WHITE, font=fonts.body)
        offset += int(len(part) * FPS / CPS)

    all_done = offset + FPS // 2
    if fr >= all_done:
        term_text(d, 7, "Deploying with resolved credentials...", CYAN, fonts)
    if fr >= all_done + FPS:
        term_text(d, 9, "# Secrets resolved at runtime", DIM, fonts)
        term_text(d, 10, "# Never written to disk or shell history", DIM, fonts)

    return fade(img, fr, tot)


def scene_schemes(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)

    h = "Supported URI Schemes"
    d.text((center_x(fonts.head, h), 150), h, fill=WHITE, font=fonts.head)
    d.rectangle((WIDTH // 2 - 300, 220, WIDTH // 2 + 300, 221), fill=DIM)

    schemes = [
        ("keychain:", "service-name", "macOS Keychain via security CLI"),
        ("op://", "vault/item/field", "1Password CLI via op read"),
        ("env:", "VAR_NAME", "Environment variable lookup"),
        ("file:", "/path/to/secret", "File contents (trailing newline trimmed)"),
    ]

    for i, (scheme, example, desc) in enumerate(schemes):
        show_at = FPS // 2 + i * FPS // 2
        if fr < show_at:
            continue
        y = 280 + i * 120
        d.text((240, y), scheme, fill=GREEN, font=fonts.sub)
        ex = 240 + fonts.sub.getlength(scheme)
        d.text((ex, y), example, fill=WHITE, font=fonts.sub)
        d.text((240, y + 44), desc, fill=DIM, font=fonts.sm)

    if fr >= int(2.5 * FPS):
        note = "Pluggable backend registry - bring your own"
        d.text((center_x(fonts.sm, note), 800), note, fill=BLUE, font=fonts.sm)

    return fade(img, fr, tot)


def scene_closing(fr, tot, fonts):
    img = new_frame()
    d = ImageDraw.Draw(img)

    d.text((center_x(fonts.title, "sikret"), 300), "sikret",
           fill=GREEN, font=fonts.title)

    i1 = "deno task compile"
    d.text((center_x(fonts.sub, i1), 440), i1, fill=WHITE, font=fonts.sub)

    t1 = "Zero-dependency secret resolution for the command line"
    d.text((center_x(fonts.sm, t1), 510), t1, fill=DIM, font=fonts.sm)

    t2 = "Library: import from jsr:@sikret/sikret"
    d.text((center_x(fonts.sm, t2), 560), t2, fill=CYAN, font=fonts.sm)

    return fade(img, fr, tot, frames=15)


# ===== MAIN =====

def main():
    print("Generating sikret demo video...")
    fonts = Fonts()

    scenes = [
        (3.5, scene_title),
        (4.0, scene_problem),
        (6.0, scene_resolve),
        (7.0, scene_exec),
        (6.0, scene_inline),
        (5.0, scene_schemes),
        (3.5, scene_closing),
    ]

    total_secs = sum(d for d, _ in scenes)
    total_frames = int(total_secs * FPS)
    print(f"  Duration: {total_secs:.1f}s, {total_frames} frames at {FPS}fps")

    proc = subprocess.Popen(
        [
            "ffmpeg", "-y",
            "-f", "rawvideo",
            "-vcodec", "rawvideo",
            "-pix_fmt", "rgb24",
            "-s", f"{WIDTH}x{HEIGHT}",
            "-r", str(FPS),
            "-i", "-",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "medium",
            "-crf", "18",
            "-movflags", "+faststart",
            "demo.mp4",
        ],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    rendered = 0
    for si, (dur, fn) in enumerate(scenes):
        n = int(dur * FPS)
        name = fn.__name__.replace("scene_", "")
        print(f"  [{si + 1}/{len(scenes)}] {name} ({dur}s, {n} frames)")

        for fi in range(n):
            img = fn(fi, n, fonts)
            proc.stdin.write(img.tobytes())
            rendered += 1

            if rendered % 100 == 0:
                pct = rendered * 100 // total_frames
                print(f"    {pct}% ({rendered}/{total_frames})", end="\r")

    print(f"  Encoding {rendered} frames...                    ")
    proc.stdin.close()
    stderr = proc.stderr.read().decode()
    rc = proc.wait()

    if rc != 0:
        print(f"ffmpeg error:\n{stderr}")
        sys.exit(1)

    print("Done! Saved to demo.mp4")


if __name__ == "__main__":
    main()
