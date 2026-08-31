# Cercador de pisos turistics Barcelona

Frontend built with Observable Framework to search Barcelona addresses and cross-check tourist housing licenses.

## Run locally

Install dependencies:

```bash
npm install
```

Start development preview:

```bash
npm run dev
```

Build static output:

```bash
npm run build
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_GUIRI_API_BASE` | `http://127.0.0.1:9092` | Base URL for the GUIRI Apartments API, matching the Next.js app. |
| `GUIRI_API_BASE` | `http://127.0.0.1:9092` | Observable-specific fallback for the same API base URL. |

## Search chain logic

The app implements a chained workflow in src/index.md:

1. Address lookup (GeoBCN)
2. HUT lookup by full address (street + number)
3. HUT lookup by street only (type + street, no number)

### 1) Address lookup (GeoBCN)

Source endpoint:

- https://geoportal.barcelona.cat/geoBCN/serveis/territori

Flow:

1. User selects Tipo via and writes Calle.
2. The app autocompletes streets from GeoBCN and stores matched addresses.
3. After selecting street, Número options are populated from the stored address list.
4. When Número is selected, the selected address card is rendered.

### 2) HUT lookup by full address

Source endpoint:

- https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search
- resource_id: b32fa7f6-d464-403b-8a02-0292a64883bf

Query used:

- q = "<tipo+calle> <numero>"

Displayed section title:

- Viviendas de uso turistico (adreca amb numero)

### 3) HUT lookup by street only

Same endpoint and resource_id as above.

Query used:

- q = "<tipo+calle>"

Displayed section title:

- Viviendas de uso turistico (tipus i carrer, sense numero)

## Pagination behavior (all results)

The Datastore API is paginated.

To avoid partial data, the app fetches all pages for both HUT queries:

1. Start with offset=0 and limit=1000.
2. Append returned records.
3. Continue while collected records are below result.total.
4. Render complete lists with full counts in each section title.

This ensures both HUT blocks show all matches, not only the first page.

## Key files

- src/index.md: UI and chained search logic.
- src/styles.css: extracted styles and Bootstrap import.
- observablehq.config.js: Observable Framework app configuration.
