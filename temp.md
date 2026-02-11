# Sensor Include 測試 JSON

## 1. 最小欄位
```json
{
  "date": "2026-02-11T06:00:00.000Z",
  "ph": 7.2,
  "temp_deep": 23.4,
  "temp_shallow": 24.1
}
```

## 2. 完整欄位（不含圖片）
```json
{
  "date": "2026-02-11T06:05:00.000Z",
  "local_ip": "192.168.1.50",
  "ph": 7.5,
  "turbidity_raw": 123,
  "turbidity_percent": 12.3,
  "turbidity_ntu": 45.6,
  "hardness": 180.5,
  "ec_us_cm": 300.2,
  "orp_mv": 220.1,
  "mq135": 350,
  "mq137": 120,
  "temp_deep": 23.8,
  "temp_shallow": 24.6
}
```

## 3. 完整欄位（含圖片）
```json
{
  "date": "2026-02-11T06:10:00.000Z",
  "local_ip": "192.168.1.50",
  "ph": 7.1,
  "turbidity_raw": 98,
  "turbidity_percent": 9.8,
  "turbidity_ntu": 30.5,
  "hardness": 160.0,
  "ec_us_cm": 280.0,
  "orp_mv": 210.0,
  "mq135": 330,
  "mq137": 110,
  "temp_deep": 23.3,
  "temp_shallow": 24.0,
  "photo_b64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
}
```
