# Petal deck: event surface for hand gestures

The prototype at `/petals` exposes everything a gesture layer needs on
`window.MahoragaTabs`. The gesture layer recognises hands and calls
`MahoragaTabs.send(intent, data)`; the deck does the rest and reports
outcomes through `MahoragaTabs.on(outcome, fn)`.

All coordinates are screen pixels in the page's coordinate space
(`clientX` / `clientY`). If the camera image is mirrored, mirror before
sending. Velocities are pixels per second.

## Intents: one call, one outcome

Attach a recognised, completed gesture to one of these.

| Intent | Data | Effect |
|---|---|---|
| `summon` | | New tab summoned from the canopy; the current one goes behind it |
| `next` / `prev` | | Riffle the deck one card |
| `back` | | Active tab goes to the back of the deck |
| `close` | | Active tab comes apart and sinks into the pool |
| `click` | `{x, y}` | Click tell: a petal lands on the point and rings it |
| `think` | `{on}` (optional, toggles if omitted) | Thinking orbit around the active frame |
| `scale` | `{factor}` | Multiply the deck's size (clamped to the viewport) |
| `scale.to` | `{scale}` | Set the size absolutely (1 = default) |
| `move` | `{dx, dy}` | Nudge the whole deck |
| `duplicate` | | The active card tears in two; the copy comes to the front |
| `form` | `{kind}` | Form `cube`, `brain`, or `solar` out of petals. The deck steps aside |
| `form.dismiss` | | The form falls back to the pool and the deck returns |
| `form.faces` | `{mode}` (optional, cycles if omitted) | Cube faces: `leaves` (every petal), `glass` (edges + see-through pane), `solid` (edges + gray pane that hides what is behind it) |
| `form.rotate` | `{dx, dy}` | Turn the form by a screen-space delta |
| `pick` | `{x, y}` | Solar only: pick the planet (or sun) under a point. The camera swings to it, zooms, and labels it. Emits `pick.missed` on empty space |
| `unpick` | | Back out to the whole system |

While a form is up, the continuous gestures change meaning: `grab` rotates
the form (a throw keeps it spinning; a pinch that does not travel is a
`pick`), and `scale` / `stretch` expand it in and out.

## Continuous: gestures with a clutch that track the hand

Send these every frame while the gesture is live. `id` distinguishes hands;
omit it if you only ever track one.

| Intent | Data | Notes |
|---|---|---|
| `hand` | `{id, x, y, pinch}` | Where a hand is. Draws a petal cursor that tightens as `pinch` goes 0 → 1 |
| `hand.lost` | `{id}` | Hand left the frame; ends any grab or scrub it held |
| `grab` | `{id, x, y}` | Pinch closed over the active frame. Emits `grab.rejected` if nothing is under the hand |
| `grab.move` | `{id, x, y}` | Frame follows the hand with no lag |
| `grab.end` | `{id, x, y, vx, vy}` | Pinch opened. The release velocity decides: fast sideways → `next`/`prev`; fast down toward the pool, or dropped below the waterline → `close`; otherwise a drop |
| `scrub` | `{id, x}` | Start riffling from a screen x |
| `scrub.move` | `{id, x}` | Cards fan under the hand; roughly half a frame width per card |
| `scrub.end` | `{id, vx}` | Snaps to the nearest card, with `vx` carrying it further |
| `stretch` | `{id, distance}` | Two-hand pinch: start resizing from this hand separation |
| `stretch.move` | `{id, distance}` | Size follows the ratio to the starting distance |
| `stretch.end` | `{id}` | |

Thresholds live in `MahoragaTabs.config` and can be tuned from the gesture
side: `throwSpeed` (default 900), `flickSpeed` (900), `scrubCardsPerSecond`
(2500).

## Outcomes: subscribe to know what happened

```js
const off = MahoragaTabs.on('tab.activated', ({ tab, site }) => { ... });
off(); // unsubscribe
```

| Outcome | Data |
|---|---|
| `tab.summoned` | `{tab, site}` |
| `tab.activated` | `{tab, site}` (a different card came to the front) |
| `tab.closed` | `{tab, site}` |
| `deck.changed` | `{count, active, order}` |
| `deck.moved` | `{x, y}` (offset from the default placement) |
| `deck.scaled` | `{scale}` |
| `grab.rejected` | `{id, x, y}` (pinched on empty space) |
| `tab.duplicated` | `{tab, from, site}` |
| `form.shown` / `form.dismissed` | `{kind}` |
| `form.faces` | `{mode}` |
| `form.zoom` | `{zoom}` |
| `picked` / `unpicked` / `pick.missed` | `{name}` / `{}` / `{x, y}` |

`MahoragaTabs.state` returns the deck order, active tab, placement, scrub
offset and thinking flag at any time, plus `form` when one is up: its kind,
face mode, picked body, zoom, and for the solar system the current screen
position of every planet (handy for aiming a `pick`). `MahoragaTabs.intents` lists every
intent name.

## Testing without a camera

The page drives the same surface from the mouse: move is `hand`, drag is
`grab`, shift+drag is `scrub`, the wheel is `scale`. Keys: Space summon,
arrows riffle, B back, D duplicate, Esc close, C click, T thinking, M calm,
+ and - scale, 1/2/3 form the cube, brain, solar system, F cycles cube faces,
U unpicks, 0 dismisses the form. A click without a drag while a form is up
is a `pick`.
The panel at top left logs the last outcomes as they fire.

A minimal gesture adapter looks like this:

```js
// per camera frame, for each detected hand
MahoragaTabs.send('hand', { id, x, y, pinch });
if (pinchJustClosed) MahoragaTabs.send('grab', { id, x, y });
else if (pinchHeld)  MahoragaTabs.send('grab.move', { id, x, y });
else if (pinchJustOpened) MahoragaTabs.send('grab.end', { id, x, y, vx, vy });
// on a recognised static sign
if (foxSign) MahoragaTabs.send('summon');
```
