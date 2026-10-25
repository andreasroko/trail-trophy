# Trail Trophy — 3D Hiking Diorama

Drop a GPX file and get your hike as a miniature tabletop terrain diorama: a slice of earth with strata walls on a wooden plinth, a glowing trail ribbon, start/summit/finish markers, and a brass nameplate.

Runs out of the box with **no API keys**. Without a backend configured, saved hikes are stored in the browser (IndexedDB). Add a Supabase project to get accounts, saved hikes synced across devices, and public share links.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

Stack: React 18 · Vite 5 · Tailwind 3 · three.js 0.169 · @react-three/fiber 8 · drei 9 · @react-three/postprocessing 2 · lucide-react.

## Accounts & saved hikes (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Apply the schema. Either paste `supabase/migrations/20261025000000_hikes.sql` into the dashboard's SQL editor, or use the CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. `cp .env.example .env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. In **Authentication → URL Configuration**, set the Site URL to where the app runs (e.g. `http://localhost:5173`, later your production domain) and add it to the redirect URLs as `http://localhost:5173/**`.
5. Optional: enable Google/GitHub under **Authentication → Providers** and list them in `VITE_AUTH_PROVIDERS`.

Sign-in is a passwordless email link. You can try the app signed out. If you press **Save** while signed out, the hike is kept in the browser through the sign-in redirect and saved automatically when you're back.

**Data model:**
- `public.hikes` holds one row per hike: stats, start point, diorama style (`settings` jsonb), `is_public` and an unguessable `share_slug`.
- The raw GPX lives in the private `gpx` storage bucket at `<user_id>/<hike_id>.gpx`.
- Row Level Security limits each user to their own rows and files. Anyone can read a hike only once it's marked public.

**Routes:**
- `/` is a new or demo hike.
- `/h/:id` is one of your saved hikes.
- `/t/:slug` is a public, read-only share link, with "Save a copy to my trophies".

**Hosting:** it's a static SPA. Use `vercel.json` on Vercel or `public/_redirects` on Netlify, so deep links like `/h/…` resolve to `index.html`.

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

## Architecture

```
src/lib      pure data pipeline (GPX → projection → height field → meshes); no React
src/hooks    useDiorama: track + settings → field, metrics, DEM/OSM fetches
src/data     persistence: repo.js interface → cloudRepo (Supabase) | localRepo (IndexedDB); auth.jsx
src/three    React Three Fiber scene
src/ui       Tailwind overlay panels, account UI
App.jsx      routing, load/save orchestration
```

All persistence goes through the `repo` interface in `src/data/repo.js`. To change backends, write a new implementation of that interface; nothing else needs to change.

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
