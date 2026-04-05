# Grafana Webhook -> Push Notifications

Endpoint:

```
POST /webhook/grafana
```

Optional auth:

- If `GRAFANA_WEBHOOK_TOKEN` is set, send `Authorization: Bearer <token>` or `X-Grafana-Token: <token>`.

Label routing (recommended):

- `user_id` (preferred) or `pond_id` for user resolution
- `severity` for notification severity
- `rule_uid` for traceability

Supported environment variables:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_CONTACT` (default: `mailto:admin@example.com`)
- `GRAFANA_WEBHOOK_TOKEN`
- `GRAFANA_ALERT_COOLDOWN_MINUTES` (default: 30)
- `GRAFANA_NOTIFY_RESOLVED` (default: false)
- `NOTIFICATION_OUTBOX_INTERVAL_MS` (default: 10000)
- `NOTIFICATION_OUTBOX_BATCH` (default: 50)

ENV 設定位置：

- 專案根目錄的 `.env`
- 範例路徑：`C:\\Users\\Public\\Code\\project\\fish-healthy-prediction-project\\esp32-server\\.env`

Example payload (Unified Alerting):

```json
{
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "fingerprint": "abc123",
      "labels": {
        "alertname": "Water pH High",
        "pond_id": "1",
        "user_id": "7",
        "severity": "critical",
        "rule_uid": "ph_rule_01"
      },
      "annotations": {
        "summary": "pH too high",
        "description": "pH=8.9, above threshold 8.5",
        "url": "https://grafana.example.com/alerting"
      },
      "startsAt": "2024-04-27T12:00:00Z",
      "endsAt": "2024-04-27T12:10:00Z"
    }
  ]
}
```
