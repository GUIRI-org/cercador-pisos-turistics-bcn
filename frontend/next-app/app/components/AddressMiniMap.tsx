'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type {
  CircleMarkerProps,
  MapContainerProps,
  TileLayerProps,
  TooltipProps,
} from 'react-leaflet';

type LeafletMapContainerProps = MapContainerProps & {
  center: [number, number];
  zoom: number;
  scrollWheelZoom?: boolean;
  dragging?: boolean;
  zoomControl?: boolean;
  attributionControl?: boolean;
};

type LeafletCircleMarkerProps = CircleMarkerProps & {
  center: [number, number];
  radius?: number;
  pathOptions?: Record<string, unknown>;
};

type LeafletTooltipProps = TooltipProps & {
  direction?: string;
  offset?: [number, number];
};

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
) as ComponentType<LeafletMapContainerProps>;
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
) as ComponentType<TileLayerProps>;
const CircleMarker = dynamic(
  () => import('react-leaflet').then((m) => m.CircleMarker),
  { ssr: false }
) as ComponentType<LeafletCircleMarkerProps>;
const Tooltip = dynamic(
  () => import('react-leaflet').then((m) => m.Tooltip),
  { ssr: false }
) as ComponentType<LeafletTooltipProps>;

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
