# Deprecated Features

本文件保留已從主手冊移除、且不再對外提供的新功能入口的舊 API 用法，供維護或回溯時參考。

## Deprecated Web Access API

說明：
- `/web/access` 已從主路由卸載，不再是正式對外 API。
- 主手冊 [api-documentation.md](/C:/Users/Public/Code/project/fish-healthy-prediction-project/esp32-server/docs/api-documentation.md:1) 已不再列出這組路由。
- 這裡只保存過往使用方式。

認證：
- `Authorization: Bearer <web_token>`

### GET `/web/access`

Query：
- `limit` number 選填，預設 `30`，最大 `200`
- `offset` number 選填，預設 `0`

Response：
```json
{
  "ok": true,
  "access_keys": [
    {
      "id": 1,
      "user_id": 1,
      "pond_ids": [3],
      "sensor_ids": [8, 9],
      "max_requests": 200,
      "used_requests": 12,
      "expires_at": "2026-04-15T12:00:00.000Z",
      "revoked_at": null,
      "access_preview": "abcd...wxyz",
      "status": {
        "expired": false,
        "revoked": false,
        "exhausted": false,
        "active": true
      },
      "remaining_requests": 188
    }
  ],
  "count": 1,
  "total": 1,
  "pagination": {
    "limit": 30,
    "offset": 0,
    "total": 1,
    "hasMore": false
  }
}
```

### POST `/web/access`

Body：
- `sensor_ids` number[] 選填
- `pond_ids` number[] 選填
- `expires_in_minutes` number 選填
- `max_requests` number 選填

規則：
- `sensor_ids`、`pond_ids` 至少要提供一種。
- 只提供 `pond_ids` 時，後端會自動把這些池塘底下的所有 sensors 一併納入。
- 只提供 `sensor_ids` 時，後端會自動補齊這些 sensors 所屬的 `pond_ids`。

Response：
```json
{
  "ok": true,
  "message": "access 建立成功",
  "access_key": "<raw-access-key>",
  "access": {}
}
```

### GET `/web/access/:accessId`

Response：
```json
{
  "ok": true,
  "access": {}
}
```

### PUT `/web/access/:accessId`

Body：
- 與建立相同，皆為選填

### DELETE `/web/access/:accessId`

說明：
- 直接刪除 access record，不是單純把 `revoked_at` 標記起來。

Response：
```json
{
  "ok": true,
  "message": "access 已刪除"
}
```
