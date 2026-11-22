import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navigation } from "lucide-react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { buttonClass } from "./ui";

// Simple coloured dot instead of Leaflet's default image marker (no asset paths needed)
const dot = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:50%;background:rgb(var(--cta));border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function DirectionsButton({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a href={directionsUrl(lat, lng)} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
      <Navigation size={15} aria-hidden /> Get directions
    </a>
  );
}

/** OpenStreetMap view of one location. */
export function MapView({ lat, lng, label, className = "h-56" }: { lat: number; lng: number; label: string; className?: string }) {
  return (
    <div className={`relative z-0 overflow-hidden rounded-xl border border-line ${className}`} role="img" aria-label={`Map showing ${label}`}>
      <MapContainer key={`${lat},${lng}`} center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={dot} />
      </MapContainer>
    </div>
  );
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))) });
  return null;
}

/** Admin: click the map to set a location (FR-029). */
export function MapPicker({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  return (
    <div className="relative z-0 h-64 overflow-hidden rounded-xl border border-line">
      <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={dot} />
        <ClickToPick onPick={onPick} />
      </MapContainer>
      <p className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded-md bg-surface/90 px-2 py-1 text-xs font-medium">Click the map to move the pin</p>
    </div>
  );
}
