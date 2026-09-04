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
| `form` | `{kind, text?}` | Form a shape out of petals; the deck steps aside. `MahoragaTabs.forms` lists every kind. 3D: `cube`, `sphere`, `torus`, `pyramid`, `cylinder`, `cone`, `icosahedron`. Compound: `dna`, `lantern`, `torii`, `dharma`, `brain`, `solar`, `cards` (a fanned hand and a face-down stack, seven fixed cards; `{shuffle: true}` deals seven at random). 2D: `circle`, `ring`, `square`, `triangle`, `star`, `hexagon`, `heart`, `spiral`, and `text` with `{text}` |
| `form.dismiss` | | The form falls back to the pool and the deck returns |
| `form.faces` | `{mode}` (optional, cycles if omitted) | Faces of any flat-faced solid (cube, pyramid, icosahedron): `leaves` (every petal), `glass` (edges + see-through pane), `solid` (edges + gray pane that hides what is behind it) |
| `form.rotate` | `{dx, dy}` | Turn the form by a screen-space delta |
| `pick` | `{x, y}` | Solar: pick the planet (or sun) under a point. The camera swings to it, zooms, and labels it. Cards: lift the card under the point out of the fan and name it; picking it again puts it back. Emits `pick.missed` on empty space |
| `unpick` | | Back out to the whole system, or put a lifted card back |
| `cards.shuffle` | | Deal a new hand of seven random cards; the old one falls to the pool |
| `cards.fan` | `{spread}` | Set how wide the hand fans, 0.15 (a tight stack) to 2.2 (a full arc); 1 is the default |
| `locate` | `{lat?, lon?, radius?}` | Form a petal map of the streets around you. Without coordinates it asks the browser for your location (a permission prompt; nothing leaves the machine but the map request), falling back to `?lat=&lon=` in the URL, then to a default. Emits `map.located` then `map.built`, or `map.failed` |
| `form` `{kind: 'map', lat, lon, radius?}` | | The same map at explicit coordinates, no prompt |
| `run` | `{task, provider?, model?, max_steps?}` | Run a task on the service (`POST /v1/tasks`). The frame for it arrives through the live feed, not this call; the reply becomes `run.finished` or `run.rejected` |
| `live.connect` | `{url?}` | Follow a service's live feed (`GET /v1/live`); `url` is the service origin, empty for the page's own. Connected by default; `?live=off` in the URL leaves it off, `?live=https://host:8080` points elsewhere |
| `live.disconnect` | | Stop following |
| `live.event` | `{kind, session, ...}` | Feed one event in by hand (the same shape the stream carries) |
| `live.demo` | | A scripted run with drawn frames, for testing without a service (it honours the controls below) |
| `pause` / `resume` / `stop` | `{session?}` (defaults to the active frame's task) | Controls on a running task, sent to the service (`POST /v1/live/{session}/pause|resume|stop`) and from there to the agent. Pause holds it before its next step and freezes the frame's border; resume thaws it with a breath; stop ends the run and the frame settles as stopped, most of its border letting go. `control.rejected` when nothing is running under the frame |
| `hold` | `{session?}` | Pause if running, resume if paused: one gesture for both |

A suggested mapping for the task controls: an open palm held still over the
frame is `hold`; a fist closing over it is `stop`.

While a form is up, the continuous gestures change meaning: `grab` rotates
the form (a throw keeps it spinning; a pinch that does not travel is a
`pick`), and `scale` / `stretch` expand it in and out. With the cards up,
`scrub` fans the hand under the hand instead of riffling the deck.

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
| `cards.fanned` | `{spread}` (while a scrub fans the hand) |
| `map.located` / `map.built` / `map.failed` / `form.failed` | `{lat, lon, how}` / `{lat, lon, radius, place, ways, petals}` / `{reason}` / `{kind, error}` |

## The live feed: frames follow the agent

With the service running, the page follows `GET /v1/live` (Server-Sent
Events) and the deck mirrors every task the service runs, whether it came
from the console, n8n, the CLI or the dev panel's task field:

| Feed event | What the deck does |
|---|---|
| `task.started` | Summons a frame for the session, its page waiting for the first frame |
| `screenshot` | The frame's page becomes the latest screenshot of the agent's current page (`GET /v1/live/screenshot/{session}`) |
| `navigate` | The address and title update; a wave runs around the border and a breeze of petals crosses the page |
| `step` | The chrome shows `Step n · goal`; a click sends a petal to the element the agent clicked, typing settles a few petals across the field, a scroll blows down the page. Element positions come from the agent's own DOM state, as fractions of the viewport |
| `tab.opened` / `tab.closed` | The session's first tab is its frame; further tabs with a real URL get frames of their own and sink when they close |
| `task.paused` / `task.resumed` | The border freezes in place and the page cools; resume thaws it with a breath. The step line reads `Paused · …` |
| `task.stopping` | The step line reads `Stopping…` until the agent's run ends |
| `task.finished` / `task.failed` | The border calms and the page dims (a failure scatters part of the border first, a stop lets most of it go); the step line reads the result, the error, or `Stopped` |

A page that opens mid-task catches up from the stream's opening snapshot.
The service's hooks report the agent's steps and take a screenshot every
two seconds between them; typed text is never forwarded, only its length.
Integrations can push the same events with `POST /v1/live/events`.

Outcomes for the gesture side: `task.started {session, task, tab}`,
`agent.navigated {session, tab, url, title}`, `agent.step {session, tab, n,
goal, actions}`, `task.paused` / `task.resumed` / `task.stopping {session,
tab, step}`, `agent.finished {session, tab, success, stopped, result, error}`,
`control.rejected {action, reason}`, `live.connected`, `live.disconnected
{retryIn}`, `run.sent`, `run.finished`, `run.rejected`. `MahoragaTabs.state.live` lists the feed status and every
session with its frames.

`MahoragaTabs.state` returns the deck order, active tab, placement, scrub
offset and thinking flag at any time, plus `form` when one is up: its kind,
face mode, picked body, zoom, and for the solar system the current screen
position of every planet, or for the cards the hand with each card's name,
screen position and lift (handy for aiming a `pick`). `MahoragaTabs.intents` lists every
intent name.

## Adding a shape

A form is one builder returning surface points `{p3: [x, y, z], sprite?,
sizeScale?, dim?, edge?}` in a roughly unit-sized space with +y up, registered
in `FORMS`. Helpers exist for spheres, tubes along a path, surfaces of
revolution, discs, box surfaces, flat-faced solids (which also get the face
modes), and `raster(draw)` which turns anything drawn on a canvas into petals.

## Testing without a camera

The dev panel (backtick, or the pill at the bottom) holds a button for every
intent and every shape, plus a text field. The page drives the same surface from the mouse: move is `hand`, drag is
`grab`, shift+drag is `scrub`, the wheel is `scale`. Keys: Space summon,
arrows riffle, B back, D duplicate, Esc close, C click, T thinking, M calm,
+ and - scale, 1/2/3 form the cube, brain, solar system, F cycles cube faces,
U unpicks, 0 dismisses the form, 4 forms the map at your location, 5 deals
the cards and S shuffles them, L toggles the live feed, G plays the demo run,
H holds or resumes the active frame's task, X stops it. A click without a drag while a form is up
is a `pick`.
The panel at top left logs the last outcomes as they fire. `P` (or the
Petals button) switches between the real petal sprites in `assets/petals`
and the drawn fallback; `?petals=drawn` in the URL starts on the fallback.

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
