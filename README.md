# Grain Lab

A grainy-gradient generator for brand backgrounds. Soft overlapping colour forms on a
near-black ground, with a film-grain pass over the top — plus a Bézier shape editor and a
motion timeline that bakes and records seamless loops.

Everything is one self-contained HTML file. No build step, no dependencies, no network
calls: open `grain-lab.html` and it runs.

## What it does

**Stills.** Palette, layer count, edge blur and dissolve, contrast, rim light, spread,
grain amount / cell size / chroma, shadow protection. Radial or linear gradient fills.
Exports PNG at 1×–3× (up to 4320 × 2880) in five aspect ratios.

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

49 assertions in headless Chrome covering layout, the shape editor (including overlay /
canvas pixel register), motion tracks and pose morphing, bake and playback, and every
export delivery branch. Exits non-zero on failure. Set `$CHROME` if Chrome isn't at the
default macOS path.

Two harness limits are documented at the top of `grain-lab.tests.js`:
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
