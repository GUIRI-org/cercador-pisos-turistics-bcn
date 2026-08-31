---
toc: false
theme: [air, ocean-floor, wide]
---

# Charts

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
const districtStats = d3.groups(barriosData.data, d => d.nom_districte)
  .map(([nom_districte, barris]) => ({ nom_districte, total: d3.sum(barris, d => d.apartments) }))
  .sort((a, b) => d3.ascending(a.total, b.total));

const districtOrder = districtStats.map(d => d.nom_districte);
const districtTotalMap = new Map(districtStats.map(d => [d.nom_districte, d.total]));

const scaleTypeInput = Inputs.radio(
  ["linear", "log", "pow"],
  { label: "Scale type", value: "log" }
);
const scaleType = Generators.input(scaleTypeInput);
```

## Apartments by district

<div class="full">
${resize(width => Plot.plot({
  width,
  height: 360,
  marginLeft: 140,
  marginRight: 40,
  marginTop: 10,
  marginBottom: 40,
  x: {
    label: "Apartments ->",
    grid: true,
    tickFormat: d3.format(",")
  },
  y: {
    label: null,
    domain: districtOrder
  },
  color: {
    scheme: "tableau10"
  },
  marks: [
    Plot.barX(districtStats, {
      x: "total",
      y: "nom_districte",
      fill: "nom_districte",
      tip: true,
      channels: {
        District: "nom_districte",
        Apartments: "total"
      }
    }),
    Plot.text(districtStats, {
      x: "total",
      y: "nom_districte",
      text: d => d.total.toLocaleString("es-ES"),
      textAnchor: "start",
      dx: 6,
      fill: "currentColor"
    }),
    Plot.ruleX([0])
  ]
}))}

</div>

## Neighbourhood distribution

${scaleTypeInput}

<div class="full">
${resize(width => Plot.plot({
  width,
  height: 320,
  marginLeft: 20,
  marginRight: 20,
  marginTop: 10,
  marginBottom: 50,
  x: {
    type: scaleType,
    label: `Apartments (${scaleType} scale) ->`,
    grid: true,
    tickFormat: d3.format(",")
  },
  y: {
    axis: null
  },
  color: {
    legend: true,
    label: "Districte",
    domain: districtOrder,
    scheme: "tableau10",
    tickFormat: d => `${d} (${districtTotalMap.get(d).toLocaleString("es-ES")})`
  },
  marks: [
    Plot.dot(barriosData.data, Plot.dodgeY("middle", {
      x: "apartments",
      fill: "nom_districte",
      r: 5,
      opacity: 0.85,
      tip: true,
      channels: {
        Barri: "nom_barri",
        Districte: "nom_districte",
        Apartaments: "apartments"
      }
    }))
  ]
}))}

</div>
