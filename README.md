# Trail Trophy — 3D Hiking Diorama

Drop a GPX file and get your hike as a miniature tabletop terrain diorama: a slice of earth with strata walls on a wooden plinth, a glowing trail ribbon, start/summit/finish markers, and a brass nameplate.

Runs out of the box: **no API keys**. Terrain is procedural by default. An optional "Real DEM" mode pulls public AWS Terrarium elevation tiles, which need no key, and falls back to procedural terrain if you're offline.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

Stack: React 18 · Vite 5 · Tailwind 3 · three.js 0.169 · @react-three/fiber 8 · drei 9 · @react-three/postprocessing 2 · lucide-react.

## Features

- **Diorama**: radial terrain mesh clipped to a Hexagon, Square or Circle base. It has a vertical skirt with a wavy sedimentary strata texture, a bevelled plinth, and a nameplate drawn with Canvas2D, so no fonts are downloaded.
- **Themes**: Topo Clay (matte cream with contour lines), Satellite / Earth (forest → meadow → rock → snow, set by height and slope), **OpenStreetMap** (real OSM map tiles draped over the terrain, best combined with Real DEM), Dark Tactical (slate with glowing cyan contours and a neon trail with bloom).
- **Vertical exaggeration** from 1.0× to 3.0×. Contour lines stay in true meters at any exaggeration.
- **Trail**: a centripetal `CatmullRomCurve3` tube that sits a fixed height above the sampled terrain surface. It draws itself in when a hike loads, and an animated "hiker" bead follows it.
- **Markers**: start and finish pins, merged into one when the hike is a loop. The high point gets a stone cairn and a waving summit flag. HTML labels can be toggled.
- **Lighting & post-processing**: warm key light with PCF soft shadows, cool hemisphere and ambient fill, bloom, vignette, and a toggleable two-pass tilt-shift for the miniature look.
- **Camera**: OrbitControls with damping and auto-rotate. Presets (Isometric, Top-down, Summit close-up) fly the camera there; dragging cancels the flight.
- **Metrics**: distance (km or mi), elevation gain and loss, peak and low point, and duration. Duration comes from GPS timestamps when the file has them, otherwise from Naismith's rule.
- **Elevation profile**: hover or drag on it to move the hiker bead along the 3D trail.
- **Snapshot**: saves the current view as a PNG.

## Data pipeline (`src/lib`)

| File | Role |
|---|---|
| `gpx.js` | Namespace-agnostic parser that reads `<trkpt>`, then `<rtept>`, then `<wpt>`. It reads `<ele>` and `<time>`, fills gaps in elevation, and removes duplicate points. It projects lat/lon to local equirectangular meters centred at (0,0,0) with north = −Z, then scales the route to fit the base. Also computes metrics (haversine distance, smoothed gain with a hysteresis threshold) and resamples the route by distance. |
| `terrain.js` | `synthesizeField` builds the procedural terrain: domain-warped fBm, ridged multifractal noise, and a massif centred on the hike's high point. A Gaussian RBF correction then makes the surface pass through the GPX elevations along the route and fade back to pure noise away from it. `fetchDEMField` loads and decodes Terrarium tiles and samples them bilinearly onto the same grid. `sampleField` / `terrainY` place the trail and markers on the surface. |
| `geometry.js` | Builds the radial top mesh (240 spokes, so hexagon and square corners fall exactly on a spoke), the skirt, the plinth, and the strata and nameplate textures. |
| `mapTiles.js` | Fetches up to 36 OpenStreetMap tiles around the hike, stitches them together, and crops the result to the diorama's footprint to use as the terrain texture. Attribution is shown on screen as OSM's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) requires. |
| `noise.js` | Seeded simplex noise, fBm, and ridged noise. |
| `themes.js` | Per-theme palette, terrain colour function, lights, and bloom. |
| `demoHikes.js` | Mt. Rainier (Camp Muir) and Half Dome. Both are generated as real GPX XML and go through the same parser as an uploaded file. |

GPX files without `<ele>` still work: the terrain is generated without the route correction, and elevations are sampled from the terrain instead.
