# Load test

```bash
# install k6 (mac):  brew install k6
k6 run \
  -e BASE_URL=https://staging-api.mwrd.com \
  -e EMAIL=loadtest@client.local \
  -e PASSWORD='from 1Password' \
  k6.js
```

Targets:
- `me_latency p95 < 500ms`
- `catalog_latency p95 < 800ms`
- `http_req_failed < 1%`

Rerun with `--out json=summary.json` and grep for slow endpoints. n+1
suspects to check first: catalog product list (joins category, related
listings), notifications inbox (fan-out reads).
