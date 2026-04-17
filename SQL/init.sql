-- =========================================================
-- IoT Demo MVP database initialization
-- MySQL 8.x
-- Locked runtime scope:
-- - 1 ESP32 board
-- - 3 sensors: TEMP, HUM, LIGHT
-- - 5 devices: LED1, LED2, LED3, LED4, LED5
-- - 6 tables only
-- =========================================================

SET time_zone = '+00:00';

DROP DATABASE IF EXISTS iot_demo;
CREATE DATABASE iot_demo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE iot_demo;

CREATE TABLE devices (
  device_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_code    VARCHAR(20) NOT NULL,
  device_name    VARCHAR(50) NOT NULL,
  device_type    VARCHAR(50) NOT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (device_id),
  UNIQUE KEY uq_devices_code (device_code),
  KEY idx_devices_active_type (is_active, device_type)
) ENGINE=InnoDB;

CREATE TABLE sensors (
  sensor_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sensor_code    VARCHAR(20) NOT NULL,
  sensor_type    VARCHAR(50) NOT NULL,
  sensor_name    VARCHAR(50) NOT NULL,
  unit           VARCHAR(20) NOT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (sensor_id),
  UNIQUE KEY uq_sensors_code (sensor_code),
  KEY idx_sensors_active_type (is_active, sensor_type)
) ENGINE=InnoDB;

CREATE TABLE actions (
  action_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id      INT UNSIGNED NOT NULL,
  action         VARCHAR(10) NOT NULL,
  status         VARCHAR(20) NOT NULL,
  requested_at   DATETIME(3) NOT NULL,
  acked_at       DATETIME(3) NULL,
  PRIMARY KEY (action_id),
  CONSTRAINT fk_actions_device
    FOREIGN KEY (device_id)
    REFERENCES devices (device_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  KEY idx_actions_device_req (device_id, requested_at),
  KEY idx_actions_device_status_req (device_id, status, requested_at),
  KEY idx_actions_status_req (status, requested_at),
  KEY idx_actions_req (requested_at)
) ENGINE=InnoDB;

CREATE TABLE sensor_readings (
  reading_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sensor_id      INT UNSIGNED NOT NULL,
  ts             DATETIME(3) NOT NULL,
  value_num      DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (reading_id),
  CONSTRAINT fk_sensor_readings_sensor
    FOREIGN KEY (sensor_id)
    REFERENCES sensors (sensor_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  KEY idx_sensor_readings_sensor_ts (sensor_id, ts),
  KEY idx_sensor_readings_ts (ts)
) ENGINE=InnoDB;

CREATE TABLE device_state (
  device_id        INT UNSIGNED NOT NULL,
  state            TINYINT UNSIGNED NOT NULL,
  updated_at       DATETIME(3) NOT NULL,
  last_action_id   INT UNSIGNED NULL,
  PRIMARY KEY (device_id),
  CONSTRAINT chk_device_state_state CHECK (state IN (0, 1)),
  CONSTRAINT fk_device_state_device
    FOREIGN KEY (device_id)
    REFERENCES devices (device_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT fk_device_state_last_action
    FOREIGN KEY (last_action_id)
    REFERENCES actions (action_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL,
  KEY idx_device_state_last_action (last_action_id)
) ENGINE=InnoDB;

CREATE TABLE sensor_state (
  sensor_id      INT UNSIGNED NOT NULL,
  ts             DATETIME(3) NOT NULL,
  value_num      DECIMAL(10, 2) NOT NULL,
  updated_at     DATETIME(3) NOT NULL,
  PRIMARY KEY (sensor_id),
  CONSTRAINT fk_sensor_state_sensor
    FOREIGN KEY (sensor_id)
    REFERENCES sensors (sensor_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT INTO devices (device_code, device_name, device_type, is_active)
VALUES
  ('LED1', 'LED 1', 'LED', 1),
  ('LED2', 'LED 2', 'LED', 1),
  ('LED3', 'LED 3', 'LED', 1),
  ('LED4', 'LED 4', 'LED', 1),
  ('LED5', 'LED 5', 'LED', 1);

INSERT INTO sensors (sensor_code, sensor_type, sensor_name, unit, is_active)
VALUES
  ('TEMP', 'temperature', 'Temperature', '°C', 1),
  ('HUM', 'humidity', 'Humidity', '%', 1),
  ('LIGHT', 'light', 'Light', 'raw', 1);

INSERT INTO device_state (device_id, state, updated_at, last_action_id)
SELECT d.device_id, 0, CURRENT_TIMESTAMP(3), NULL
FROM devices d
ORDER BY d.device_id;

-- sensor_state is intentionally not seeded.
-- It should only reflect the first valid telemetry ingest per sensor.
