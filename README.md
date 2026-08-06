# Grain Lab

### ▶ [fpinzn.github.io/grain-lab](https://fpinzn.github.io/grain-lab/)

A grainy-gradient generator for brand backgrounds. Soft overlapping colour forms on a
near-black ground, with a film-grain pass over the top — plus a Bézier shape editor and a
motion timeline that bakes and records seamless loops.

Everything is one self-contained HTML file. No build step, no dependencies, no network
calls: open `grain-lab.html` and it runs.

Use the hosted link for anything you want to keep — it is served top-level, so exports
download normally at any size. Embedded in a sandboxed frame (a Claude artifact, for
instance) the browser blocks downloads outright and the page falls back to offering the
rendered image for a manual save.

## What it does

Two modes share the same palette, grain, motion and export.

**Shapes** — soft overlapping forms on a near-black ground: layer count, edge blur and
dissolve, contrast, rim light, spread, radial or linear fills.

**Gradient** — one vertical ramp filling the frame, walked across the swatches from c1 at
the top to c4 at the bottom, quantised into a set number of flat bands. Two colours or
four; two steps or sixty-four; or a smooth ramp with no banding at all. The ramp is walked
in linear light, so a magenta-to-orange sweep keeps its saturation through the middle
instead of sagging grey.

**Both.** Grain amount / cell size / chroma with shadow protection. PNG export at 1×–3×
(up to 4320 × 2880) in five aspect ratios.

**Shapes.** Each silhouette is a closed quadratic Bézier spline. Click a shape to select
it, drag the ◆ grip to move it, drag the ● control points to bend the curve. Arrow keys
nudge a focused handle. A curve-tension slider runs from full Bézier bulge to straight
polygon edges. Geometry is stored normalised, so a shape tuned at preview size exports
pixel-identical at 3× and survives an aspect change without stretching.

**Motion.** Add any property to the timeline and it animates from the rail's value (A) to
a target (B), through one of twelve easing curves, during a slice of the loop you set with
a two-grip window. Shapes get a pose A → pose B morph. The loop ping-pongs so it seams,
which also means only half the frames are unique. Frames are baked once into bitmaps, then
played back and recorded to WebM.

## The method

The parameters were reverse-engineered from the two reference images in this repo, not
guessed. Separating grain from base gradient (heavy blur = base, residual = grain) gave:

| Property | Measured | Meaning |
|---|---|---|
| amplitude | σ ≈ 13–18 / 255 | ≈ 6% noise — poster-grade grain |
| R·G·B correlation | 0.78 – 0.95 | mostly luminance + ~35% colour speckle |
| autocorrelation @1px | 0.62 – 0.74 | grain cells ≈ 2 px, not 1-px static |
| σ in deep shadows | ≈ 5.5 | grain fades to ~⅓ near black |
| excess kurtosis | +0.7 – +2.9 | heavier tails than Gaussian (clipping) |

The defaults *are* those measurements. A full write-up — including Photoshop and SVG
`feTurbulence` recipes — is at the bottom of the page itself.

## Tests

```sh
./run-tests.sh
```

65 assertions in headless Chrome covering layout, the shape editor (including overlay /
canvas pixel register), gradient mode (band counts sampled straight off the canvas),
motion tracks and pose morphing, bake and playback, and every export delivery branch. Exits non-zero on failure. Set `$CHROME` if Chrome isn't at the
default macOS path.

### Publishing

Pushing to `main` runs the suite on a GitHub runner and, only if it passes, deploys to
Pages. A failing test leaves the live site on its previous version rather than replacing
it with a broken one.

A `pre-push` hook runs the same suite locally first, so failures surface before the push
leaves the machine:

```sh
git config core.hooksPath hooks    # enable  (already set in this clone)
git config --unset core.hooksPath  # disable
git push --no-verify               # bypass once
```

### Harness limits

Two are documented at the top of `grain-lab.tests.js`:
`requestAnimationFrame` doesn't fire under `--virtual-time-budget`, so the playback and
record clocks are exercised only through their timer fallback; and headless has no
compositor, so canvas capture yields an empty file — the record test therefore asserts an
*honest refusal* rather than a working video.

## Known limits

- **Recording is unverified.** Everything up to the encoder handshake works and an empty
  capture reports itself instead of handing over a 0-byte file, but whether real frames
  land needs a check in a real browser.
- **Grain is close to the worst case for a video codec.** The bitrate is biased high for
  this reason; use the *maximum* quality setting if you see the grain smear.
- **Served from a page, not an iframe.** Embedded in a sandboxed frame the browser blocks
  downloads; the page detects that and offers the rendered image for a manual save
  instead. Run it top-level (locally, or from Pages) for unrestricted exports.
