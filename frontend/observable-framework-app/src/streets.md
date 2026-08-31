---
toc: false
theme: [air, ocean-floor, wide]
---

# Street cards

```js
import L from "leaflet";

const guiriApiBase = globalThis.GUIRI_API_BASE ?? "http://127.0.0.1:9092";

const apartmentMapData = fetch(`${guiriApiBase}/api/v1/apartments/map`)
  .then(async response => {
    if (!response.ok) throw new Error(`Failed to load apartment addresses: ${response.status}`);

    return response.json();
  });
```

```js
const streetCards = d3.groups(apartmentMapData.data, d => [d.tipus_carrer, d.carrer].filter(Boolean).join(" ").trim())
  .map(([street, addresses]) => {
    const formatAreaList = (field) => d3.groups(addresses, d => d[field])
      .filter(([name]) => name)
      .map(([name, rows]) => ({
        name,
        apartments: d3.sum(rows, d => d.apartments_count)
      }))
      .sort((a, b) => d3.descending(a.apartments, b.apartments) || d3.ascending(a.name, b.name))
      .map(d => `${d.name} (${d.apartments.toLocaleString("es-ES")})`);

    return {
      street,
      districts: formatAreaList("nom_districte"),
      neighbourhoods: formatAreaList("nom_barri"),
      buildings: addresses.length,
      apartments: d3.sum(addresses, d => d.apartments_count),
      places: d3.sum(addresses, d => d.total_places),
      coordinates: addresses
        .map(d => ({ longitude: d.longitud_x, latitude: d.latitud_y }))
        .filter(d => Number.isFinite(d.longitude) && Number.isFinite(d.latitude))
    };
  })
  .filter(d => d.street)
  .sort((a, b) => d3.descending(a.apartments, b.apartments));

const streetPageSize = 20;
const streetPageCount = Math.max(1, Math.ceil(streetCards.length / streetPageSize));
const streetPageInput = Inputs.range([1, streetPageCount], {label: "Page", step: 1, value: 1});

function streetMiniMap(coordinates) {
  if (!coordinates.length) return html`<div class="street-card__map street-card__map--empty">No coordinates</div>`;

  const element = html`<div class="street-card__map"></div>`;
  const bounds = L.latLngBounds(coordinates.map(({latitude, longitude}) => [latitude, longitude]));

  requestAnimationFrame(() => {
    const map = L.map(element, {
      attributionControl: false,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false,
      scrollWheelZoom: false,
      tap: false,
      touchZoom: false,
      zoomControl: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);

    coordinates.forEach(({latitude, longitude}) => {
      L.circleMarker([latitude, longitude], {
        radius: 4,
        color: "#2563eb",
        weight: 2,
        fillColor: "#38bdf8",
        fillOpacity: 0.78
      }).addTo(map);
    });

    map.fitBounds(bounds, {
      padding: [18, 18],
      maxZoom: 17
    });
    map.invalidateSize();
  });

  return element;
}

function streetCard(street) {
  return html`<article class="card street-card">
    <h3 class="street-card__title">${street.street}</h3>
    <div class="street-card__metrics">
      <p class="street-card__metric">
        <span class="street-card__metric-value">${street.buildings.toLocaleString("es-ES")}</span>
        <span class="street-card__metric-label">Buildings</span>
      </p>
      <p class="street-card__metric">
        <span class="street-card__metric-value">${street.apartments.toLocaleString("es-ES")}</span>
        <span class="street-card__metric-label">Apartments</span>
      </p>
      <p class="street-card__metric">
        <span class="street-card__metric-value">${street.places.toLocaleString("es-ES")}</span>
        <span class="street-card__metric-label">Places</span>
      </p>
    </div>
    ${streetMiniMap(street.coordinates)}
    <p class="street-card__areas">
      <span>${street.districts.join(", ")}</span>
      <span class="street-card__neighbourhoods">${street.neighbourhoods.join(", ")}</span>
    </p>
  </article>`;
}

function streetCardGrid(streets) {
  return streets.length
    ? html`<div class="street-card-grid">${streets.map(streetCard)}</div>`
    : html`<p>No streets found for this page.</p>`;
}
```

```js
const streetPageValue = view(streetPageInput);
```

```js
const visibleStreetCards = streetCards.slice((streetPageValue - 1) * streetPageSize, streetPageValue * streetPageSize);
```

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">

<style>
.street-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
}

.street-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
}

.street-card__title,
.street-card__metric,
.street-card__areas {
  margin: 0;
}

.street-card__title {
  font-size: 0.95rem;
  line-height: 1.2;
}

.street-card__map {
  height: 130px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--theme-background-alt);
}

.street-card__map--empty {
  display: grid;
  place-items: center;
  color: var(--theme-foreground-muted);
  font-size: 0.75rem;
}

.street-card__map .leaflet-tile-pane {
  filter: saturate(0.7) contrast(0.92) brightness(1.05);
}

.street-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.street-card__metric-value,
.street-card__metric-label {
  display: block;
}

.street-card__metric-value {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.street-card__metric-label,
.street-card__areas {
  color: var(--theme-foreground-muted);
}

.street-card__metric-label {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  line-height: 1.1;
  text-transform: uppercase;
}

.street-card__areas {
  justify-self: end;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.25rem 0.5rem;
  font-size: 0.72rem;
  line-height: 1.1;
  text-align: right;
}

.street-card__neighbourhoods {
  color: var(--theme-foreground);
}
</style>

${display(streetCardGrid(visibleStreetCards))}
