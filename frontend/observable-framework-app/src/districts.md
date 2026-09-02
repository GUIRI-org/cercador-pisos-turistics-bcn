---
toc: true
theme: [air, ocean-floor, wide]
---

# Districts

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

const apartmentMapData = fetch(`${guiriApiBase}/api/v1/apartments/map`)
  .then(async response => {
    if (!response.ok) throw new Error(`Failed to load apartment addresses: ${response.status}`);

    return response.json();
  });
```

```js
const addressRowsByDistrict = d3.group(apartmentMapData.data, d => d.nom_districte);

const districtCards = d3.groups(barriosData.data, d => d.nom_districte)
  .map(([nom_districte, barris]) => {
    const addressRows = addressRowsByDistrict.get(nom_districte) ?? [];
    const streets = new Set(addressRows
      .map(d => [d.tipus_carrer, d.carrer].filter(Boolean).join(" ").trim())
      .filter(Boolean));

    return {
      nom_districte,
      total: d3.sum(barris, d => d.apartments),
      places: d3.sum(barris, d => d.places),
      buildings: addressRows.length,
      streets: streets.size,
      neighbourhoods: barris
        .map(d => ({
          nom_barri: d.nom_barri,
          apartments: d.apartments,
          places: d.places
        }))
        .sort((a, b) => d3.descending(a.apartments, b.apartments) || d3.ascending(a.nom_barri, b.nom_barri))
    };
  })
  .sort((a, b) => d3.descending(a.total, b.total));

const districtTreemapColor = "#334155";
const formatNumber = value => d3.format(",")(value).replaceAll(",", ".");

function districtDistributionTreemap(districts) {
  const root = d3.hierarchy({
    children: districts.map(district => ({
      ...district,
      children: district.neighbourhoods
    }))
  })
    .sum(d => d.apartments ?? 0)
    .sort((a, b) => b.value - a.value);

  d3.treemap()
    .size([320, 180])
    .paddingInner(1)
    .paddingOuter(0)
    // .paddingTop(d => d.depth === 1 ? 16 : 0)
    .round(true)(root);

  const container = html`<div class="district-overview__treemap"></div>`;
  const svg = d3.create("svg")
    .attr("viewBox", "0 0 320 180")
    .attr("preserveAspectRatio", "none")
    .attr("role", "img")
    .attr("aria-label", "District apartments treemap");

  const districtsLayer = svg.selectAll("g.district-overview__district")
    .data(root.children ?? [])
    .join("g")
    .attr("class", "district-overview__district")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  districtsLayer.append("rect")
    .attr("width", d => Math.max(0, d.x1 - d.x0))
    .attr("height", d => Math.max(0, d.y1 - d.y0))
    .attr("rx", 0)
    .attr("fill", districtTreemapColor);

  districtsLayer.append("title")
    .text(d => `${d.data.nom_districte}: ${formatNumber(d.data.total)} apartments`);

  const barrios = svg.selectAll("g.district-overview__barrio")
    .data(root.leaves())
    .join("g")
    .attr("class", "district-overview__barrio")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  barrios.append("rect")
    .attr("width", d => Math.max(0, d.x1 - d.x0))
    .attr("height", d => Math.max(0, d.y1 - d.y0))
    .attr("fill", "rgba(255, 255, 255, 0.18)")
    .attr("stroke", "rgba(255, 255, 255, 0)")
    .attr("stroke-width", 0.7);

  barrios.append("title")
    .text(d => `${d.data.nom_barri}: ${formatNumber(d.data.apartments)} apartments`);

  container.append(svg.node());

  (root.children ?? [])
    .filter(d => (d.x1 - d.x0) > 22 && (d.y1 - d.y0) > 11)
    .forEach(d => {
      container.append(html`<span class="district-overview__label" style=${`
        left: ${(d.x0 / 320) * 100}%;
        top: ${(d.y0 / 180) * 100}%;
        width: ${((d.x1 - d.x0) / 320) * 100}%;
        height: ${((d.y1 - d.y0) / 180) * 100}%;
      `}>
        <span>${d.data.nom_districte}</span>
        <strong>${formatNumber(d.data.total)}</strong>
      </span>`);
    });

  return container;
}

function barrioStackedBar(district) {
  const segmentColor = (index) => {
    const denominator = Math.max(1, district.neighbourhoods.length - 1);
    return d3.interpolateRgb("#111827", "#d1d5db")(index / denominator);
  };

  return html`<div class="district-card__stacked">
    <div class="district-card__stacked-bar">
      ${district.neighbourhoods.map((neighbourhood, index) => html`<span
        class="district-card__stacked-segment"
        title=${`${neighbourhood.nom_barri}: ${formatNumber(neighbourhood.apartments)} apartments`}
        style=${`
          --segment-width: ${(neighbourhood.apartments / district.total) * 100}%;
          --segment-color: ${segmentColor(index)};
        `}
      ></span>`)}
    </div>
    <ol class="district-card__legend">
      ${district.neighbourhoods.map((neighbourhood, index) => html`<li class="district-card__legend-item">
        <span class="district-card__legend-swatch" style=${`
          --segment-color: ${segmentColor(index)};
        `}></span>
        <span class="district-card__legend-name">${neighbourhood.nom_barri}</span>
        <span class="district-card__legend-value">${formatNumber(neighbourhood.apartments)}</span>
      </li>`)}
    </ol>
  </div>`;
}

function districtCard(district) {
  return html`  
  <article class="card district-card">
    <div class="district-card__header">
      <h3 class="district-card__title">${district.nom_districte}</h3>
    </div>
    <p class="district-card__total">
      <span>${formatNumber(district.total)}</span>
      <span class="district-card__label">Apartments</span>
    </p>
    ${barrioStackedBar(district)}
  </article>`;
}

function districtCardGrid(districts) {
  return html`<div class="district-card-grid">${districts.map(districtCard)}</div>`;
}
```

<style>
.district-overview {
  padding: 0rem;
  margin-bottom: 1rem;
}

.district-overview__title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.district-overview__treemap {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
}

.district-overview__treemap svg {
  display: block;
  width: 100%;
  height: 100%;
}

.district-overview__label {
  position: absolute;
  display: grid;
  align-content: start;
  gap: 0.2rem;
  padding: 0.4rem;
  color: white;
  font-size: 12px;
  line-height: 1.1;
  pointer-events: none;
}

.district-overview__label strong {
  font-size: 13px;
  line-height: 1;
}

.district-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  align-items: start;
  gap: 1rem;
}

.district-card {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  padding: 1rem;
}

.district-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.district-card__title,
.district-card__total {
  margin: 0;
}

.district-card__title {
  font-size: 1rem;
}

.district-card__total {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.district-card__label {
  margin: 0;
  color: var(--theme-foreground-muted);
  font-size: 0.8rem;
  font-weight: 400;
}

.district-card__stacked {
  display: grid;
  gap: 0.75rem;
}

.district-card__stacked-bar {
  display: flex;
  width: 100%;
  height: 0.85rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme-foreground-faint);
}

.district-card__stacked-segment {
  display: block;
  flex: 0 0 var(--segment-width);
  min-width: 1px;
  height: 100%;
  background: var(--segment-color);
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.8);
}

.district-card__legend {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.district-card__legend-item {
  display: grid;
  grid-template-columns: 0.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.76rem;
  line-height: 1.2;
}

.district-card__legend-swatch {
  width: 0.65rem;
  aspect-ratio: 1;
  border-radius: 2px;
  background: var(--segment-color);
}

.district-card__legend-name {
  min-width: 0;
  color: var(--theme-foreground);
}

.district-card__legend-value {
  color: var(--theme-foreground-muted);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>

The treemap visualization is showing the distribution of districts in the city of Barcelona by the total of apartments with touristic license **${d3.sum(districtCards, d => d.total)}** apartments. Each of the districts is divided by neighborhood displaying the size according to the distribution of apartments with touristic license

<div class="card district-overview">
  ${display(districtDistributionTreemap(districtCards))}
</div>
