# 養殖系統 API 手冊 V1.0

## 1. 概述

- **認證方式**: Bearer Token
- **Token 類型**:
  - **Web Token**: 由 `/web_auth/login` 或 `/web_auth/register` 取得，供後台/管理端 API 使用。
  - **Sensor Token**: 由 `/web/ponds/:pondId/sensors/:sensorId/token` 生成，供感測器上報資料。
- **內容格式**: `Content-Type: application/json`

## 2. API 列表

| No. | 介面                                         | 方法   | 說明                             | 認證             |
| --- | -------------------------------------------- | ------ | -------------------------------- | ---------------- |
| 1   | `/web_auth/register`                         | POST   | 使用者註冊                       | 無               |
| 2   | `/web_auth/login`                            | POST   | 使用者登入                       | 無               |
| 3   | `/web/auth/token-check`                      | GET    | Web Token 檢查                   | Web              |
| 4   | `/web/ponds`                                 | GET    | 取得使用者池塘列表               | Web              |
| 5   | `/web/ponds/:pondId`                         | GET    | 取得池塘詳情                     | Web              |
| 6   | `/web/ponds`                                 | POST   | 建立池塘                         | Web              |
| 7   | `/web/ponds/:pondId`                         | PUT    | 更新池塘                         | Web              |
| 8   | `/web/ponds/:pondId`                         | DELETE | 刪除池塘                         | Web              |
| 9   | `/web/ponds/:pondId/latest-data`             | GET    | 池塘最新數據（感測器+日誌）      | Web              |
| 10  | `/web/ponds/:pondId/latest-sensor-data`      | GET    | 池塘最新感測器數據               | Web              |
| 11  | `/web/ponds/:pondId/latest-daily-log`        | GET    | 池塘最新日常記錄                 | Web              |
| 12  | `/web/ponds/:pondId/daily-logs`              | GET    | 池塘日常記錄列表                 | Web              |
| 13  | `/web/ponds/:pondId/daily-logs/today`        | GET    | 今日日常記錄                     | Web              |
| 14  | `/web/ponds/:pondId/daily-logs/:logId`       | GET    | 日常記錄詳情                     | Web              |
| 15  | `/web/ponds/:pondId/daily-logs`              | POST   | 建立日常記錄                     | Web              |
| 16  | `/web/ponds/:pondId/daily-logs/:logId`       | PUT    | 更新日常記錄                     | Web              |
| 17  | `/web/ponds/:pondId/daily-logs/:logId`       | DELETE | 刪除日常記錄                     | Web              |
| 18  | `/web/ponds/:pondId/sensors`                 | GET    | 池塘感測器列表                   | Web              |
| 19  | `/web/ponds/:pondId/sensors/:sensorId`       | GET    | 感測器詳情                       | Web              |
| 20  | `/web/ponds/:pondId/sensors`                 | POST   | 建立感測器                       | Web              |
| 21  | `/web/ponds/:pondId/sensors/:sensorId`       | PUT    | 更新感測器                       | Web              |
| 22  | `/web/ponds/:pondId/sensors/:sensorId`       | DELETE | 刪除感測器                       | Web              |
| 23  | `/web/ponds/:pondId/sensors/:sensorId/token` | POST   | 生成感測器 Token（永久、單一）   | Web              |
| 24  | `/web/ponds/:pondId/sensors/:sensorId/token` | GET    | 感測器 Token 狀態                | Web              |
| 25  | `/web/ponds/:pondId/sensors/:sensorId/token` | DELETE | 撤銷感測器 Token                 | Web              |
| 26  | `/sensors/v1/include`                        | POST   | 感測器上報（v1）                 | Sensor           |
| 27  | `/sensors/include`                           | POST   | 感測器上報                       | Sensor           |
| 28  | `/sensors/auth/token-check`                  | GET    | Sensor Token 檢查                | Sensor           |
| 29  | `/web/access`                                | GET    | Access 列表                      | Web              |
| 30  | `/web/access`                                | POST   | 建立 Access                      | Web              |
| 31  | `/web/access/:accessId`                      | GET    | Access 詳情                      | Web              |
| 32  | `/web/access/:accessId`                      | PUT    | 更新 Access                      | Web              |
| 33  | `/web/access/:accessId`                      | DELETE | 撤銷 Access                      | Web              |
| 34  | `/shared/getInfo`                            | GET    | Access 使用手冊與可用資源        | Access           |
| 35  | `/shared/common`                             | GET    | 常用資訊（清單/近1天/30天/趨勢） | Access           |
| 36  | `/shared/data/ponds`                         | GET    | Access 查詢池塘                  | Access           |
| 37  | `/shared/data/sensors`                       | GET    | Access 查詢感測器                | Access           |
| 38  | `/shared/data/daily-logs`                    | GET    | Access 查詢日常記錄              | Access           |
| 39  | `/shared/data/sensor-data`                   | GET    | Access 查詢感測器數據            | Access           |
| 40  | `/web/notifications/subscribe`               | POST   | 訂閱推播通知                     | Web              |
| 41  | `/web/notifications/unsubscribe`             | POST   | 取消推播通知                     | Web              |
| 42  | `/webhook/grafana`                           | POST   | Grafana 告警 Webhook             | 無（可選 Token） |
| 43  | `/web/notifications/test`                    | POST   | 測試推播通知（暫用）             | Web              |

## 3. 介面詳情

### 3.1 Web Auth

**POST** `/web_auth/register`

- **說明**: 註冊新使用者並回傳 Web Token。
- **Body**:
  - `user_name` string 必填
  - `password` string 必填
- **Response**:

```json
{
  "ok": true,
  "token": "<jwt>",
  "user": {
    "user_id": 1,
    "user_name": "demo",
    "created_at": "2026-02-10T00:00:00.000Z"
  }
}
```

**POST** `/web_auth/login`

- **說明**: 使用者登入並回傳 Web Token。
- **Body**:
  - `user_name` string 必填
  - `password` string 必填
- **Response**:

```json
{
  "ok": true,
  "token": "<jwt>",
  "user": {
    "user_id": 1,
    "user_name": "demo",
    "created_at": "2026-02-10T00:00:00.000Z"
  }
}
```

**GET** `/web/auth/token-check`

- **Headers**: `Authorization: Bearer <web_token>`
- **Response**:

```json
{
  "ok": true,
  "user": { "user_id": 1 }
}
```

### 3.2 池塘（Ponds）

**GET** `/web/ponds`

- **Headers**: `Authorization: Bearer <web_token>`
- **Response**:

```json
{
  "ok": true,
  "ponds": [{ "id": 1, "pond_name": "A" }],
  "count": 1
}
```

**GET** `/web/ponds/:pondId`

- **Path**: `pondId` number
- **Response**:

```json
{ "ok": true, "pond": { "id": 1, "pond_name": "A" } }
```

**POST** `/web/ponds`

- **Body**:
  - `pond_name` string 必填
  - `pond_length` number 必填
  - `pond_width` number 必填
  - `pond_height` number 必填
  - `total_fish_count` number 選填
  - `total_fish_weight` number 選填
  - `feeding_growth_rate` number 選填（0-80）
- **Response**:

```json
{ "ok": true, "message": "池塘創建成功", "pond": { "id": 1 } }
```

**PUT** `/web/ponds/:pondId`

- **Body**: 與建立相同（皆為選填）
- **Response**:

```json
{ "ok": true, "message": "池塘更新成功", "pond": { "id": 1 } }
```

**DELETE** `/web/ponds/:pondId`

- **Response**:

```json
{ "ok": true, "message": "池塘刪除成功" }
```

**GET** `/web/ponds/:pondId/latest-data`

- **Response**:

```json
{
  "ok": true,
  "message": "成功獲取池塘最新數據",
  "data": {
    "pond": {},
    "latestSensorData": {},
    "latestDailyLog": {},
    "timestamp": "2026-02-10T00:00:00.000Z"
  }
}
```

**GET** `/web/ponds/:pondId/latest-sensor-data`

- **Response**:

```json
{
  "ok": true,
  "message": "成功獲取池塘最新感測器數據",
  "data": {},
  "timestamp": "2026-02-10T00:00:00.000Z"
}
```

**GET** `/web/ponds/:pondId/latest-daily-log`

- **Response**:

```json
{
  "ok": true,
  "message": "成功獲取池塘最新日常記錄",
  "data": {},
  "timestamp": "2026-02-10T00:00:00.000Z"
}
```

### 3.3 池塘日常記錄（Daily Logs）

**GET** `/web/ponds/:pondId/daily-logs`

- **Query**:
  - `limit` number 選填（預設 30，最大 200）
  - `offset` number 選填（預設 0）
  - `start_date` string 選填（YYYY-MM-DD）
  - `end_date` string 選填（YYYY-MM-DD）
- **Response**:

```json
{
  "ok": true,
  "logs": [{}],
  "count": 1,
  "total": 10,
  "pagination": { "limit": 30, "offset": 0, "total": 10, "hasMore": true }
}
```

**GET** `/web/ponds/:pondId/daily-logs/today`

- **Response**:

```json
{
  "ok": true,
  "message": "成功獲取今日日常記錄",
  "data": {},
  "timestamp": "2026-02-10T00:00:00.000Z"
}
```

**GET** `/web/ponds/:pondId/daily-logs/:logId`

- **Response**:

```json
{ "ok": true, "log": {} }
```

**POST** `/web/ponds/:pondId/daily-logs`

- **Body**:
  - `log_date` string 必填（YYYY-MM-DD）
  - `feeding_amount` number 選填
  - `death_count` number 選填
  - `medication_given` boolean 選填
  - `medication_type` string 選填
  - `notes` string 選填
- **Response**:

```json
{ "ok": true, "message": "日常記錄創建成功", "log": {} }
```

**PUT** `/web/ponds/:pondId/daily-logs/:logId`

- **Body**: 與建立相同（皆為選填）
- **Response**:

```json
{ "ok": true, "message": "日常記錄更新成功", "log": {} }
```

**DELETE** `/web/ponds/:pondId/daily-logs/:logId`

- **Response**:

```json
{ "ok": true, "message": "日常記錄刪除成功" }
```

### 3.4 池塘感測器（Sensors）

**GET** `/web/ponds/:pondId/sensors`

- **Response**:

```json
{ "ok": true, "sensors": [{}], "count": 1 }
```

**GET** `/web/ponds/:pondId/sensors/:sensorId`

- **Response**:

```json
{ "ok": true, "sensor": {} }
```

**POST** `/web/ponds/:pondId/sensors`

- **Body**:
  - `sensor_name` string 選填
- **Response**:

```json
{ "ok": true, "message": "感測器創建成功", "sensor": {} }
```

**PUT** `/web/ponds/:pondId/sensors/:sensorId`

- **Body**:
  - `sensor_name` string 選填
- **Response**:

```json
{ "ok": true, "message": "感測器更新成功", "sensor": {} }
```

**DELETE** `/web/ponds/:pondId/sensors/:sensorId`

- **Response**:

```json
{ "ok": true, "message": "感測器刪除成功" }
```

**POST** `/web/ponds/:pondId/sensors/:sensorId/token`

- **說明**: 生成永久且單一的感測器 Token（新 token 會覆蓋舊 token）。
- **Response**:

```json
{ "ok": true, "message": "感測器 token 生成成功", "token": "<jwt>" }
```

**GET** `/web/ponds/:pondId/sensors/:sensorId/token`

- **Response**:

```json
{
  "ok": true,
  "data": {
    "has_token": true,
    "token_issued_at": "2026-02-10T00:00:00.000Z",
    "token_revoked_at": null,
    "is_valid": true
  }
}
```

**DELETE** `/web/ponds/:pondId/sensors/:sensorId/token`

- **Response**:

```json
{ "ok": true, "message": "感測器 token 已撤銷" }
```

### 3.5 感測器資料上報（Sensor Ingest）

**POST** `/sensors/v1/include`

- **Headers**: `Authorization: Bearer <sensor_token>`
- **Body**:
  - `date` string 選填（ISO 時間字串）
  - `local_ip` string 選填
  - `ph` number 選填
  - `turbidity_raw` number 選填
  - `turbidity_percent` number 選填
  - `turbidity_ntu` number 選填
  - `hardness` number 選填
  - `ec_us_cm` number 選填
  - `orp_mv` number 選填
  - `do_mg_l` number 選填
  - `do_sat` number 選填
  - `mq135` number 選填
  - `mq137` number 選填
  - `temp_deep` number 選填
  - `temp_shallow` number 選填
  - `photo_b64` string 選填（Base64 圖片，可帶 data URL）
  - `sensorId` 可忽略（以 token 內為主）
- **Response**:

```json
{ "ok": true, "data": {} }
```

**POST** `/sensors/include`

- 與 `/sensors/v1/include` 相同。

**GET** `/sensors/auth/token-check`

- **Headers**: `Authorization: Bearer <sensor_token>`
- **Response**:

```json
{
  "ok": true,
  "user": { "user_id": 1, "pond_id": 1, "sensor_id": 1 }
}
```

### 3.6 Access 管理（Web）

**GET** `/web/access`

- **Headers**: `Authorization: Bearer <web_token>`
- **Query**:
  - `limit` number 選填（預設 30，最大 200）
  - `offset` number 選填（預設 0）
- **Response**:

```json
{
  "ok": true,
  "access_keys": [{ "id": 1, "pond_ids": [1], "sensor_ids": [10] }],
  "count": 1,
  "total": 1,
  "pagination": { "limit": 30, "offset": 0, "total": 1, "hasMore": false }
}
```

**POST** `/web/access`

- **Body**:
  - `sensor_ids` number[] 選填
  - `pond_ids` number[] 選填
  - `expires_in_minutes` number 選填（預設 30）
  - `max_requests` number 選填（預設 200）
- **Response**:

```json
{
  "ok": true,
  "message": "access 建立成功",
  "access_key": "<access_key>",
  "access": { "id": 1, "pond_ids": [1], "sensor_ids": [10] }
}
```

**GET** `/web/access/:accessId`

- **Response**:

```json
{ "ok": true, "access": { "id": 1, "pond_ids": [1], "sensor_ids": [10] } }
```

**PUT** `/web/access/:accessId`

- **Body**: 同建立（皆為選填）
- **Response**:

```json
{ "ok": true, "message": "access 更新成功", "access": { "id": 1 } }
```

**DELETE** `/web/access/:accessId`

- **Response**:

```json
{ "ok": true, "message": "access 已撤銷" }
```

### 3.7 Shared Access（公開查詢）

所有 `/shared` 路由僅支援 GET，並必須帶 `?access=<access_key>`。

**GET** `/shared/getInfo?access=<access_key>`

- **說明**: 回傳 access 可使用的池塘/感測器清單與查詢手冊。
- **Response**:

```json
{
  "ok": true,
  "access": { "id": 1, "expires_at": "2026-02-11T00:30:00.000Z" },
  "allowed": { "pond_ids": [1], "sensor_ids": [10] },
  "manual": {
    "endpoints": { "ponds": "/shared/data/ponds?access=<access_key>" }
  }
}
```

**GET** `/shared/common?access=<access_key>`

- **說明**: 常用資訊彙整（池塘與感測器清單、近 1 天感測器數據、近 30 天日常記錄、3/7 天趨勢）。
- **Response**:

```json
{
  "ok": true,
  "ponds": [{}],
  "sensors": [{}],
  "sensor_data_1d": { "granularity": "minute", "data": [{}] },
  "daily_logs_30d": [{}],
  "trends": {
    "days_3": { "granularity": "minute", "data": [{}] },
    "days_7": { "granularity": "minute", "data": [{}] }
  }
}
```

**GET** `/shared/data/ponds?access=<access_key>`

- **Query**:
  - `pond_id` 或 `pond_ids` 選填（逗號分隔）
  - `limit`、`offset`

**GET** `/shared/data/sensors?access=<access_key>`

- **Query**:
  - `sensor_id` 或 `sensor_ids` 選填（逗號分隔）
  - `pond_id` 或 `pond_ids` 選填（逗號分隔）
  - `limit`、`offset`

**GET** `/shared/data/daily-logs?access=<access_key>`

- **Query**:
  - `pond_id` 或 `pond_ids` 選填（逗號分隔）
  - `start_date`、`end_date`（YYYY-MM-DD）
  - `limit`、`offset`

**GET** `/shared/data/sensor-data?access=<access_key>`

- **Query**:
  - `sensor_id` 或 `sensor_ids` 選填（逗號分隔）
  - `pond_id` 或 `pond_ids` 選填（逗號分隔）
  - `start_date`、`end_date`（YYYY-MM-DD）
  - `granularity` 選填（`raw`/`second` 或 `minute`）
  - `limit`、`offset`

**granularity=minute** 時，回傳每分鐘彙整的 `min/max/avg/std` 欄位（例如 `ph_min`、`ph_max`、`ph_avg`、`ph_std`），新增欄位也包含 `do_mg_l_*` 與 `do_sat_*`。

### 3.8 推播通知（Web）

**POST** `/web/notifications/subscribe`

- **Headers**: `Authorization: Bearer <web_token>`
- **Body**:
  - `subscription` object 必填（瀏覽器 `PushManager.subscribe()` 回傳值）
  - `device_label` string 選填（自訂裝置名稱）
- **Response**:

```json
{
  "ok": true,
  "message": "subscription saved",
  "subscription": {
    "id": 1,
    "endpoint": "https://fcm.googleapis.com/fcm/send/xxx",
    "status": "active"
  }
}
```

**POST** `/web/notifications/unsubscribe`

- **Headers**: `Authorization: Bearer <web_token>`
- **Body**:
  - `subscription.endpoint` string 必填
- **Response**:

```json
{ "ok": true, "message": "subscription disabled" }
```

**POST** `/web/notifications/test`

- **Headers**: `Authorization: Bearer <web_token>`
- **Body**:
  - `delay_seconds` number 選填（0-3600）
  - `title` string 選填
  - `body` string 選填
  - `url` string 選填
  - `require_interaction` boolean 選填
- **Response**:

```json
{
  "ok": true,
  "message": "test notification scheduled",
  "outbox_id": 123,
  "send_after": "2026-03-15T06:00:10.000Z"
}
```

### 3.9 Grafana 告警 Webhook

**POST** `/webhook/grafana`

- **Auth（可選）**:
  - 設定 `GRAFANA_WEBHOOK_TOKEN` 時，需帶 `Authorization: Bearer <token>` 或 `X-Grafana-Token: <token>`
- **Body**: Grafana Unified Alerting payload（包含 `alerts[]`）
- **Response**:

```json
{
  "ok": true,
  "received": 1,
  "enqueued": 1,
  "skipped": 0
}
```

**建議 labels**:

- `user_id`（優先），或 `pond_id`（後端會轉換為 user）
- `severity`（例如 `critical`）
- `rule_uid`

## 4. 認證與錯誤

- **401**: Token 缺失或無效
- **403**: Token 被撤銷或驗證失敗
- **404**: 資源不存在或無權限
- **409**: 資源衝突（如重複日誌日期）
- **500**: 伺服器錯誤

## 5. 備註

- 感測器 Token 為永久單一 Token，重新生成會覆蓋舊 Token。
- 撤銷 Token 後，感測器端所有請求會被拒絕。
- `/sensors/include` 會忽略 body 內的 `sensorId/pond_id/user_id`，以 token 為準。
