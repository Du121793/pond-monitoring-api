BEGIN;

-- Users
INSERT INTO users (id, user_name, password_hash, created_at, updated_at)
VALUES (1, 'demo_user', '$2b$10$ZM3UwNgnSgz4ADg8WRHWSOP6sD406ZtalOrHfTzxyw6GP2FC86vcy', now(), now())
ON CONFLICT (user_name) DO NOTHING;

-- Ponds
INSERT INTO ponds (
  id, user_id, pond_name, pond_length, pond_width, pond_height,
  total_fish_count, total_fish_weight, feeding_growth_rate,
  created_at, updated_at
) VALUES
  (1, 1, 'Pond A', 10, 5, 2, 500, 250.5, 5, now(), now()),
  (2, 1, 'Pond B', 12, 6, 2.5, 650, 300.0, 6, now(), now()),
  (3, 1, 'Pond C', 8, 4, 1.8, 300, 150.0, 4, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Sensors
INSERT INTO sensors (
  id, pond_id, sensor_name, local_ip, created_at, updated_at
) VALUES
  (1, 1, 'Sensor A1', '192.168.1.10', now(), now()),
  (2, 1, 'Sensor A2', '192.168.1.11', now(), now()),
  (3, 2, 'Sensor B1', '192.168.1.20', now(), now()),
  (4, 3, 'Sensor C1', '192.168.1.30', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Sensor Data
INSERT INTO sensor_data (
  sensor_id, ph, turbidity_raw, turbidity_percent, turbidity_ntu,
  hardness, ec_us_cm, orp_mv, do_mg_l, do_sat, mq135, mq137, temp_deep, temp_shallow,
  created_at, updated_at
) VALUES
  (1, 7.2, 120, 12.0, 45.0, 180.5, 300.2, 220.1, 6.8, 82.0, 350, 120, 23.4, 24.1, now() - interval '2 hours', now() - interval '2 hours'),
  (1, 7.4, 110, 11.0, 40.0, 175.0, 290.0, 215.0, 7.1, 85.0, 340, 118, 23.6, 24.3, now() - interval '1 hours', now() - interval '1 hours'),
  (2, 7.1, 130, 13.0, 48.0, 185.0, 310.0, 225.0, 6.5, 79.0, 360, 122, 23.2, 24.0, now() - interval '3 hours', now() - interval '3 hours'),
  (3, 7.5, 125, 12.5, 46.0, 182.0, 305.0, 221.0, 7.0, 84.0, 355, 121, 23.8, 24.6, now() - interval '90 minutes', now() - interval '90 minutes'),
  (4, 7.0, 100, 10.0, 35.0, 160.0, 280.0, 210.0, 6.2, 76.0, 330, 110, 22.9, 23.7, now() - interval '45 minutes', now() - interval '45 minutes');

-- Daily Logs
INSERT INTO pond_daily_logs (
  pond_id, feeding_amount, death_count, medication_given,
  medication_type, notes, log_date, created_at, updated_at
) VALUES
  (1, 12.5, 0, false, null, '正常', current_date - 1, now() - interval '1 day', now() - interval '1 day'),
  (2, 15.0, 1, true, '維他命', '補充營養', current_date - 1, now() - interval '1 day', now() - interval '1 day'),
  (3, 10.0, 0, false, null, '正常', current_date, now(), now());

-- Fix sequences
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('ponds', 'id'), (SELECT MAX(id) FROM ponds));
SELECT setval(pg_get_serial_sequence('sensors', 'id'), (SELECT MAX(id) FROM sensors));
SELECT setval(pg_get_serial_sequence('sensor_data', 'id'), (SELECT COALESCE(MAX(id), 1) FROM sensor_data));
SELECT setval(pg_get_serial_sequence('pond_daily_logs', 'id'), (SELECT COALESCE(MAX(id), 1) FROM pond_daily_logs));

COMMIT;
