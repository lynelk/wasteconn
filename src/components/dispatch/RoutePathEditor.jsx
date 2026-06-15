import { useState, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, Polyline, Marker } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Upload, Pen, Trash2, Check } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const DEFAULT_CENTER = [0.3476, 32.5825];

function DrawingHandler({ drawing, onPoint }) {
  useMapEvents({
    click(e) {
      if (drawing) onPoint([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

function parseKmlGpx(text) {
  try {
    const parser = new DOMParser();
    // Try KML first
    if (text.includes('<kml') || text.includes('<Placemark')) {
      const doc = parser.parseFromString(text, 'text/xml');
      const coords = doc.querySelector('coordinates')?.textContent?.trim();
      if (coords) {
        return coords.split(/\s+/).map(c => {
          const [lng, lat] = c.split(',').map(Number);
          return [lat, lng];
        }).filter(c => !isNaN(c[0]));
      }
    }
    // Try GPX
    if (text.includes('<gpx') || text.includes('<trkpt')) {
      const doc = parser.parseFromString(text, 'text/xml');
      const trkpts = doc.querySelectorAll('trkpt');
      return Array.from(trkpts).map(pt => [
        parseFloat(pt.getAttribute('lat')),
        parseFloat(pt.getAttribute('lon')),
      ]).filter(c => !isNaN(c[0]));
    }
  } catch {}
  return [];
}

export default function RoutePathEditor({ initialGeoJson, onSave, onCancel }) {
  const [mode, setMode] = useState('select'); // 'select' | 'draw' | 'import'
  const [points, setPoints] = useState(() => {
    if (!initialGeoJson) return [];
    try {
      const geo = JSON.parse(initialGeoJson);
      const coords = geo.type === 'Feature' ? geo.geometry?.coordinates : geo.coordinates;
      return (coords || []).map(c => [c[1], c[0]]);
    } catch { return []; }
  });
  const [drawing, setDrawing] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef();

  const toGeoJson = (pts) => JSON.stringify({
    type: 'LineString',
    coordinates: pts.map(p => [p[1], p[0]]),
  });

  const handleSave = () => {
    if (points.length < 2) return;
    onSave(toGeoJson(points), mode === 'draw' ? 'drawn' : 'imported');
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseKmlGpx(ev.target.result);
      if (parsed.length < 2) {
        setImportError('Could not parse file. Ensure it is a valid KML or GPX file with track coordinates.');
      } else {
        setImportError('');
        setPoints(parsed);
        setMode('import');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === 'draw' || (mode === 'select' && drawing) ? 'default' : 'outline'}
          onClick={() => { setMode('draw'); setDrawing(true); }}
          className="gap-1.5"
        >
          <Pen className="w-3.5 h-3.5" /> Draw on Map
        </Button>
        <Button
          size="sm"
          variant={mode === 'import' ? 'default' : 'outline'}
          onClick={() => { setDrawing(false); fileRef.current?.click(); }}
          className="gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" /> Import KML/GPX
        </Button>
        <input ref={fileRef} type="file" accept=".kml,.gpx" className="hidden" onChange={handleFileImport} />
        {points.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setPoints([])} className="gap-1.5 text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      {importError && <p className="text-xs text-destructive">{importError}</p>}

      {drawing && (
        <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
          📍 Click on the map to add route waypoints. Click "Done Drawing" when finished.
        </p>
      )}

      <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 380 }}>
        <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DrawingHandler drawing={drawing} onPoint={p => setPoints(prev => [...prev, p])} />
          {points.length >= 2 && (
            <Polyline positions={points} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }} />
          )}
          {points.map((pt, i) => (
            i === 0 || i === points.length - 1 ? (
              <Marker key={i} position={pt} icon={L.divIcon({
                html: `<div style="background:${i===0?'#22c55e':'#ef4444'};border:2px solid white;border-radius:50%;width:14px;height:14px"></div>`,
                className: '', iconSize: [14,14], iconAnchor: [7,7]
              })} />
            ) : null
          ))}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{points.length} waypoints defined</p>
        <div className="flex gap-2">
          {drawing && (
            <Button size="sm" variant="outline" onClick={() => setDrawing(false)}>Done Drawing</Button>
          )}
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={points.length < 2} className="gap-1.5">
            <Check className="w-3.5 h-3.5" /> Save Route Path
          </Button>
        </div>
      </div>
    </div>
  );
}