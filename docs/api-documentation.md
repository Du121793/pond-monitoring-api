# 養殖系統 API 手冊

## 1. 概述

- 認證方式：
  - Web API：`Authorization: Bearer <web_token>`
  - Sensor API：`Authorization: Bearer <sensor_token>`
  - Shared API：`?access=<access_key>`
- 內容格式：`Content-Type: application/json`
- 主要 Token 類型：
  - Web Token：由 `/web_auth/register`、`/web_auth/login` 取得
  - Sensor Token：由 `/web/ponds/:pondId/sensors/:sensorId/token` 生成
  - Grafana Bridge Cookie：由 `/web_auth/grafana_bootstrap` 寫入 `grafana_bridge`

## 2. API 列表

| No. | 介面 | 方法 | 說明 | 認證 |
| --- | --- | --- | --- | --- |
| 1 | `/web_auth/register` | `POST` | 使用者註冊 | 無 |
| 2 | `/web_auth/login` | `POST` | 使用者登入 | 無 |
| 3 | `/web_auth/grafana_bootstrap` | `POST` | 產生 Grafana bridge cookie | Web |
| 4 | `/web/auth/token-check` | `GET` | Web Token 檢查 | Web |
| 5 | `/web/ponds` | `GET` | 取得使用者池塘列表 | Web |
| 6 | `/web/ponds/:pondId` | `GET` | 取得池塘詳情 | Web |
| 7 | `/web/ponds` | `POST` | 建立池塘 | Web |
| 8 | `/web/ponds/:pondId` | `PUT` | 更新池塘 | Web |
| 9 | `/web/ponds/:pondId` | `DELETE` | 刪除池塘 | Web |
| 10 | `/web/ponds/:pondId/latest-data` | `GET` | 池塘最新資料（感測器 + 日誌） | Web |
| 11 | `/web/ponds/:pondId/latest-sensor-data` | `GET` | 池塘最新感測器資料 | Web |
| 12 | `/web/ponds/:pondId/latest-daily-log` | `GET` | 池塘最新每日紀錄 | Web |
| 13 | `/web/ponds/:pondId/daily-logs` | `GET` | 每日紀錄列表 | Web |
| 14 | `/web/ponds/:pondId/daily-logs/today` | `GET` | 今日每日紀錄 | Web |
| 15 | `/web/ponds/:pondId/daily-logs/:logId` | `GET` | 單筆每日紀錄 | Web |
| 16 | `/web/ponds/:pondId/daily-logs` | `POST` | 建立每日紀錄 | Web |
| 17 | `/web/ponds/:pondId/daily-logs/:logId` | `PUT` | 更新每日紀錄 | Web |
| 18 | `/web/ponds/:pondId/daily-logs/:logId` | `DELETE` | 刪除每日紀錄 | Web |
| 19 | `/web/daily-log-options` | `GET` | 取得每日紀錄選項庫 | Web |
| 20 | `/web/daily-log-options` | `POST` | 建立自訂每日紀錄選項 | Web |
| 21 | `/web/daily-log-options/:optionId` | `PATCH` | 更新自訂每日紀錄選項 | Web |
| 22 | `/web/ponds/:pondId/sensors` | `GET` | 池塘感測器列表 | Web |
| 23 | `/web/ponds/:pondId/sensors/:sensorId` | `GET` | 感測器詳情 | Web |
| 24 | `/web/ponds/:pondId/sensors` | `POST` | 建立感測器 | Web |
| 25 | `/web/ponds/:pondId/sensors/:sensorId` | `PUT` | 更新感測器 | Web |
| 26 | `/web/ponds/:pondId/sensors/:sensorId` | `DELETE` | 刪除感測器 | Web |
| 27 | `/web/ponds/:pondId/sensors/:sensorId/token` | `POST` | 生成感測器 Token | Web |
| 28 | `/web/ponds/:pondId/sensors/:sensorId/token` | `GET` | 感測器 Token 狀態 | Web |
| 29 | `/web/ponds/:pondId/sensors/:sensorId/token` | `DELETE` | 撤銷感測器 Token | Web |
| 30 | `/sensors/v1/include` | `POST` | 感測器上報（v1） | Sensor |
| 31 | `/sensors/include` | `POST` | 感測器上報 | Sensor |
| 32 | `/sensors/maintainRecord` | `POST` | 感測器校正紀錄上報 | Sensor |
| 33 | `/sensors/crashReport` | `POST` | 感測器 Crash 報告上報 | Sensor |
| 34 | `/sensors/auth/token-check` | `GET` | Sensor Token 檢查 | Sensor |
| 40 | `/shared/getInfo` | `GET` | Access 使用手冊與可用資源 | Access |
| 41 | `/shared/common` | `GET` | 常用資訊（清單 / 近 1 天 / 近 30 天 / 趨勢） | Access |
| 42 | `/shared/data/ponds` | `GET` | Access 查詢池塘 | Access |
| 43 | `/shared/data/sensors` | `GET` | Access 查詢感測器 | Access |
| 44 | `/shared/data/daily-logs` | `GET` | Access 查詢每日紀錄 | Access |
| 45 | `/shared/data/sensor-data` | `GET` | Access 查詢感測器資料 | Access |
| 46 | `/web/notifications/subscribe` | `POST` | 訂閱推播通知 | Web |
| 47 | `/web/notifications/unsubscribe` | `POST` | 取消推播通知 | Web |
| 48 | `/web/notifications/test` | `POST` | 測試推播通知 | Web |
| 49 | `/webhook/grafana` | `POST` | Grafana 告警 Webhook | 無（可選 Token） |

## 3. 介面詳情

### 3.1 Web Auth

**POST** `/web_auth/register`

- 說明：註冊新使用者並回傳 Web Token。
- Body：
  - `user_name` string 必填
  - `password` string 必填
- Response：

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

- 說明：使用者登入並回傳 Web Token。
- Body：
  - `user_name` string 必填
  - `password` string 必填
- Response：

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

**POST** `/web_auth/grafana_bootstrap`

- Headers：`Authorization: Bearer <web_token>`
- 說明：驗證 Web Token 後，寫入 `grafana_bridge` cookie，供 `/grafana` proxy 使用。
- Cookie：
  - 名稱：`grafana_bridge`
  - `httpOnly: true`
  - `secure: true`
  - `sameSite: lax`
  - `path: /api/grafana`
  - `maxAge: 10 minutes`
- Response：

```json
{
  "ok": true
}
```

**GET** `/web/auth/token-check`

- Headers：`Authorization: Bearer <web_token>`
- Response：

```json
{
  "ok": true,
  "user": {
    "user_id": 1
  }
}
```

### 3.2 池塘（Ponds）

**GET** `/web/ponds`

- Response：

```json
{
  "ok": true,
  "ponds": [{ "id": 1, "pond_name": "A" }],
  "count": 1
}
```

**GET** `/web/ponds/:pondId`

- Response：

```json
{
  "ok": true,
  "pond": { "id": 1, "pond_name": "A" }
}
```

**POST** `/web/ponds`

- Body：
  - `pond_name` string 必填
  - `pond_length` number 必填
  - `pond_width` number 必填
  - `pond_height` number 必填
  - `total_fish_count` number 選填
  - `total_fish_weight` number 選填
  - `feeding_growth_rate` number 選填（0-80）

**PUT** `/web/ponds/:pondId`

- Body：與建立相同，全部皆為選填

**DELETE** `/web/ponds/:pondId`

- Response：

```json
{
  "ok": true,
  "message": "池塘刪除成功"
}
```

**GET** `/web/ponds/:pondId/latest-data`

- Response：

```json
{
  "ok": true,
  "message": "取得池塘最新資料成功",
  "data": {
    "pond": {},
    "latestSensorData": {},
    "latestDailyLog": {},
    "timestamp": "2026-04-15T10:15:00.000Z"
  }
}
```

**GET** `/web/ponds/:pondId/latest-sensor-data`

- Response：

```json
{
  "ok": true,
  "message": "取得池塘最新感測器資料成功",
  "data": {},
  "timestamp": "2026-04-15T10:15:00.000Z"
}
```

**GET** `/web/ponds/:pondId/latest-daily-log`

- Response：

```json
{
  "ok": true,
  "message": "取得池塘最新每日紀錄成功",
  "data": {},
  "timestamp": "2026-04-15T10:15:00.000Z"
}
```

### 3.3 每日紀錄（Daily Logs）

#### 3.3.1 資料模型

目前每日紀錄分成兩層：

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

`items[].category` 允許值：

- `feed_additive`
- `pond_medication`
- `maintenance_material`

#### 3.3.2 每日紀錄範例

```json
{
  "id": 12,
  "pond_id": 3,
  "feeding_amount": 10.5,
  "death_count": 1,
  "notes": "下午巡池正常",
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

- 備註：
  - Request 的 `log_date` 仍使用 `YYYY-MM-DD`。
  - Response 的 `log_date` 會依目前 API 實際行為序列化為 ISO 8601 timestamp，例如 `2026-04-15` 可能回傳為 `2026-04-14T16:00:00.000Z`。

**GET** `/web/ponds/:pondId/daily-logs`

- Query：
  - `limit` number 選填，預設 `30`，最大 `200`
  - `offset` number 選填，預設 `0`
  - `start_date` string 選填，格式 `YYYY-MM-DD`
  - `end_date` string 選填，格式 `YYYY-MM-DD`
- Response：

```json
{
  "ok": true,
  "logs": [
    {
      "id": 12,
      "pond_id": 3,
      "feeding_amount": 10.5,
      "death_count": 1,
      "notes": "下午巡池正常",
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
  "pagination": {
    "limit": 30,
    "offset": 0,
    "total": 18,
    "hasMore": false
  }
}
```

**GET** `/web/ponds/:pondId/daily-logs/today`

- Response：

```json
{
  "ok": true,
  "data": {
    "id": 12,
    "pond_id": 3,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "下午巡池正常",
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
  "timestamp": "2026-04-15T10:05:00.000Z"
}
```

**GET** `/web/ponds/:pondId/daily-logs/:logId`

- Response：

```json
{
  "ok": true,
  "log": {
    "id": 12,
    "pond_id": 3,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "下午巡池正常",
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

- Body：
  - `log_date` string 必填，格式 `YYYY-MM-DD`
  - `feeding_amount` number 選填，必須 `>= 0`
  - `death_count` integer 選填，必須 `>= 0`
  - `notes` string 選填
  - `items` array 選填
- `items[]` 欄位：
  - `category` string 必填
  - `catalog_id` number 選填
  - `item_name_snapshot` string 選填
  - `dosage` number 選填，必須 `>= 0`
  - `unit` string 選填

```json
{
  "log_date": "2026-04-15",
  "feeding_amount": 10.5,
  "death_count": 1,
  "notes": "下午巡池正常",
  "items": [
    {
      "category": "feed_additive",
      "catalog_id": 8,
      "dosage": 250,
      "unit": "g"
    },
    {
      "category": "maintenance_material",
      "item_name_snapshot": "自訂保養資材",
      "dosage": 2.5,
      "unit": "kg"
    }
  ]
}
```

- Response：

```json
{
  "ok": true,
  "message": "每日紀錄建立成功",
  "log": {
    "id": 12,
    "pond_id": 3,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "下午巡池正常",
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

- Body：與建立相同，皆為選填。
- 備註：如果有帶 `items`，會以本次內容覆蓋原本的 `daily_log_items`。

```json
{
  "ok": true,
  "message": "每日紀錄更新成功",
  "log": {
    "id": 12,
    "pond_id": 3,
    "feeding_amount": 10.5,
    "death_count": 1,
    "notes": "下午巡池正常",
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

- Response：

```json
{
  "ok": true,
  "message": "每日紀錄刪除成功"
}
```

#### 3.3.3 舊欄位相容說明

目前後端仍暫時支援舊前端送 `medication_type`。  
若 Body 未提供 `items`，但有提供 `medication_type`，後端會自動轉成一筆：

- `category = "pond_medication"`
- `item_name_snapshot = medication_type`

這只是過渡相容，建議新前端改用 `items`。

### 3.4 每日紀錄選項庫（Daily Log Options）

選項庫會回傳：

- global 預設選項
- 目前登入使用者自己建立的選項

**GET** `/web/daily-log-options`

- Query：
  - `category` string 選填
- Response：

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
      "is_active": true
    }
  ],
  "count": 1
}
```

**POST** `/web/daily-log-options`

- Body：
  - `category` string 必填
  - `name` string 必填
  - `default_unit` string 選填

```json
{
  "category": "pond_medication",
  "name": "自訂藥物",
  "default_unit": "ml"
}
```

**PATCH** `/web/daily-log-options/:optionId`

- Body：
  - `name` string 選填
  - `default_unit` string 選填
  - `is_active` boolean 選填
- Response：

```json
{
  "ok": true,
  "message": "自訂選項更新成功",
  "option": {}
}
```

### 3.5 池塘感測器（Sensors）

**GET** `/web/ponds/:pondId/sensors`

- Response：

```json
{
  "ok": true,
  "sensors": [{}],
  "count": 1
}
```

**POST** `/web/ponds/:pondId/sensors`

- Body：
  - `sensor_name` string 選填
- Response：

```json
{
  "ok": true,
  "message": "感測器建立成功",
  "sensor": {}
}
```

**GET** `/web/ponds/:pondId/sensors/:sensorId`

- Response：

```json
{
  "ok": true,
  "sensor": {}
}
```

**PUT** `/web/ponds/:pondId/sensors/:sensorId`

- Body：
  - `sensor_name` string 選填
- Response：

```json
{
  "ok": true,
  "message": "感測器更新成功",
  "sensor": {}
}
```

**DELETE** `/web/ponds/:pondId/sensors/:sensorId`

- Response：

```json
{
  "ok": true,
  "message": "感測器刪除成功"
}
```

**POST** `/web/ponds/:pondId/sensors/:sensorId/token`

- 說明：生成永久且單一的感測器 Token，新 token 會覆蓋舊 token。
- Response：

```json
{
  "ok": true,
  "message": "感測器 token 生成成功",
  "token": "<jwt>"
}
```

**GET** `/web/ponds/:pondId/sensors/:sensorId/token`

- Response：

```json
{
  "ok": true,
  "data": {
    "has_token": true,
    "token_issued_at": "2026-04-15T09:00:00.000Z",
    "token_revoked_at": null,
    "is_valid": true
  }
}
```

**DELETE** `/web/ponds/:pondId/sensors/:sensorId/token`

- Response：

```json
{
  "ok": true,
  "message": "感測器 token 已清除"
}
```

### 3.6 感測器資料上報（Sensor Ingest）

**POST** `/sensors/v1/include`

- Headers：`Authorization: Bearer <sensor_token>`
- Body：
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
  - `photo_b64` string 選填

**POST** `/sensors/include`

- 與 `/sensors/v1/include` 相同。
- 備註：會忽略 body 內的 `sensorId`、`sensor_id`、`pond_id`、`user_id`，以 token 內容為準。

**POST** `/sensors/maintainRecord`

- Headers：`Authorization: Bearer <sensor_token>`
- Body：
  - `date` string 選填（ISO 時間字串，裝置送出的事件時間）
  - `local_ip` string 選填
  - `calibration_time` string 選填（ISO 時間字串）
  - `calibration_start` string 選填（ISO 時間字串）
  - `before` object 選填（校正前快照）
  - `after` object 選填（校正後快照）
- 備註：
  - 會忽略 body 內的 `sensorId`、`sensor_id`、`pond_id`、`user_id`，以 token 內容為準。
  - 後端會原樣保存 `before` / `after` JSON，供後續追查校正歷程。

**POST** `/sensors/crashReport`

- Headers：`Authorization: Bearer <sensor_token>`
- Body：
  - `date` string 選填（ISO 時間字串，裝置送出的事件時間）
  - `local_ip` string 選填
  - `msg_err` string 必填
  - `log_text` string 選填
- 備註：
  - 會忽略 body 內的 `sensorId`、`sensor_id`、`pond_id`、`user_id`，以 token 內容為準。
  - `msg_err` 與 `log_text` 會寫入 crash report 專用資料表，不會混進一般 `sensor_data`。

**GET** `/sensors/auth/token-check`

- Response：

```json
{
  "ok": true,
  "user": {
    "user_id": 1,
    "pond_id": 1,
    "sensor_id": 1
  }
}
```

### 3.7 Shared Access（公開查詢）

所有 `/shared` 路由僅支援 `GET`，並必須帶 `?access=<access_key>`。

**GET** `/shared/getInfo?access=<access_key>`

- 說明：回傳 access 可使用的池塘 / 感測器清單與查詢手冊。

**GET** `/shared/common?access=<access_key>`

- 說明：回傳：
  - 池塘清單
  - 感測器清單
  - 近 1 天分鐘聚合感測器資料
  - 近 30 天每日紀錄
  - 近 3 / 7 天趨勢資料

**GET** `/shared/data/ponds?access=<access_key>`

- Query：
  - `pond_id` 或 `pond_ids`
  - `limit`
  - `offset`

**GET** `/shared/data/sensors?access=<access_key>`

- Query：
  - `sensor_id` 或 `sensor_ids`
  - `pond_id` 或 `pond_ids`
  - `limit`
  - `offset`

**GET** `/shared/data/daily-logs?access=<access_key>`

- Query：
  - `pond_id` 或 `pond_ids`
  - `start_date`
  - `end_date`
  - `limit`
  - `offset`
- 回傳的每日紀錄也包含 `items`
- `log_date` 回傳格式與 Web API 相同，為目前實際序列化後的 ISO 8601 timestamp，例如 `2026-04-14T16:00:00.000Z`

**GET** `/shared/data/sensor-data?access=<access_key>`

- Query：
  - `sensor_id` 或 `sensor_ids`
  - `pond_id` 或 `pond_ids`
  - `start_date`
  - `end_date`
  - `granularity`：`raw`、`second`、`minute`
  - `limit`
  - `offset`
- 備註：
  - `second` 目前等同 `raw`。
  - `minute` 會回傳每分鐘聚合後的 min/max/avg/std 欄位。

### 3.8 推播通知（Web）

**POST** `/web/notifications/subscribe`

- Body：
  - `subscription` object 必填
  - `device_label` string 選填

**POST** `/web/notifications/unsubscribe`

- Body：
  - `subscription.endpoint` string 必填

**POST** `/web/notifications/test`

- Body：
  - `delay_seconds` number 選填，範圍 `0-3600`
  - `title` string 選填
  - `body` string 選填
  - `url` string 選填
  - `require_interaction` boolean 選填

### 3.9 Grafana 告警 Webhook

**POST** `/webhook/grafana`

- Auth（可選）：
  - 若有設定 `GRAFANA_WEBHOOK_TOKEN`
  - 請帶 `Authorization: Bearer <token>` 或 `X-Grafana-Token: <token>`
- Body：Grafana Unified Alerting payload
- 支援：
  - `alerts[]`
  - `status`
  - `labels`
  - `annotations`
  - `startsAt` / `endsAt`
- 建議 labels：
  - `user_id`
  - `pond_id`
  - `severity`
  - `rule_uid`

- Response：

```json
{
  "ok": true,
  "received": 1,
  "enqueued": 1,
  "skipped": 0
}
```

## 4. 錯誤碼慣例

- `400`：參數格式錯誤、欄位驗證失敗
- `401`：Token 缺失或無效
- `403`：權限不足或註冊被停用
- `404`：找不到資源
- `409`：資源衝突，例如同池同日重複日誌、重複自訂選項
- `500`：伺服器內部錯誤

## 5. 備註

- 感測器 Token 為永久單一 Token，重新生成會覆蓋舊 Token。
- `/sensors/include` 會忽略 body 內的 `sensorId` / `pond_id` / `user_id`，以 token 為準。
- 每日紀錄新模型已改為主檔 + 明細，前端新開發應以 `items` 為主。
- `maintain.js` 用於把舊 `medication_type` 遷移到 `daily_log_items`。
