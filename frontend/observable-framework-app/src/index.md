---
toc: false
theme: [air, ocean-floor, wide]
---

# Pisos turístics per districte i barri

```js
const barriosData = FileAttachment("data/barriosData.json").json();
```

```js
// Create search input (for searchable table)
const tableSearch = Inputs.search(barriosData.data, {
  placeholder: "Search by neighbourhood or district…"
});

const tableSearchValue = view(tableSearch);
```

<div class="card" style="padding: 0">
  <div style="padding: 1em">
    ${display(tableSearch)}
  </div>
  ${display(Inputs.table(tableSearchValue, {
      columns: [
        "codi_barri",
        "nom_barri",
        "codi_districte",
        "nom_districte",
        "apartments"
      ],
      header: {
        codi_barri: "#",
        nom_barri: "Neighbourhood",
        codi_districte: "District #",
        nom_districte: "District",
        apartments: "Apartments"
      },
      width: {
        codi_barri: 50,
        codi_districte: 80
      },
      sort: "apartments",
      reverse: true
    }))}
</div>

---



```js
// Sort districts by total apartments ascending for the ordinal y-axis (most at top)
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
    label: "Apartments →",
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
    label: `Apartments (${scaleType} scale) →`,
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