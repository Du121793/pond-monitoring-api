# 養殖系統 API 手冊 V1.1

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
| 45  | `/web/ai/models`                             | GET    | 獲取可用 AI 模型清單             | Web              |
| 46  | `/web/ai/sessions`                           | GET    | 取得 AI 對話 Session 列表        | Web              |
| 47  | `/web/ai/sessions/:sessionId`                | GET    | 取得 AI 對話 Session 詳情        | Web              |
| 48  | `/web/ai/sessions/:sessionId`                | DELETE | 刪除 AI 對話 Session             | Web              |
| 49  | `/web/ai/chat/stream`                        | POST   | AI 對話串流代理                  | Web              |

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
- **Response**: 與註冊相同。

**GET** `/web/auth/token-check`

- **Headers**: `Authorization: Bearer <web_token>`
- **Response**:
```json
{ "ok": true, "user": { "user_id": 1 } }
```

### 3.2 池塘（Ponds）

**GET** `/web/ponds`
**GET** `/web/ponds/:pondId`
**POST** `/web/ponds`
**PUT** `/web/ponds/:pondId`
**DELETE** `/web/ponds/:pondId`
**GET** `/web/ponds/:pondId/latest-data`

### 3.3 池塘日常記錄（Daily Logs）

日常記錄目前採用主檔 + `items` 明細模式。

**GET** `/web/ponds/:pondId/daily-logs`
**POST** `/web/ponds/:pondId/daily-logs`
**PUT** `/web/ponds/:pondId/daily-logs/:logId`
**DELETE** `/web/ponds/:pondId/daily-logs/:logId`

### 3.4 日常記錄選項（Daily Log Options）

**GET** `/web/daily-log-options`
**POST** `/web/daily-log-options`
**PATCH** `/web/daily-log-options/:optionId`

### 3.5 池塘感測器（Sensors）

**GET** `/web/ponds/:pondId/sensors`
**POST** `/web/ponds/:pondId/sensors/:sensorId/token`
**DELETE** `/web/ponds/:pondId/sensors/:sensorId/token`

### 3.6 感測器資料上報（Sensor Ingest）

**POST** `/sensors/v1/include`
**POST** `/sensors/maintainRecord`
**POST** `/sensors/crashReport`

### 3.7 Shared Access（公開查詢）

帶有 `?access=<access_key>` 的公開查詢介面，僅支援 GET 方法。

### 3.8 推播通知（Web）

**POST** `/web/notifications/subscribe`
**POST** `/web/notifications/unsubscribe`

### 3.9 Grafana 告警 Webhook

**POST** `/webhook/grafana`

### 3.10 AI Assistant（Web）

**GET** `/web/ai/health`

- **Headers**: `Authorization: Bearer <web_token>`
- **說明**: 由 backend 代理呼叫 AI Helper 的健康檢查。

**GET** `/web/ai/models`

- **Headers**: `Authorization: Bearer <web_token>`
- **說明**: 獲取後端目前支援且啟用的 AI 模型清單。
- **Response**:
```json
{
  "success": true,
  "data": {
    "gpt-5.4-nano": {
      "provider": "openai",
      "enabled": true,
      "supports_deep_thinking": true,
      "supports_multimodal": true,
      "family": "gpt-5.4"
    }
  }
}
```

**GET** `/web/ai/sessions`
**GET** `/web/ai/sessions/:sessionId`
**DELETE** `/web/ai/sessions/:sessionId`

**POST** `/web/ai/chat/stream`

- **Headers**: `Authorization: Bearer <web_token>`
- **Body**:
  - `pond_id` integer 必填
  - `session_id` string 選填
  - `message` string 必填
  - `model` string 選填，指定模型名稱
  - `attachments` array 選填，多模態附件列表。格式為 `{"type": "image", "mime_type": "image/png", "data": "base64..."}`
  - `deep_thinking` boolean 選填，預設 `false`。開啟推理/深度思考模式
  - `use_rag` boolean 選填，預設 `true`

  - `enable_web_search` boolean 選填，預設 `false`
  - `enable_assistant_ui` boolean 選填，預設 `true`
  - `time_window_from/to` ISO 時間字串
- **規則**:
  - 後端會自動處理附件過濾與池塘權限檢查。
- **SSE Event**: `start`, `source`, `token`, `done`, `error`

## 4. 認證與錯誤

- **401**: Token 缺失或無效
- **403**: Token 被撤銷或驗證失敗
- **404**: 資源不存在或無權限
- **500**: 伺服器錯誤

## 5. 備註

- 感測器 Token 為永久單一 Token。
- `/sensors/include` 會忽略 body 內的 `sensorId/pond_id/user_id`，以 token 為準。

## Prediction APIs

### Web Pond Prediction Endpoints

These endpoints are part of the active `web` API and require `Authorization: Bearer <web_token>`.

#### GET `/web/ponds/:pondId/predictions/latest-forecast`

Read the latest synced 6-hour forecast for the given pond from `pond_forecast_predictions`.

Response example:

```json
{
  "ok": true,
  "pond_id": 2,
  "forecasts": [
    {
      "metric_name": "do_mg_l",
      "current_value": 12.803,
      "predicted_value": 7.232,
      "delta_value": -5.572,
      "forecast_for_ts": "2026-05-10T13:20:33.833Z",
      "model_family": "xgboost",
      "model_version": "20260510T020502Z_d51c5c8e1d"
    }
  ],
  "count": 6,
  "timestamp": "2026-05-10T07:20:37.000Z"
}
```

#### GET `/web/ponds/:pondId/predictions/latest-risk-score`

Read the latest synced risk score for the given pond from `pond_risk_predictions`.

Response example:

```json
{
  "ok": true,
  "pond_id": 2,
  "risk_score": {
    "risk_score": 100,
    "risk_level": "high",
    "predicted_next_day_death_count": 73.2,
    "model_family": "weighted_prev_rule",
    "model_version": "20260510T063455Z_32fb31428e"
  },
  "timestamp": "2026-05-10T07:20:37.000Z"
}
```
