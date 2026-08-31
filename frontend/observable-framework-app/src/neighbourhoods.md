---
toc: false
theme: [air, ocean-floor, wide]
---

# Neighbourhood cards

```js
const guiriApiBase = globalThis.GUIRI_API_BASE ?? "http://127.0.0.1:9092";

const barriosData = fetch(`${guiriApiBase}/api/v1/apartments/neighborhoods`)
  .then(async response => {
    if (!response.ok) throw new Error(`Failed to load neighborhoods: ${response.status}`);

    const payload = await response.json();
    return {
      ...payload,
      data: (payload.data ?? []).map(d => ({
        ...d,
        apartments: d.apartments ?? d.apartments_count ?? 0,
        places: d.places ?? d.total_places ?? 0
      }))
    };
  });
```

```js
const neighbourhoodCards = barriosData.data
  .map(d => ({
    nom_barri: d.nom_barri,
    nom_districte: d.nom_districte,
    apartments: d.apartments,
    places: d.places
  }))
  .sort((a, b) => d3.descending(a.apartments, b.apartments));
```

<style>
.neighbourhood-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.neighbourhood-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
}

.neighbourhood-card__title,
.neighbourhood-card__metric,
.neighbourhood-card__district {
  margin: 0;
}

.neighbourhood-card__title {
  font-size: 0.95rem;
  line-height: 1.2;
}

.neighbourhood-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.neighbourhood-card__metric-value,
.neighbourhood-card__metric-label {
  display: block;
}

.neighbourhood-card__metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.neighbourhood-card__metric-label,
.neighbourhood-card__district {
  color: var(--theme-foreground-muted);
}

.neighbourhood-card__metric-label {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  line-height: 1.1;
  text-transform: uppercase;
}

.neighbourhood-card__district {
  justify-self: end;
  font-size: 0.72rem;
  line-height: 1.1;
}
</style>

<div class="neighbourhood-card-grid">
${neighbourhoodCards.map(neighbourhood => html`<article class="card neighbourhood-card">
  <h3 class="neighbourhood-card__title">${neighbourhood.nom_barri}</h3>
  <div class="neighbourhood-card__metrics">
    <p class="neighbourhood-card__metric">
      <span class="neighbourhood-card__metric-value">${neighbourhood.apartments.toLocaleString("es-ES")}</span>
      <span class="neighbourhood-card__metric-label">Apartments</span>
    </p>
    <p class="neighbourhood-card__metric">
      <span class="neighbourhood-card__metric-value">${neighbourhood.places.toLocaleString("es-ES")}</span>
      <span class="neighbourhood-card__metric-label">Places</span>
    </p>
  </div>
  <p class="neighbourhood-card__district">${neighbourhood.nom_districte}</p>
</article>`)}
</div>
