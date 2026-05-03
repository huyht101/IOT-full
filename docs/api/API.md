# API Documentation

## 1. Overview

This document describes the current backend API surface for the IoT Dashboard MVP.

The backend exposes six core HTTP endpoints:
- `GET /api/v1/dashboard`
- `GET /api/v1/dashboard/realtime`
- `POST /api/v1/devices/:device_id/toggle`
- `GET /api/v1/actions`
- `GET /api/v1/device-usage`
- `GET /api/v1/sensor-readings`

All endpoints use the same wrapper style.

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  },
  "data": {}
}
```

## 2. Base URL

Local backend base URL:

```text
http://127.0.0.1:4000
```

## 3. Endpoint Details

### 3.1 Get Dashboard

- **Method + URL:** `GET /api/v1/dashboard`
- **Purpose:** Load the current dashboard snapshot, including current device state, current sensor state, chart points, and the latest relevant timestamp.

#### Success response example

```json
{
  "ok": true,
  "data": {
    "devices": [
      {
        "device_id": 1,
        "device_code": "LED1",
        "device_name": "LED 1",
        "device_type": "LED",
        "state": 1,
        "updated_at": "2026-03-29T12:44:08.000Z",
        "last_action_id": 123
      }
    ],
    "sensors": [
      {
        "sensor_id": 1,
        "sensor_code": "TEMP",
        "sensor_name": "Temperature",
        "sensor_type": "temperature",
        "unit": "°C",
        "value_num": 28.9,
        "ts": "2026-03-29T12:44:08.000Z",
        "updated_at": "2026-03-29T12:44:08.000Z"
      }
    ],
    "chart_pts": [
      {
        "ts": "2026-03-29T12:44:08.000Z",
        "temp": 28.9,
        "hum": 80,
        "light": 3022
      }
    ],
    "last_ts": "2026-03-29T12:44:08.000Z"
  }
}
```

#### Notes

- Dashboard realtime is polling-based; there is no WebSocket/SSE endpoint.
- Timestamp fields are serialized as ISO-style UTC strings.
- The frontend renders timestamps in a fixed UTC+07 display convention.
- The seeded device set is currently `LED1` through `LED5`.

### 3.2 Get Dashboard Realtime

- **Method + URL:** `GET /api/v1/dashboard/realtime?since=...`
- **Purpose:** Return delta chart points plus the latest current device/sensor snapshot for frontend polling.

#### Query params

| Name | Required | Description |
| --- | --- | --- |
| `since` | Yes | Valid datetime string. Best sourced from the previous dashboard response `last_ts`. Future values are rejected. |

#### Error response example

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "since cannot be in the future"
  }
}
```

#### Notes

- `since` is required.
- Invalid or future `since` values return `400 VALIDATION_ERROR`.

### 3.3 Toggle Device

- **Method + URL:** `POST /api/v1/devices/:device_id/toggle`
- **Purpose:** Execute a device action and wait for publish/ACK finalization.

#### Path params

| Name | Required | Description |
| --- | --- | --- |
| `device_id` | Yes | Positive integer device ID |

#### Request body

```json
{
  "action": "on"
}
```

Allowed values:
- `on`
- `off`

#### Notes / behavior

- Success only occurs when ACK finalization resolves to `SUCCESS`.
- Failure cases include:
  - `DEVICE_BUSY` (`409`)
  - MQTT publish failure (`503`)
  - ACK reported failure (`502`)
  - ACK timeout (`504`)
- Late ACKs after timeout/failure are ignored.
- On success, backend updates `device_state`.
- On failure, backend does not update `device_state` in the toggle flow.

### 3.4 Get Action History

- **Method + URL:** `GET /api/v1/actions`
- **Purpose:** Query the action history table with server-side search, filters, sort, and pagination.

#### Query params

| Name | Required | Description |
| --- | --- | --- |
| `page` | No | Positive integer, default `1` |
| `page_size` | No | Positive integer, default `20`, max `100` |
| `q` | No | Free-text search, max length `100` |
| `device_type` | No | Allowed device type, currently `LED` |
| `status` | No | `PENDING`, `SUCCESS`, `FAIL` |
| `device_code` | No | Device code such as `LED1` |
| `action` | No | `on` or `off` |
| `from` | No | Datetime lower bound for `requested_at` |
| `to` | No | Datetime upper bound for `requested_at` |
| `sort_by` | No | `requested_at`, `acked_at`, `device_code`, `status`, `action` |
| `sort_dir` | No | `asc` or `desc`, default `desc` |

#### Current `q` search behavior

`q` can match:
- displayed `requested_at` text in the frontend-aligned fixed UTC+07 `YYYY-MM-DD HH:mm:ss` convention
- `device_code`
- `device_name`
- numeric `action_id`
- numeric `device_id`

#### Notes

- Default sort is `requested_at desc`.
- `from` must be earlier than or equal to `to`.

### 3.5 Get Device Usage

- **Method + URL:** `GET /api/v1/device-usage`
- **Purpose:** Return daily on/off action counts for all active devices on one selected UTC+07 date.

#### Query params

| Name | Required | Description |
| --- | --- | --- |
| `date` | Yes | One selected date in `YYYY-MM-DD` interpreted in UTC+07 |
| `status` | No | `success` or `fail`, default `success` |

#### Behavior notes

- The data source is the `actions` table.
- Statistics are returned for all five active demo devices in one response.
- The selected `date` is converted to a single local business day in the fixed UTC+07 convention.
- `PENDING` actions are never included because the only allowed status filters are `success` and `fail`.
- Each device row contains separate `on_count` and `off_count` values.
- Devices with no matching actions still appear with both counts set to `0`.

#### Success response example

```json
{
  "ok": true,
  "data": {
    "date": "2026-04-20",
    "status": "success",
    "timezone": "UTC+07",
    "items": [
      {
        "device_code": "LED1",
        "device_name": "LED 1",
        "on_count": 3,
        "off_count": 2
      },
      {
        "device_code": "LED2",
        "device_name": "LED 2",
        "on_count": 1,
        "off_count": 1
      },
      {
        "device_code": "LED3",
        "device_name": "LED 3",
        "on_count": 0,
        "off_count": 4
      },
      {
        "device_code": "LED4",
        "device_name": "LED 4",
        "on_count": 0,
        "off_count": 0
      },
      {
        "device_code": "LED5",
        "device_name": "LED 5",
        "on_count": 2,
        "off_count": 2
      }
    ]
  }
}
```

### 3.6 Get Sensor History

- **Method + URL:** `GET /api/v1/sensor-readings`
- **Purpose:** Query sensor readings with server-side search, filters, sort, and pagination.

#### Query params

| Name | Required | Description |
| --- | --- | --- |
| `page` | No | Positive integer, default `1` |
| `page_size` | No | Positive integer, default `20`, max `100` |
| `q` | No | Free-text search, max length `100` |
| `sensor_type` | No | `temperature`, `humidity`, or `light` |
| `sensor_code` | No | `TEMP`, `HUM`, or `LIGHT` |
| `from` | No | Datetime lower bound for `ts` |
| `to` | No | Datetime upper bound for `ts` |
| `sort_by` | No | `reading_id`, `ts`, `sensor_code`, `sensor_type`, `value_num` |
| `sort_dir` | No | `asc` or `desc`, default `desc` |

#### Current `q` search behavior

`q` can match all displayed table fields:
- numeric `reading_id`
- `sensor_code`
- `sensor_name`
- `sensor_type`
- value text via `value_num`
- displayed `ts` text in the frontend-aligned fixed UTC+07 `YYYY-MM-DD HH:mm:ss` convention

#### Notes

- Current default sort is `reading_id desc`.
- `from` must be earlier than or equal to `to`.

## 4. Common Validation / Error Notes

- `page` and `page_size` must be positive integers.
- `page_size` is clamped to a maximum of `100`.
- `q` must be `100` characters or fewer.
- `sort_dir` must be `asc` or `desc`.
- Sort fields are whitelist-based per endpoint.
- `device-usage` requires `date` in `YYYY-MM-DD` format and only accepts `status=success|fail`.
- Invalid JSON request bodies return:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_JSON",
    "message": "Malformed JSON request body"
  }
}
```

## 5. Example Testing Flow

Recommended quick manual test order:
1. Call `GET /api/v1/dashboard`
2. Call `GET /api/v1/dashboard/realtime` using the previous `last_ts`
3. Call `POST /api/v1/devices/:device_id/toggle`
4. Call `GET /api/v1/actions` to confirm action rows
5. Call `GET /api/v1/device-usage` to confirm daily On/Off counts for all devices
6. Call `GET /api/v1/sensor-readings` to confirm telemetry-backed sensor rows

Useful artifacts:
- [docs/postman/IOT_MVP.postman_collection.json](../postman/IOT_MVP.postman_collection.json)
- [docs/postman/IOT_Local.postman_environment.json](../postman/IOT_Local.postman_environment.json)
