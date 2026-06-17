'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
) as any;
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
) as any;
const CircleMarker = dynamic(
  () => import('react-leaflet').then((m) => m.CircleMarker),
  { ssr: false }
) as any;
const Tooltip = dynamic(
  () => import('react-leaflet').then((m) => m.Tooltip),
  { ssr: false }
) as any;

interface AddressMiniMapProps {
  lat: number;
  lng: number;
  label: string;
  otherMarkers?: Array<{
    lat: number;
    lng: number;
    label?: string;
  }>;
}

export function AddressMiniMap({ lat, lng, label, otherMarkers = [] }: AddressMiniMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="ratio ratio-1x1 rounded border border-gray-300 bg-gray-100" />;
  }

  return (
    <div className="ratio ratio-1x1 rounded overflow-hidden border border-gray-300" style={{ minWidth: '180px', maxWidth: '220px' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={18}
        scrollWheelZoom={false}
        dragging={true}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {otherMarkers.map((marker, index) => (
          <CircleMarker
            key={`other-${index}`}
            center={[marker.lat, marker.lng]}
            radius={4}
            pathOptions={{ color: '#1d4ed8', fillColor: '#60a5fa', fillOpacity: 0.65, weight: 1 }}
          >
            {marker.label && (
              <Tooltip direction="top" offset={[0, -4]}>{marker.label}</Tooltip>
            )}
          </CircleMarker>
        ))}
        <CircleMarker
          center={[lat, lng]}
          radius={7}
          pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.8 }}
        >
          <Tooltip direction="top" offset={[0, -6]}>{label}</Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
