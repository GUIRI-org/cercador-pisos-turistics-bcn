# cercador-pisos-turistics-bcn
Cercador d'habitatges amb llicència turística de Barcelona by GUIRI.

## Frontend

Built with [Observable Framework](https://observablehq.com/framework/).
Run the dev server:

```bash
cd frontend/observable-framework-app
npm run dev
```

## APIs

### GeoBCN — Street address search

Base URL: `https://geoportal.barcelona.cat/geoBCN/serveis/territori`

| Endpoint | Description |
|---|---|
| `GET /tipusvies` | All Barcelona street types (`codi`, `abreviatura`, `nom`) |
| `GET /?q={query}` | Full-text search returning `vies` (streets) and `adreces` (portals) |
| `GET /portals?id_via={codi}&numero={num}` | Portals (door-level addresses) for a given street and number |

**Search example** — streets matching "aribau":

```
GET https://geoportal.barcelona.cat/geoBCN/serveis/territori?q=aribau
```

Response shape:

```json
{
  "estat": "OK",
  "resultats": {
    "vies": [
      { "codi": "023403", "nomComplet": "Carrer d'Aribau", "tipusVia": { "codi": "02", "abreviatura": "C", "nom": "Carrer" } }
    ],
    "adreces": [
      { "id": "...", "carrer": { "codi": "023403" }, "numeracioPostal": "1", "nomComplet": "Carrer d'Aribau 1", "barri": {...}, "districte": {...} }
    ]
  }
}
```

Docs: <https://geoportal.barcelona.cat/geoBCN/doc/rest/API.aspx>
