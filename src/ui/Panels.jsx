import { useRef, useState } from 'react'
import {
  Mountain, Upload, Route, TrendingUp, Timer, MountainSnow, ChevronDown, Hexagon, Square, Circle,
  RotateCw, Aperture, Layers, TreePine, Tag, Box, Map, Flag, Camera, Globe, Cpu, Loader2, Sparkles,
} from 'lucide-react'
import { DEMO_HIKES } from '../lib/demoHikes.js'
import { THEME_LIST } from '../lib/themes.js'
import ElevationProfile from './ElevationProfile.jsx'
import { fmtDist, fmtEle, fmtDuration } from './format.js'

const cx = (...a) => a.filter(Boolean).join(' ')

function Section({ title, children, dark }) {
  return (
    <div className="space-y-2">
      <div className={cx('text-[10px] font-semibold uppercase tracking-[0.14em]', dark ? 'text-slate-400' : 'text-stone-500')}>{title}</div>
      {children}
    </div>
  )
}

function Segmented({ options, value, onChange, dark }) {
  return (
    <div className={cx('grid gap-1 rounded-xl p-1', dark ? 'bg-white/5' : 'bg-stone-900/5')} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'chip-btn',
              active
                ? dark ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/40' : 'bg-white text-stone-900 shadow-sm'
                : dark ? 'text-slate-400 hover:text-slate-100' : 'text-stone-500 hover:text-stone-800',
            )}
          >
            {Icon && <Icon size={14} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Toggle({ icon: Icon, label, checked, onChange, dark }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cx(
        'chip-btn justify-start border',
        checked
          ? dark ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100' : 'border-orange-500/30 bg-orange-500/10 text-orange-800'
          : dark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-stone-900/10 text-stone-500 hover:text-stone-800',
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

function Panel({ dark, className, title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto w-[min(330px,calc(100vw-24px))] overflow-hidden', className)}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        {Icon && <Icon size={16} className={dark ? 'text-cyan-300' : 'text-orange-600'} />}
        <span className="flex-1 font-display text-sm font-semibold tracking-tight">{title}</span>
        <ChevronDown size={16} className={cx('transition-transform', open ? 'rotate-180' : '', dark ? 'text-slate-400' : 'text-stone-400')} />
      </button>
      {open && <div className="max-h-[calc(100vh-160px)] space-y-4 overflow-y-auto px-4 pb-4">{children}</div>}
    </div>
  )
}

function Metric({ icon: Icon, label, value, sub, dark }) {
  return (
    <div className={cx('rounded-xl p-2.5', dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/70 ring-1 ring-stone-900/5')}>
      <div className={cx('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider', dark ? 'text-slate-400' : 'text-stone-500')}>
        <Icon size={12} /> {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {sub && <div className={cx('text-[10px]', dark ? 'text-slate-500' : 'text-stone-400')}>{sub}</div>}
    </div>
  )
}

export function HikePanel({ dark, accent, track, metrics, eles, units, setUnits, onFile, onDemo, activeDemo, onScrub, error, readOnly, saveSlot, onNew }) {
  const inputRef = useRef()
  const [over, setOver] = useState(false)
  return (
    <Panel dark={dark} title="Trail Trophy" icon={Mountain}>
      {readOnly ? (
        <div className={cx('flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs', dark ? 'bg-white/5' : 'bg-white/60')}>
          <span className="font-medium">A shared trophy</span>
          <button onClick={onNew} className={cx('font-semibold underline-offset-2 hover:underline', dark ? 'text-cyan-300' : 'text-orange-700')}>Make your own →</button>
        </div>
      ) : (<>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; f && onFile(f) }}
        onClick={() => inputRef.current.click()}
        className={cx(
          'flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors',
          over
            ? dark ? 'border-cyan-300 bg-cyan-400/10' : 'border-orange-500 bg-orange-500/10'
            : dark ? 'border-white/15 hover:border-white/30' : 'border-stone-900/15 hover:border-stone-900/30',
        )}
      >
        <Upload size={18} className={dark ? 'text-cyan-300' : 'text-orange-600'} />
        <div className="text-xs font-semibold">Drop a .gpx file</div>
        <div className={cx('text-[11px]', dark ? 'text-slate-400' : 'text-stone-500')}>or click to browse</div>
        <input ref={inputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="hidden"
          onChange={(e) => { const f = e.target.files[0]; f && onFile(f); e.target.value = '' }} />
      </div>
      {error && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-500/30">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        {DEMO_HIKES.map((d) => (
          <button
            key={d.id}
            onClick={() => onDemo(d)}
            className={cx(
              'rounded-xl px-2.5 py-2 text-left transition-all',
              activeDemo === d.id
                ? dark ? 'bg-cyan-400/15 ring-1 ring-cyan-300/50' : 'bg-orange-500/15 ring-1 ring-orange-500/40'
                : dark ? 'bg-white/5 hover:bg-white/10' : 'bg-white/60 hover:bg-white/90',
            )}
          >
            <div className="flex items-center gap-1 text-[11px] font-semibold"><Sparkles size={11} /> Load demo</div>
            <div className="text-[11px] leading-tight opacity-80">{d.label}</div>
          </button>
        ))}
      </div>
      </>)}

      {readOnly && error && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-500/30">{error}</div>}
      {track && metrics && (
        <>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className={cx('text-[10px] font-semibold uppercase tracking-[0.14em]', dark ? 'text-slate-400' : 'text-stone-500')}>Now showing</div>
              <div className="truncate font-display text-base font-semibold">{track.name}</div>
            </div>
            <Segmented dark={dark} value={units} onChange={setUnits} options={[{ value: 'metric', label: 'km' }, { value: 'imperial', label: 'mi' }]} />
          </div>
          {saveSlot}
          <div className="grid grid-cols-2 gap-2">
            <Metric dark={dark} icon={Route} label="Distance" value={fmtDist(metrics.distanceM, units)}
              sub={units === 'metric' ? `${(metrics.distanceM / 1609.344).toFixed(1)} mi` : `${(metrics.distanceM / 1000).toFixed(1)} km`} />
            <Metric dark={dark} icon={TrendingUp} label="Elev. gain" value={`+${fmtEle(metrics.gainM, units)}`} sub={`−${fmtEle(metrics.lossM, units)} loss`} />
            <Metric dark={dark} icon={MountainSnow} label="Peak" value={fmtEle(metrics.peakM, units)} sub={`low ${fmtEle(metrics.minM, units)}`} />
            <Metric dark={dark} icon={Timer} label="Duration" value={fmtDuration(metrics.durationH)} sub={metrics.durationSource} />
          </div>
          <ElevationProfile cumDist={metrics.cumDist} eles={eles} peakIdx={metrics.peakIdx} units={units} dark={dark} accent={accent} onScrub={onScrub} />
          {!track.hasEle && (
            <div className={cx('text-[11px]', dark ? 'text-amber-300' : 'text-amber-700')}>
              This GPX has no &lt;ele&gt; data — elevations are sampled from the terrain.
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

export function StylePanel({ dark, settings, set, demStatus, osmStatus, defaultOpen }) {
  return (
    <Panel dark={dark} title="Diorama Style" icon={Layers} defaultOpen={defaultOpen}>
      <Section title="Base shape" dark={dark}>
        <Segmented dark={dark} value={settings.shape} onChange={(v) => set({ shape: v })} options={[
          { value: 'hexagon', label: 'Hex', icon: Hexagon },
          { value: 'square', label: 'Square', icon: Square },
          { value: 'circle', label: 'Circle', icon: Circle },
        ]} />
      </Section>

      <Section title="Theme" dark={dark}>
        <div className="grid grid-cols-2 gap-2">
          {THEME_LIST.map((t) => {
            const active = settings.theme === t.id
            return (
              <button key={t.id} onClick={() => set({ theme: t.id })}
                className={cx('overflow-hidden rounded-xl text-left ring-2 transition-all', active ? (dark ? 'ring-cyan-300' : 'ring-orange-500') : 'ring-transparent hover:ring-stone-400/40')}>
                <div className="h-9" style={{ background: themeSwatch(t) }} />
                <div className={cx('px-1.5 py-1 text-[10px] font-semibold leading-tight', dark ? 'bg-slate-800/80' : 'bg-white/80')}>{t.label}</div>
              </button>
            )
          })}
        </div>
        {osmStatus === 'loading' && (
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500"><Loader2 size={12} className="animate-spin" /> Fetching OpenStreetMap tiles…</div>
        )}
        {osmStatus === 'error' && <div className="text-[11px] text-red-500">Map tiles unavailable (offline?) — showing plain terrain.</div>}
      </Section>

      <Section title={`Vertical exaggeration · ${settings.exaggeration.toFixed(1)}×`} dark={dark}>
        <input
          type="range" min="1" max="3" step="0.1" value={settings.exaggeration}
          onChange={(e) => set({ exaggeration: parseFloat(e.target.value) })}
          className="tt-range"
          style={{ '--thumb': dark ? '#22d3ee' : '#ea580c', '--track': dark ? 'rgba(255,255,255,.15)' : 'rgba(120,113,108,.25)' }}
        />
      </Section>

      <Section title="Terrain source" dark={dark}>
        <Segmented dark={dark} value={settings.terrainSource} onChange={(v) => set({ terrainSource: v })} options={[
          { value: 'synthetic', label: 'Procedural', icon: Cpu },
          { value: 'dem', label: 'Real DEM', icon: Globe },
        ]} />
        <div className={cx('flex items-center gap-1.5 text-[11px]', dark ? 'text-slate-400' : 'text-stone-500')}>
          {demStatus === 'loading' && <><Loader2 size={12} className="animate-spin" /> Fetching elevation tiles…</>}
          {demStatus === 'error' && <span className="text-red-500">DEM unavailable offline — using procedural terrain.</span>}
          {demStatus === 'ok' && settings.terrainSource === 'dem' && <>AWS Terrarium tiles · no API key</>}
          {settings.terrainSource === 'synthetic' && <>Route-conforming fractal terrain · works offline</>}
        </div>
      </Section>

      <Section title="Effects & overlays" dark={dark}>
        <div className="grid grid-cols-2 gap-1.5">
          <Toggle dark={dark} icon={RotateCw} label="Auto-rotate" checked={settings.autoRotate} onChange={(v) => set({ autoRotate: v })} />
          <Toggle dark={dark} icon={Aperture} label="Tilt-shift" checked={settings.tiltShift} onChange={(v) => set({ tiltShift: v })} />
          <Toggle dark={dark} icon={Layers} label="Contours" checked={settings.contours} onChange={(v) => set({ contours: v })} />
          <Toggle dark={dark} icon={TreePine} label="Trees" checked={settings.trees} onChange={(v) => set({ trees: v })} />
          <Toggle dark={dark} icon={Tag} label="Labels" checked={settings.labels} onChange={(v) => set({ labels: v })} />
        </div>
      </Section>
    </Panel>
  )
}

function themeSwatch(t) {
  if (t.id === 'clay') return 'linear-gradient(135deg,#f2ece0 0%,#d8ccb6 55%,#e4572e 56%,#e4572e 60%,#cbb999 61%)'
  if (t.id === 'osm') return 'linear-gradient(135deg,#f2efe9 0%,#f2efe9 30%,#aad3df 31%,#aad3df 45%,#f2efe9 46%,#add19e 60%,#f8d27a 61%,#f8d27a 64%,#add19e 65%)'
  if (t.id === 'satellite') return 'linear-gradient(135deg,#2f5a2e 0%,#6e8b3d 35%,#7d766d 60%,#f3f5f7 85%)'
  return 'linear-gradient(135deg,#0b0f16 0%,#1a2230 50%,#22d3ee 51%,#22d3ee 53%,#1a2230 54%,#ff2bd6 80%,#1a2230 82%)'
}

export function CameraBar({ dark, onPreset, onSnapshot }) {
  const btn = cx('chip-btn px-3 py-2', dark ? 'text-slate-200 hover:bg-white/10' : 'text-stone-700 hover:bg-white/80')
  return (
    <div className={cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto flex items-center gap-1 p-1.5')}>
      <button className={btn} onClick={() => onPreset('showcase')}><Box size={15} /> <span className="hidden sm:inline">Isometric</span></button>
      <button className={btn} onClick={() => onPreset('top')}><Map size={15} /> <span className="hidden sm:inline">Top-down</span></button>
      <button className={btn} onClick={() => onPreset('summit')}><Flag size={15} /> <span className="hidden sm:inline">Summit</span></button>
      <div className={cx('mx-1 h-5 w-px', dark ? 'bg-white/15' : 'bg-stone-900/10')} />
      <button className={btn} onClick={onSnapshot} title="Save PNG snapshot"><Camera size={15} /> <span className="hidden sm:inline">Snapshot</span></button>
    </div>
  )
}
