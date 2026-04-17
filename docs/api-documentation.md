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
| 18  | `/web/daily-log-options`                     | GET    | 取得日常記錄選項                 | Web              |
| 19  | `/web/daily-log-options`                     | POST   | 建立日常記錄選項                 | Web              |
| 20  | `/web/daily-log-options/:optionId`           | PATCH  | 更新日常記錄選項                 | Web              |
| 21  | `/web/ponds/:pondId/sensors`                 | GET    | 池塘感測器列表                   | Web              |
| 22  | `/web/ponds/:pondId/sensors/:sensorId`       | GET    | 感測器詳情                       | Web              |
| 23  | `/web/ponds/:pondId/sensors`                 | POST   | 建立感測器                       | Web              |
| 24  | `/web/ponds/:pondId/sensors/:sensorId`       | PUT    | 更新感測器                       | Web              |
| 25  | `/web/ponds/:pondId/sensors/:sensorId`       | DELETE | 刪除感測器                       | Web              |
| 26  | `/web/ponds/:pondId/sensors/:sensorId/token` | POST   | 生成感測器 Token（永久、單一）   | Web              |
| 27  | `/web/ponds/:pondId/sensors/:sensorId/token` | GET    | 感測器 Token 狀態                | Web              |
| 28  | `/web/ponds/:pondId/sensors/:sensorId/token` | DELETE | 撤銷感測器 Token                 | Web              |
| 29  | `/sensors/v1/include`                        | POST   | 感測器上報（v1）                 | Sensor           |
| 30  | `/sensors/include`                           | POST   | 感測器上報                       | Sensor           |
| 31  | `/sensors/maintainRecord`                    | POST   | 感測器校正紀錄上報               | Sensor           |
| 32  | `/sensors/crashReport`                       | POST   | 感測器 Crash Report 上報         | Sensor           |
| 33  | `/sensors/auth/token-check`                  | GET    | Sensor Token 檢查                | Sensor           |
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
| 44  | `/web/ai/health`                             | GET    | AI Helper 健康檢查代理           | Web              |
| 45  | `/web/ai/sessions`                           | GET    | 取得 AI 對話 Session 列表        | Web              |
| 46  | `/web/ai/sessions/:sessionId`                | GET    | 取得 AI 對話 Session 詳情        | Web              |
| 47  | `/web/ai/sessions/:sessionId`                | DELETE | 刪除 AI 對話 Session             | Web              |
| 48  | `/web/ai/chat/stream`                        | POST   | AI 對話串流代理                  | Web              |

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
    "latestDailyLog": {
      "id": 12,
      "pond_id": 2,
      "feeding_amount": 10.5,
      "death_count": 1,
      "notes": "今日觀察正常",
      "log_date": "2026-04-14T16:00:00.000Z",
      "created_at": "2026-04-15T10:00:00.000Z",
      "updated_at": "2026-04-15T10:00:00.000Z",
      "items": [
        {
          "id": 101,
          "catalog_id": 8,
          "item_name_snapshot": "益生菌",
          "category": "feed_additive",
          "dosage": "250.0000",
          "unit": "g",
          "created_at": "2026-04-15T10:00:00.000Z",
          "updated_at": "2026-04-15T10:00:00.000Z"
        }
      ]
    },
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
  "data": {
    "id": 12,
    "pond_id": 2,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "今日觀察正常",
    "log_date": "2026-04-14T16:00:00.000Z",
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:00:00.000Z",
    "items": [
      {
        "id": 101,
        "catalog_id": 8,
        "item_name_snapshot": "益生菌",
        "category": "feed_additive",
        "dosage": "250.0000",
        "unit": "g",
        "created_at": "2026-04-15T10:00:00.000Z",
        "updated_at": "2026-04-15T10:00:00.000Z"
      }
    ]
  },
  "timestamp": "2026-02-10T00:00:00.000Z"
}
```

### 3.3 池塘日常記錄（Daily Logs）

日常記錄目前採用主檔 + `items` 明細模式：

- `pond_daily_logs`
  - `feeding_amount`
  - `death_count`
  - `notes`
  - `log_date`
- `daily_log_items`
  - `category`
  - `catalog_id`
  - `item_name_snapshot`
  - `dosage`
  - `unit`

`items[].category` 目前允許：

- `feed_additive`
- `pond_medication`
- `maintenance_material`

日常記錄物件範例：

```json
{
  "id": 12,
  "pond_id": 2,
  "feeding_amount": 10.5,
  "death_count": 1,
  "notes": "今日觀察正常",
  "log_date": "2026-04-14T16:00:00.000Z",
  "created_at": "2026-04-15T10:00:00.000Z",
  "updated_at": "2026-04-15T10:00:00.000Z",
  "items": [
    {
      "id": 101,
      "catalog_id": 8,
      "item_name_snapshot": "益生菌",
      "category": "feed_additive",
      "dosage": "250.0000",
      "unit": "g",
      "created_at": "2026-04-15T10:00:00.000Z",
      "updated_at": "2026-04-15T10:00:00.000Z"
    }
  ]
}
```

日期格式注意：

- Request 的 `log_date` 使用 `YYYY-MM-DD`
- Response 的 `log_date` 會依實際 API 序列化成 ISO 8601 timestamp
  - 例如送出 `2026-04-15`，回來可能是 `2026-04-14T16:00:00.000Z`

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
  "logs": [
    {
      "id": 12,
      "pond_id": 2,
      "feeding_amount": 10.5,
      "death_count": 1,
      "notes": "今日觀察正常",
      "log_date": "2026-04-14T16:00:00.000Z",
      "created_at": "2026-04-15T10:00:00.000Z",
      "updated_at": "2026-04-15T10:00:00.000Z",
      "items": [
        {
          "id": 101,
          "catalog_id": 8,
          "item_name_snapshot": "益生菌",
          "category": "feed_additive",
          "dosage": "250.0000",
          "unit": "g",
          "created_at": "2026-04-15T10:00:00.000Z",
          "updated_at": "2026-04-15T10:00:00.000Z"
        }
      ]
    }
  ],
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
  "data": {
    "id": 12,
    "pond_id": 2,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "今日觀察正常",
    "log_date": "2026-04-14T16:00:00.000Z",
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:00:00.000Z",
    "items": [
      {
        "id": 101,
        "catalog_id": 8,
        "item_name_snapshot": "益生菌",
        "category": "feed_additive",
        "dosage": "250.0000",
        "unit": "g",
        "created_at": "2026-04-15T10:00:00.000Z",
        "updated_at": "2026-04-15T10:00:00.000Z"
      }
    ]
  },
  "timestamp": "2026-02-10T00:00:00.000Z"
}
```

**GET** `/web/ponds/:pondId/daily-logs/:logId`

- **Response**:

```json
{
  "ok": true,
  "log": {
    "id": 12,
    "pond_id": 2,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "今日觀察正常",
    "log_date": "2026-04-14T16:00:00.000Z",
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:00:00.000Z",
    "items": [
      {
        "id": 101,
        "catalog_id": 8,
        "item_name_snapshot": "益生菌",
        "category": "feed_additive",
        "dosage": "250.0000",
        "unit": "g",
        "created_at": "2026-04-15T10:00:00.000Z",
        "updated_at": "2026-04-15T10:00:00.000Z"
      }
    ]
  }
}
```

**POST** `/web/ponds/:pondId/daily-logs`

- **Body**:
  - `log_date` string 必填（YYYY-MM-DD）
  - `feeding_amount` number 選填
  - `death_count` number 選填
  - `notes` string 選填
  - `items` array 選填
- `items[]`：
  - `category` string 必填
  - `catalog_id` number 選填
  - `item_name_snapshot` string 選填
  - `dosage` number 選填
  - `unit` string 選填
- **Response**:

```json
{
  "ok": true,
  "message": "日常記錄創建成功",
  "log": {
    "id": 12,
    "pond_id": 2,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "今日觀察正常",
    "log_date": "2026-04-14T16:00:00.000Z",
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:00:00.000Z",
    "items": [
      {
        "id": 101,
        "catalog_id": 8,
        "item_name_snapshot": "益生菌",
        "category": "feed_additive",
        "dosage": "250.0000",
        "unit": "g",
        "created_at": "2026-04-15T10:00:00.000Z",
        "updated_at": "2026-04-15T10:00:00.000Z"
      }
    ]
  }
}
```

**PUT** `/web/ponds/:pondId/daily-logs/:logId`

- **Body**: 與建立相同（皆為選填）
- **Response**:

```json
{
  "ok": true,
  "message": "日常記錄更新成功",
  "log": {
    "id": 12,
    "pond_id": 2,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "今日觀察正常",
    "log_date": "2026-04-14T16:00:00.000Z",
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:10:00.000Z",
    "items": [
      {
        "id": 101,
        "catalog_id": 8,
        "item_name_snapshot": "益生菌",
        "category": "feed_additive",
        "dosage": "250.0000",
        "unit": "g",
        "created_at": "2026-04-15T10:10:00.000Z",
        "updated_at": "2026-04-15T10:10:00.000Z"
      }
    ]
  }
}
```

**DELETE** `/web/ponds/:pondId/daily-logs/:logId`

- **Response**:

```json
{ "ok": true, "message": "日常記錄刪除成功" }
```

### 3.4 日常記錄選項（Daily Log Options）

**GET** `/web/daily-log-options`

- **Headers**: `Authorization: Bearer <web_token>`
- **Query**:
  - `category` string 選填
- **Response**:

```json
{
  "ok": true,
  "options": [
    {
      "id": 1,
      "category": "feed_additive",
      "name": "益生菌",
      "default_unit": "g",
      "scope": "global",
      "user_id": null,
      "is_active": true,
      "created_at": "2026-04-15T10:00:00.000Z",
      "updated_at": "2026-04-15T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

**POST** `/web/daily-log-options`

- **Headers**: `Authorization: Bearer <web_token>`
- **Body**:
  - `category` string 必填
  - `name` string 必填
  - `default_unit` string 選填
- **Response**:

```json
{
  "ok": true,
  "message": "日常記錄選項建立成功",
  "option": {
    "id": 9,
    "category": "pond_medication",
    "name": "優碘",
    "default_unit": "ml",
    "scope": "user",
    "user_id": 3,
    "is_active": true,
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:00:00.000Z"
  }
}
```

**PATCH** `/web/daily-log-options/:optionId`

- **Headers**: `Authorization: Bearer <web_token>`
- **Body**:
  - `name` string 選填
  - `default_unit` string 選填
  - `is_active` boolean 選填
- **Response**:

```json
{
  "ok": true,
  "message": "日常記錄選項更新成功",
  "option": {
    "id": 9,
    "category": "pond_medication",
    "name": "優碘",
    "default_unit": "ml",
    "scope": "user",
    "user_id": 3,
    "is_active": false,
    "created_at": "2026-04-15T10:00:00.000Z",
    "updated_at": "2026-04-15T10:10:00.000Z"
  }
}
```

### 3.5 池塘感測器（Sensors）

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

### 3.6 感測器資料上報（Sensor Ingest）

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

**POST** `/sensors/maintainRecord`

- **Headers**: `Authorization: Bearer <sensor_token>`
- **Body**:
  - `date` string 選填（ISO 時間字串）
  - `local_ip` string 選填
  - `calibration_time` string 選填（ISO 時間字串）
  - `calibration_start` string 選填（ISO 時間字串）
  - `before` object 選填
  - `after` object 選填
- **說明**:
  - body 內的 `sensorId/sensor_id/pond_id/user_id` 會以 token 內容為準
  - `before` / `after` 會以 JSON 型態保存
- **Response**:

```json
{
  "ok": true,
  "message": "maintenance record saved",
  "record": {
    "sensor_id": 1,
    "pond_id": 2,
    "user_id": 3
  }
}
```

**POST** `/sensors/crashReport`

- **Headers**: `Authorization: Bearer <sensor_token>`
- **Body**:
  - `date` string 選填（ISO 時間字串）
  - `local_ip` string 選填
  - `msg_err` string 必填
  - `log_text` string 選填
- **說明**:
  - body 內的 `sensorId/sensor_id/pond_id/user_id` 會以 token 內容為準
  - `msg_err` 與 `log_text` 會另外存入 crash report，不會寫進 `sensor_data`
- **Response**:

```json
{
  "ok": true,
  "message": "crash report saved",
  "report": {
    "sensor_id": 1,
    "pond_id": 2,
    "user_id": 3
  }
}
```

**GET** `/sensors/auth/token-check`

- **Headers**: `Authorization: Bearer <sensor_token>`
- **Response**:

```json
{
  "ok": true,
  "user": { "user_id": 1, "pond_id": 1, "sensor_id": 1 }
}
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
- **Response**:

```json
{
  "ok": true,
  "logs": [
    {
      "id": 12,
      "pond_id": 2,
      "feeding_amount": 10.5,
      "death_count": 1,
      "notes": "今日觀察正常",
      "log_date": "2026-04-14T16:00:00.000Z",
      "created_at": "2026-04-15T10:00:00.000Z",
      "updated_at": "2026-04-15T10:00:00.000Z",
      "items": [
        {
          "id": 101,
          "catalog_id": 8,
          "item_name_snapshot": "益生菌",
          "category": "feed_additive",
          "dosage": "250.0000",
          "unit": "g",
          "created_at": "2026-04-15T10:00:00.000Z",
          "updated_at": "2026-04-15T10:00:00.000Z"
        }
      ]
    }
  ],
  "count": 1,
  "total": 18,
  "pagination": { "limit": 30, "offset": 0, "total": 18, "hasMore": false }
}
```

- `log_date` 回傳格式和 Web daily logs 相同，會是 ISO 8601 timestamp，不是單純 `YYYY-MM-DD`

**GET** `/shared/data/sensor-data?access=<access_key>`

- **Query**:
  - `sensor_id` 或 `sensor_ids` 選填（逗號分隔）
  - `pond_id` 或 `pond_ids` 選填（逗號分隔）
  - `start_date`、`end_date`（YYYY-MM-DD）
  - `granularity` 選填（`raw`/`second` 或 `minute`）
  - `limit`、`offset`

**granularity=minute** 時，回傳每分鐘彙整的 `min/max/avg/std` 欄位（例如 `ph_min`、`ph_max`、`ph_avg`、`ph_std`）。

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

### 3.10 AI Assistant（Web）

**GET** `/web/ai/health`

- **Headers**: `Authorization: Bearer <web_token>`
- **說明**: 由 backend 代理呼叫 AI Helper 的 `/api/system/health`。
- **Response**:

```json
{
  "success": true,
  "data": {
    "main_db": true,
    "ai_db": true,
    "redis": true
  }
}
```

**GET** `/web/ai/sessions`

- **Headers**: `Authorization: Bearer <web_token>`
- **Query**:
  - `limit` integer 選填，預設 `50`，最大 `200`
- **說明**: 取得目前登入 user 的 AI 對話 Session 列表。
- **Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "session_id": "demo-session",
      "user_id": 3,
      "pond_id": 2,
      "title": "最近這個魚池溶氧偏低，可能原因是什麼？",
      "created_at": "2026-04-16T01:10:00.000Z",
      "updated_at": "2026-04-16T01:12:00.000Z",
      "message_count": 2,
      "last_message_at": "2026-04-16T01:12:00.000Z"
    }
  ]
}
```

**GET** `/web/ai/sessions/:sessionId`

- **Headers**: `Authorization: Bearer <web_token>`
- **說明**: 取得指定 AI 對話 Session 與訊息紀錄，只允許 session 所屬 user 存取。
- **Response**:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": 1,
      "session_id": "demo-session",
      "user_id": 3,
      "pond_id": 2,
      "title": "最近這個魚池溶氧偏低，可能原因是什麼？",
      "summary": "最近主要在討論魚池風險與近期水質判讀。",
      "summary_json": {
        "version": 1,
        "current_goal": "分析魚池近期風險",
        "recent_topics": ["魚池", "風險"],
        "time_preferences": {}
      },
      "created_at": "2026-04-16T01:10:00.000Z",
      "updated_at": "2026-04-16T01:12:00.000Z"
    },
    "messages": [
      {
        "id": 1,
        "session_id": "demo-session",
        "role": "user",
        "message": "最近這個魚池溶氧偏低，可能原因是什麼？",
        "metadata": {
          "request_id": "7f8732a0-1111-2222-3333-444444444444"
        },
        "created_at": "2026-04-16T01:10:00.000Z"
      },
      {
        "id": 2,
        "session_id": "demo-session",
        "role": "assistant",
        "message": "目前資料顯示魚池缺少即時水質資料，建議先補足感測資料再判讀。",
        "metadata": {
          "request_id": "7f8732a0-1111-2222-3333-444444444444",
          "pond_id": 2,
          "citations": []
        },
        "created_at": "2026-04-16T01:12:00.000Z"
      }
    ]
  }
}
```

**DELETE** `/web/ai/sessions/:sessionId`

- **Headers**: `Authorization: Bearer <web_token>`
- **說明**: 刪除指定 AI 對話 Session 與其訊息紀錄，只允許 session 所屬 user 操作。
- **Response**:

```json
{
  "success": true,
  "message": "對話刪除成功"
}
```

**POST** `/web/ai/chat/stream`

- **Headers**: `Authorization: Bearer <web_token>`
- `Content-Type: application/json`
- **Body**:
  - `pond_id` integer 必填
  - `session_id` string 選填
  - `message` string 必填
  - `use_rag` boolean 選填，預設 `true`
  - `enable_web_search` boolean 選填，預設 `false`
  - `enable_assistant_ui` boolean 選填，預設 `true`
  - `time_window_from` string 選填，ISO 8601 時間字串
  - `time_window_to` string 選填，ISO 8601 時間字串
  - `compare_previous_window` boolean 選填，預設 `false`
- **規則**:
  - backend 會先檢查 `pond_id` 是否屬於目前登入 user。
  - backend 會簽發短效 JWT 後再轉發到 AI Helper。
  - 回應為 `text/event-stream`，事件格式會原樣透傳。
  - `enable_web_search` 是否生效仍取決於 AI Helper 目前使用的模型 provider。
  - `enable_assistant_ui=false` 時，AI Helper 會改用較純文字的回覆風格，不強制 assistant-ui / Markdown 風格。
  - `time_window_from/time_window_to` 用於限制分析的資料時間範圍。
  - `compare_previous_window=true` 時，AI Helper 會嘗試比較前一個等長時間窗。
- **SSE Event**:
  - `start`
  - `source`
  - `token`
  - `done`
  - `error`

**Request 範例**:

```json
{
  "pond_id": 2,
  "session_id": "demo-session",
  "message": "最近這個魚池溶氧偏低，可能原因是什麼？",
  "use_rag": true,
  "enable_web_search": false,
  "enable_assistant_ui": true,
  "time_window_from": "2026-04-10T00:00:00+08:00",
  "time_window_to": "2026-04-12T23:59:59+08:00",
  "compare_previous_window": false
}
```

**Response Header**:

- `Content-Type: text/event-stream; charset=utf-8`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`

**SSE 範例**:

```text
event: start
data: {"request_id":"aef00ebb-4133-478d-8460-2de312b6215b","session_id":"demo-session"}

event: source
data: {"pond_name":"1","paper_count":12,"citations":[{"reference_no":1,"paper_source_id":2,"chunk_id":410,"chunk_index":12,"title":"A hybrid intelligence model for predicting dissolved oxygen in aquaculture water","doi":null,"source_url":"https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2023.1126556/pdf","published_at":null,"distance":0.649005,"excerpt":"C13 2 2 (2) In the above formula...","label":"[1] A hybrid intelligence model for predicting dissolved oxygen in aquaculture water"}],"web_search_sources":[],"rag_retrieval":{"evidence_sufficient":true},"use_rag":true,"enable_web_search":false,"enable_assistant_ui":true,"time_window_query":{"requested":false,"selection_required":false},"time_window_suggestions":[],"conversation_history_count":0,"conversation_history_stats":{},"session_summary_present":true,"session_summary_json_version":1,"session_summary_goal":"分析魚池近期風險","session_summary_recent_topics":["魚池","風險"],"session_summary_time_preferences":{}}

event: token
data: {"content":"您好"}

event: token
data: {"content":"！"}

event: done
data: {"request_id":"aef00ebb-4133-478d-8460-2de312b6215b","session_id":"demo-session"}
```

- `start`：建立請求與 session 後發送
- `source`：回傳本次檢索到的 pond 名稱、論文數量、citation 清單、web search 來源、RAG 檢索摘要、時間窗資訊與對話記憶摘要
- `token`：逐 token 串流回答內容
- `done`：回答完成
- `error`：中途失敗時回傳錯誤事件

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
