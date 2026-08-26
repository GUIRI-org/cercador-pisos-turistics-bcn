# Cercador de pisos turístics · Next.js app

Frontend for searching Barcelona tourist apartment licenses by address. Built with Next.js (static export), Bootstrap, Leaflet, and the GeoBCN / GUIRI internal APIs.

## Pages

| Route | Description |
|---|---|
| `/` | Main search — queries the internal GUIRI API |
| `/opendata-search` | Alternative search — queries Open Data BCN datastore directly |

## Development

```bash
npm install
cp .env.sample .env.local  # create local environment file (optional)
npm run dev                # starts dev server at http://localhost:3000
```

The application will use default values if `.env.local` is not created.

## Building

### Root deployment (served at `https://example.com/`)

```bash
NEXT_PUBLIC_SITE_URL=https://example.com npm run build
# output: out/
```

### Subfolder deployment (served at `https://example.com/guiri-ptb/`)

```bash
NEXT_PUBLIC_SITE_URL=https://example.com \
NEXT_PUBLIC_BASE_PATH=/guiri-ptb \
npm run build
# output: out/
# upload the contents of out/ to your server's /guiri-ptb/ directory
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_GUIRI_API_BASE` | `http://127.0.0.1:9092` | Base URL for the GUIRI Apartments API |
| `NEXT_PUBLIC_SITE_URL` | `https://elguiri.cat` | Canonical base URL used for OGP metadata |
| `NEXT_PUBLIC_BASE_PATH` | _(empty)_ | Subfolder path, e.g. `/guiri-ptb`. Leave empty for root deploys |

## Deploy

After running the build command, upload the contents of `out/` to your server:

```bash
# Example: rsync to a subfolder on a remote server
rsync -av out/ user@server:/var/www/html/guiri-ptb/
```

No Node.js server is required — the output is fully static HTML/CSS/JS.
