"""Export a live deck to a PDF of pictures: one page per slide (as it ends), or one page per click.

    python tools/export_pdf.py talks/example                    # talks/example/example.pdf, light, 1 page per slide
    python tools/export_pdf.py talks/example --steps all        # a page for every click, like a handout of builds
    python tools/export_pdf.py talks/example --theme dark --scale 2 --out deck.pdf

Pages are pictures (the 3D views do not survive the browser's own print), so the text is not selectable; --scale 2
makes them sharp enough to zoom into. --pngs DIR also keeps each page as a PNG, for previews or a gallery.
Needs Playwright (pip install playwright && playwright install chromium) and Pillow. Like tools/check_deck.py it
runs headless Chromium with WebGL on the CPU, so 3D slides take a few seconds each.
"""

import argparse
import sys
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def settle(page, timeout=30):
    """Wait until no step is still animating: the deck's busy dot is off and no CSS animation is running."""
    end = time.time() + timeout
    page.wait_for_timeout(300)
    while time.time() < end and page.evaluate("document.documentElement.classList.contains('deck-busy')"):
        page.wait_for_timeout(100)
    # and until no CSS transition or animation is still running (a slide may not report its last flourish)
    finite = "document.getAnimations().filter(a => a.playState === 'running' && a.effect.getComputedTiming().endTime !== Infinity).length"
    while time.time() < end and page.evaluate(finite):
        page.wait_for_timeout(100)
    page.wait_for_timeout(600)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("talk", type=Path, help="a talk folder holding index.html")
    ap.add_argument("--out", type=Path, help="the PDF to write (default: <talk>/<talk name>.pdf)")
    ap.add_argument("--theme", choices=["light", "dark"], default="light")
    ap.add_argument("--steps", choices=["last", "all"], default="last", help="a page per slide, or per click")
    ap.add_argument("--scale", type=float, default=1.5, help="pixels per CSS pixel of a 1600 x 900 slide")
    ap.add_argument("--pngs", type=Path, help="also keep every page as a PNG in this folder")
    args = ap.parse_args()

    index = (args.talk / "index.html").resolve()
    assert index.exists(), f"no {index}"
    out = args.out or args.talk / f"{args.talk.resolve().name}.pdf"
    if args.pngs:
        args.pngs.mkdir(parents=True, exist_ok=True)
    pages, problems = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        page = browser.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=args.scale)
        page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        page.goto(f"{index.as_uri()}?theme={args.theme}")
        page.wait_for_function("window.Reveal && Reveal.isReady()")
        # no laser dot, no cursor, no busy dot in the pictures
        page.add_style_tag(content=".deck-laser { display: none !important; } "
                                   ".reveal .slide-number::before { display: none !important; }")
        names = page.evaluate("[...document.querySelectorAll('.reveal .slides > section')].map(s => s.dataset.slide)")
        for h, name in enumerate(names):
            page.evaluate(f"Reveal.slide({h}, 0)")
            settle(page)
            steps = 1 + page.evaluate("Reveal.getCurrentSlide().querySelectorAll('.deck-step').length")
            for k in range(1, steps + 1):
                if k > 1:
                    page.evaluate("Reveal.next()")
                    settle(page)
                if args.steps == "all" or k == steps:
                    png = page.screenshot(type="png")
                    path = (args.pngs or Path("/tmp")) / f"{h + 1:02d}_{k:02d}_{name}.png"
                    path.write_bytes(png)
                    pages.append(Image.open(path).convert("RGB"))
                    if not args.pngs:
                        path.unlink()
            print(f"  {h + 1:2d} {name} ({steps} step{'s' if steps > 1 else ''})")
        browser.close()

    if not pages:
        sys.exit("no pages")
    # 1600 x 900 CSS pixels at 96 dpi: a 16.7 x 9.4 inch page, whatever --scale is
    dpi = 96 * args.scale
    pages[0].save(out, "PDF", save_all=True, append_images=pages[1:], resolution=dpi, quality=92)
    print(f"\n{len(pages)} pages -> {out} ({out.stat().st_size / 1e6:.1f} MB)")
    if problems:
        print("page errors while exporting:\n" + "\n".join(problems))


if __name__ == "__main__":
    main()
