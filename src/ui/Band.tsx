/**
 * The signature visual element (Part 1 UI plan): a horizontal measure with
 * feathered-edge spans representing a range, plus an optional marker for
 * "what you asked for." Transcribed from the gradient-span pattern used
 * identically in Question.dc.html, Phone.dc.html and Statement.dc.html.
 */
import { formatLakhCompact } from './format';

export interface BandSpan {
  lo: number;
  hi: number;
  color: 'green' | 'blue';
}

interface BandVisualProps {
  maxScale: number;
  spans: BandSpan[];
  marker?: { value: number; label: string };
  height?: number;
}

const COLOR_HEX: Record<BandSpan['color'], string> = { green: '#1F5E3D', blue: '#1F3A6E' };

export function BandVisual({ maxScale, spans, marker, height = 54 }: BandVisualProps) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / maxScale) * 100))}%`;

  return (
    <div style={{ position: 'relative', height }} role="img" aria-label="Range visual">
      {marker && (
        <>
          <div
            className="mono"
            style={{ position: 'absolute', top: 0, left: pct(marker.value), fontSize: 10, transform: 'translateX(-50%)' }}
          >
            {marker.label}
          </div>
          <div style={{ position: 'absolute', top: 15, left: pct(marker.value), width: 1, height: 22, background: 'var(--ink)' }} />
        </>
      )}
      <div style={{ position: 'absolute', top: marker ? 25 : 14, left: 0, right: 0, height: 1, background: 'var(--rule)' }} />
      {spans.map((s, i) => {
        const hex = COLOR_HEX[s.color];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: marker ? 20 : 9,
              left: pct(s.lo),
              width: `calc(${pct(s.hi)} - ${pct(s.lo)})`,
              minWidth: 4,
              height: 11,
              background: `linear-gradient(90deg, ${hex}00 0%, ${hex} 34%, ${hex} 66%, ${hex}00 100%)`,
              transition: 'left 0.2s ease, width 0.2s ease',
            }}
          />
        );
      })}
      <div className="mono" style={{ position: 'absolute', bottom: 0, left: 0, fontSize: 10, color: 'var(--muted)' }}>
        0
      </div>
      <div className="mono" style={{ position: 'absolute', bottom: 0, right: 0, fontSize: 10, color: 'var(--muted)' }}>
        {formatLakhCompact(maxScale)}
      </div>
    </div>
  );
}
