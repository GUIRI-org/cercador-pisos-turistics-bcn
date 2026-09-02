---
toc: false
theme: [air, ocean-floor, wide]
---

# Data tables

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

const rawApartmentsData = fetch(`${guiriApiBase}/api/v1/apartments/list`)
  .then(async response => {
    if (!response.ok) throw new Error(`Failed to load raw apartments: ${response.status}`);

    return response.json();
  });
```

```js

const rawApartmentsSearch = Inputs.search(rawApartmentsData.data, {
  placeholder: "Search raw apartments..."
});

const rawApartmentsSearchValue = view(rawApartmentsSearch);
```

## Raw apartment results

<div class="card" style="padding: 0">
  <div style="padding: 1em">
    ${display(rawApartmentsSearch)}
  </div>
  ${display(Inputs.table(rawApartmentsSearchValue, {
      columns: [
        "n_expedient",
        "nom_districte",
        "nom_barri",
        "tipus_carrer",
        "carrer",
        "num1",
        "longitud_x",
        "latitud_y",
        "numero_places",
        "numero_registre_generalitat"
      ],
      header: {
        n_expedient: "Expedient",
        nom_districte: "District",
        nom_barri: "Neighbourhood",
        tipus_carrer: "Street type",
        carrer: "Street",
        num1: "Number",
        longitud_x: "Longitude",
        latitud_y: "Latitude",
        numero_places: "Places",
        numero_registre_generalitat: "Registry"
      },
      width: {
        num1: 70,
        longitud_x: 100,
        latitud_y: 100,
        numero_places: 70
      },
      sort: "nom_districte"
    }))}
</div>
