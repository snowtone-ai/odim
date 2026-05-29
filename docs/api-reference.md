# API v1

## Auth

- Header: `x-odim-api-key: <token>` or `Authorization: Bearer <token>`
- Scope requirements:
  - `/api/v1/entities*` -> `entities:read`
  - `/api/v1/signals` -> `signals:read`
  - `/api/v1/alerts` -> `alerts:read`
  - `/api/v1/huginn` -> `huginn:query`
  - `/api/v1/sources/health` -> `settings:read`

## Response shape

```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "per_page": 25, "timestamp": "2026-05-29T00:00:00.000Z" },
  "links": { "next": null, "prev": null }
}
```

## Endpoints

- `GET /api/v1/entities?q=&min_score=&page=&per_page=`
- `GET /api/v1/entities/:id`
- `GET /api/v1/entities/:id/score-history?days=30`
- `GET /api/v1/signals?layer=&source=&page=&per_page=`
- `GET /api/v1/alerts?priority=&page=&per_page=`
- `POST /api/v1/huginn`
- `GET /api/v1/sources/health?page=&per_page=`

## Huginn body

```json
{
  "question": "Which entities are committing capital before narrative confirmation?",
  "webSearch": false
}
```
