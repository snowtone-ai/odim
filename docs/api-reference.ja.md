# API v1

## 認証

- ヘッダー: `x-odim-api-key: <token>` または `Authorization: Bearer <token>`
- 必要な権限:
  - `/api/v1/entities*` -> `entities:read`
  - `/api/v1/signals` -> `signals:read`
  - `/api/v1/alerts` -> `alerts:read`
  - `/api/v1/huginn` -> `huginn:query`
  - `/api/v1/sources/health` -> `settings:read`

## レスポンス形式

```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "per_page": 25, "timestamp": "2026-05-29T00:00:00.000Z" },
  "links": { "next": null, "prev": null }
}
```

## エンドポイント

- `GET /api/v1/entities?q=&min_score=&page=&per_page=`
- `GET /api/v1/entities/:id`
- `GET /api/v1/entities/:id/score-history?days=30`
- `GET /api/v1/signals?layer=&source=&page=&per_page=`
- `GET /api/v1/alerts?priority=&page=&per_page=`
- `POST /api/v1/huginn`
- `GET /api/v1/sources/health?page=&per_page=`

## Huginnリクエスト本文

```json
{
  "question": "Which entities are committing capital before narrative confirmation?",
  "webSearch": false
}
```
