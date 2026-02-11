# 養殖系統 API 手冊 V1.0

## 1. 概述

- **認證方式**: Bearer Token
- **Token 類型**:
  - **Web Token**: 由 `/web_auth/login` 或 `/web_auth/register` 取得，供後台/管理端 API 使用。
  - **Sensor Token**: 由 `/web/ponds/:pondId/sensors/:sensorId/token` 生成，供感測器上報資料。
- **內容格式**: `Content-Type: application/json`

## 2. API 列表

| No. | 介面 | 方法 | 說明 | 認證 |
| --- | --- | --- | --- | --- |
| 1 | `/web_auth/register` | POST | 使用者註冊 | 無 |
| 2 | `/web_auth/login` | POST | 使用者登入 | 無 |
| 3 | `/web/auth/token-check` | GET | Web Token 檢查 | Web |
| 4 | `/web/ponds` | GET | 取得使用者池塘列表 | Web |
| 5 | `/web/ponds/:pondId` | GET | 取得池塘詳情 | Web |
| 6 | `/web/ponds` | POST | 建立池塘 | Web |
| 7 | `/web/ponds/:pondId` | PUT | 更新池塘 | Web |
| 8 | `/web/ponds/:pondId` | DELETE | 刪除池塘 | Web |
| 9 | `/web/ponds/:pondId/latest-data` | GET | 池塘最新數據（感測器+日誌） | Web |
| 10 | `/web/ponds/:pondId/latest-sensor-data` | GET | 池塘最新感測器數據 | Web |
| 11 | `/web/ponds/:pondId/latest-daily-log` | GET | 池塘最新日常記錄 | Web |
| 12 | `/web/ponds/:pondId/daily-logs` | GET | 池塘日常記錄列表 | Web |
| 13 | `/web/ponds/:pondId/daily-logs/today` | GET | 今日日常記錄 | Web |
| 14 | `/web/ponds/:pondId/daily-logs/:logId` | GET | 日常記錄詳情 | Web |
| 15 | `/web/ponds/:pondId/daily-logs` | POST | 建立日常記錄 | Web |
| 16 | `/web/ponds/:pondId/daily-logs/:logId` | PUT | 更新日常記錄 | Web |
| 17 | `/web/ponds/:pondId/daily-logs/:logId` | DELETE | 刪除日常記錄 | Web |
| 18 | `/web/ponds/:pondId/sensors` | GET | 池塘感測器列表 | Web |
| 19 | `/web/ponds/:pondId/sensors/:sensorId` | GET | 感測器詳情 | Web |
| 20 | `/web/ponds/:pondId/sensors` | POST | 建立感測器 | Web |
| 21 | `/web/ponds/:pondId/sensors/:sensorId` | PUT | 更新感測器 | Web |
| 22 | `/web/ponds/:pondId/sensors/:sensorId` | DELETE | 刪除感測器 | Web |
| 23 | `/web/ponds/:pondId/sensors/:sensorId/token` | POST | 生成感測器 Token（永久、單一） | Web |
| 24 | `/web/ponds/:pondId/sensors/:sensorId/token` | GET | 感測器 Token 狀態 | Web |
| 25 | `/web/ponds/:pondId/sensors/:sensorId/token` | DELETE | 撤銷感測器 Token | Web |
| 26 | `/sensors/v1/include` | POST | 感測器上報（v1） | Sensor |
| 27 | `/sensors/include` | POST | 感測器上報 | Sensor |
| 28 | `/sensors/auth/token-check` | GET | Sensor Token 檢查 | Sensor |

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
  "ponds": [ { "id": 1, "pond_name": "A" } ],
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
  "logs": [ {} ],
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
{ "ok": true, "sensors": [ {} ], "count": 1 }
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
