-- =========================================================
-- IOT DEMO DB INIT SCRIPT
-- MySQL 8.x
-- Locked scope:
-- - 1 ESP32 board
-- - 3 sensors: TEMP, HUM, LIGHT
-- - 3 devices: LED1, LED2, LED3
-- - 6 tables only
-- =========================================================

-- Khuyen nghi chay bang user co quyen tao DB/schema
-- Nen dung UTC de backend/DB nhat quan timestamp
SET time_zone = '+00:00';

-- ---------------------------------------------------------
-- 1) CREATE DATABASE
-- ---------------------------------------------------------
DROP DATABASE IF EXISTS iot_demo;
CREATE DATABASE iot_demo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE iot_demo;

-- ---------------------------------------------------------
-- 2) MASTER TABLES
-- ---------------------------------------------------------

-- devices:
-- Danh muc device demo tren board
CREATE TABLE devices (
  device_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_code    VARCHAR(20)  NOT NULL,
  device_name    VARCHAR(50)  NOT NULL,
  device_type    ENUM('LED')  NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT pk_devices PRIMARY KEY (device_id),
  CONSTRAINT uq_devices_code UNIQUE (device_code)
) ENGINE=InnoDB;

-- sensors:
-- Danh muc sensor tren board
CREATE TABLE sensors (
  sensor_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sensor_code    VARCHAR(20)  NOT NULL,
  sensor_type    ENUM('temperature', 'humidity', 'light') NOT NULL,
  sensor_name    VARCHAR(50)  NOT NULL,
  unit           VARCHAR(20)  NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT pk_sensors PRIMARY KEY (sensor_id),
  CONSTRAINT uq_sensors_code UNIQUE (sensor_code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 3) HISTORY / EVENT TABLES
-- ---------------------------------------------------------

-- actions:
-- Lich su bat/tat device va ket qua ACK
-- requested_at / acked_at nen do backend ghi ro rang
CREATE TABLE actions (
  action_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id      INT UNSIGNED NOT NULL,
  action         ENUM('on', 'off') NOT NULL,
  status         ENUM('PENDING', 'SUCCESS', 'FAIL') NOT NULL,
  requested_at   DATETIME(3) NOT NULL,
  acked_at       DATETIME(3) NULL,

  CONSTRAINT pk_actions PRIMARY KEY (action_id),
  CONSTRAINT fk_actions_device
    FOREIGN KEY (device_id)
    REFERENCES devices(device_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- sensor_readings:
-- Lich su doc sensor
-- ts la timestamp chuan do backend/server gan
CREATE TABLE sensor_readings (
  reading_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sensor_id      INT UNSIGNED NOT NULL,
  ts             DATETIME(3) NOT NULL,
  value_num      DECIMAL(10,2) NOT NULL,

  CONSTRAINT pk_sensor_readings PRIMARY KEY (reading_id),
  CONSTRAINT fk_sensor_readings_sensor
    FOREIGN KEY (sensor_id)
    REFERENCES sensors(sensor_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 4) CURRENT STATE TABLES
-- ---------------------------------------------------------

-- device_state:
-- Trang thai moi nhat backend biet
-- Duoc cap nhat boi:
--   (a) ACK success de UI phan hoi nhanh
--   (b) telemetry full snapshot de dong bo lai state thuc te
CREATE TABLE device_state (
  device_id        INT UNSIGNED NOT NULL,
  state            TINYINT UNSIGNED NOT NULL,
  updated_at       DATETIME(3) NOT NULL,
  last_action_id   INT UNSIGNED NULL,

  CONSTRAINT pk_device_state PRIMARY KEY (device_id),
  CONSTRAINT chk_device_state_state CHECK (state IN (0, 1)),
  CONSTRAINT fk_device_state_device
    FOREIGN KEY (device_id)
    REFERENCES devices(device_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_device_state_last_action
    FOREIGN KEY (last_action_id)
    REFERENCES actions(action_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- sensor_state:
-- Gia tri hop le moi nhat cua moi sensor
-- Neu temp/hum null trong telemetry => bo qua update, giu last valid value
CREATE TABLE sensor_state (
  sensor_id      INT UNSIGNED NOT NULL,
  ts             DATETIME(3) NOT NULL,
  value_num      DECIMAL(10,2) NOT NULL,
  updated_at     DATETIME(3) NOT NULL,

  CONSTRAINT pk_sensor_state PRIMARY KEY (sensor_id),
  CONSTRAINT fk_sensor_state_sensor
    FOREIGN KEY (sensor_id)
    REFERENCES sensors(sensor_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 5) INDEXES
-- ---------------------------------------------------------

-- devices
CREATE INDEX idx_devices_active_type
  ON devices (is_active, device_type);

-- sensors
CREATE INDEX idx_sensors_active_type
  ON sensors (is_active, sensor_type);

-- actions
CREATE INDEX idx_actions_device_req
  ON actions (device_id, requested_at);

CREATE INDEX idx_actions_status_req
  ON actions (status, requested_at);

CREATE INDEX idx_actions_req
  ON actions (requested_at);

-- sensor_readings
CREATE INDEX idx_sensor_readings_sensor_ts
  ON sensor_readings (sensor_id, ts);

CREATE INDEX idx_sensor_readings_ts
  ON sensor_readings (ts);

-- device_state
CREATE INDEX idx_device_state_last_action
  ON device_state (last_action_id);

-- ---------------------------------------------------------
-- 6) SEED MASTER DATA
-- ---------------------------------------------------------

INSERT INTO devices (device_code, device_name, device_type, is_active)
VALUES
  ('LED1', 'LED 1', 'LED', 1),
  ('LED2', 'LED 2', 'LED', 1),
  ('LED3', 'LED 3', 'LED', 1);

INSERT INTO sensors (sensor_code, sensor_type, sensor_name, unit, is_active)
VALUES
  ('TEMP',  'temperature', 'Temperature', '°C', 1),
  ('HUM',   'humidity',    'Humidity',    '%',  1),
  ('LIGHT', 'light',       'Light',       'raw', 1);

-- Seed device_state de Dashboard co state OFF ban dau cho 3 LED
INSERT INTO device_state (device_id, state, updated_at, last_action_id)
SELECT d.device_id, 0, CURRENT_TIMESTAMP(3), NULL
FROM devices d;

-- Khong seed sensor_state.
-- Ly do:
-- - Sensor state phai den tu lan ingest hop le dau tien
-- - TEMP/HUM co the null o mot so telemetry
-- - Khong seed se ro nghia "chua co du lieu"

-- ---------------------------------------------------------
-- 7) OPTIONAL SAMPLE DATA FOR QUICK TEST (commented)
-- ---------------------------------------------------------

-- -- Vi du: 1 action SUCCESS cho LED1
-- INSERT INTO actions (device_id, action, status, requested_at, acked_at)
-- VALUES (1, 'on', 'SUCCESS', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- -- Dong bo device_state theo action vua tao
-- UPDATE device_state
-- SET state = 1,
--     updated_at = CURRENT_TIMESTAMP(3),
--     last_action_id = LAST_INSERT_ID()
-- WHERE device_id = 1;

-- -- Vi du: sensor_state + sensor_readings ban dau
-- INSERT INTO sensor_state (sensor_id, ts, value_num, updated_at)
-- VALUES
--   (1, CURRENT_TIMESTAMP(3), 28.40, CURRENT_TIMESTAMP(3)),
--   (2, CURRENT_TIMESTAMP(3), 71.20, CURRENT_TIMESTAMP(3)),
--   (3, CURRENT_TIMESTAMP(3), 1830.00, CURRENT_TIMESTAMP(3));

-- INSERT INTO sensor_readings (sensor_id, ts, value_num)
-- VALUES
--   (1, CURRENT_TIMESTAMP(3), 28.40),
--   (2, CURRENT_TIMESTAMP(3), 71.20),
--   (3, CURRENT_TIMESTAMP(3), 1830.00);

-- ---------------------------------------------------------
-- 8) HELPFUL CHECK QUERIES
-- ---------------------------------------------------------

-- Kiem tra seed master
SELECT * FROM devices ORDER BY device_id;
SELECT * FROM sensors ORDER BY sensor_id;
SELECT * FROM device_state ORDER BY device_id;

-- ---------------------------------------------------------
-- 9) GHI CHU VAN HANH
-- ---------------------------------------------------------
-- 1. ts_ms cua ESP32 KHONG duoc ghi vao sensor_readings.ts hay sensor_state.ts.
--    Moi timestamp chuan trong DB do backend/server gan khi ingest/xu ly.
--
-- 2. device_state co 2 nguon cap nhat:
--    - ACK success: update ngay de UI phan hoi nhanh
--    - telemetry full snapshot: dong bo lai state thuc te cua hardware
--
-- 3. temp == null / hum == null trong telemetry:
--    - KHONG insert sensor_readings cho sensor do
--    - KHONG update sensor_state cho sensor do
--    - light xu ly binh thuong
--
-- 4. sensor_state phan anh last valid value, nen de NOT NULL la hop ly.
--
-- 5. Action fail do publish fail / ACK false / timeout deu map ve status = FAIL.