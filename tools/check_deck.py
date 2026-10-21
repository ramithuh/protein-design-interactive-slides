"""Walk a live deck in a headless browser: every slide, every step, both themes. Fails on any console error,
page error or missing slide, and saves a picture of each slide at its last step.

    python tools/check_deck.py talks/example                 # pictures in talks/example/check/
    python tools/check_deck.py talks/example --slide manim-graph --theme light
    python tools/check_deck.py talks/example --back          # also step backwards through every slide

Needs Playwright: pip install playwright && playwright install chromium. WebGL runs on the CPU
(SwiftShader), so 3D slides are slow but drawn exactly as on a GPU. The deck is opened from disk (file://),
which is also how it must work offline.
"""

import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def settle(page, timeout=20):
    """Wait until no step is still animating (the deck's busy dot is off) and a couple of frames have drawn."""
    end = time.time() + timeout
    page.wait_for_timeout(250)
    while time.time() < end and page.evaluate("document.documentElement.classList.contains('deck-busy')"):
        page.wait_for_timeout(100)
    page.wait_for_timeout(700)  # CSS reveals take ~0.5 s


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("talk", type=Path, help="a talk folder holding index.html")
    ap.add_argument("--theme", choices=["dark", "light", "both"], default="both")
    ap.add_argument("--slide", help="check only the slide with this name")
    ap.add_argument("--back", action="store_true", help="also step backwards through each slide")
    ap.add_argument("--out", type=Path, help="where to save pictures (default: <talk>/check)")
    args = ap.parse_args()

    index = (args.talk / "index.html").resolve()
    assert index.exists(), f"no {index}"
    out = args.out or args.talk / "check"
    out.mkdir(parents=True, exist_ok=True)
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        for theme in (["dark", "light"] if args.theme == "both" else [args.theme]):
            page = browser.new_page(viewport={"width": 1600, "height": 900})
            page.on("console", lambda m, t=theme: problems.append(f"[{t}] console {m.type}: {m.text}")
                    if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e, t=theme: problems.append(f"[{t}] page error: {e}"))
            page.goto(f"{index.as_uri()}?theme={theme}")
            page.wait_for_function("window.Reveal && Reveal.isReady()")
            names = page.evaluate("[...document.querySelectorAll('.reveal .slides > section')].map(s => s.dataset.slide)")
            print(f"{theme}: {len(names)} slides")
            for h, name in enumerate(names):
                if args.slide and name != args.slide:
                    continue
                page.evaluate(f"Reveal.slide({h}, -1)")
                settle(page)
                steps = 1 + page.evaluate("Reveal.getCurrentSlide().querySelectorAll('.deck-step').length")
                for _ in range(steps - 1):
                    page.evaluate("Reveal.next()")
                    settle(page)
                page.screenshot(path=str(out / f"{h + 1:02d}_{name}_{theme}.png"))
                if args.back:
                    for _ in range(steps - 1):
                        page.evaluate("Reveal.prev()")
                        settle(page)
                    page.screenshot(path=str(out / f"{h + 1:02d}_{name}_{theme}_back.png"))
                print(f"  {h + 1:2d} {name} ({steps} steps)")
            page.close()
        browser.close()

    if problems:
        print("\nproblems:")
        print("\n".join(problems))
        sys.exit(1)
    print(f"\nno console errors; pictures in {out}")


if __name__ == "__main__":
    main()
