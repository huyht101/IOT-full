# API Documentation

## 1. Overview

This document describes the current backend API surface for the final IoT Dashboard MVP.

The backend exposes five core HTTP endpoints:
- `GET /api/v1/dashboard`
- `GET /api/v1/dashboard/realtime`
- `POST /api/v1/devices/:device_id/toggle`
- `GET /api/v1/actions`
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

#### Path params

- None

#### Query params

- None

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
- The frontend currently renders timestamps in a fixed UTC+07 display convention.

### 3.2 Get Dashboard Realtime

- **Method + URL:** `GET /api/v1/dashboard/realtime?since=...`
- **Purpose:** Return delta chart points plus the latest current device/sensor snapshot for frontend polling.

#### Path params

- None

#### Query params

| Name | Required | Description |
| --- | --- | --- |
| `since` | Yes | Valid datetime string. Best sourced from the previous dashboard response `last_ts`. Future values are rejected. |

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
        "updated_at": "2026-03-29T12:44:10.000Z",
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
        "value_num": 29.1,
        "ts": "2026-03-29T12:44:10.000Z",
        "updated_at": "2026-03-29T12:44:10.000Z"
      }
    ],
    "new_pts": [
      {
        "ts": "2026-03-29T12:44:10.000Z",
        "temp": 29.1,
        "hum": 79.8,
        "light": 2980
      }
    ],
    "new_last_ts": "2026-03-29T12:44:10.000Z"
  }
}
```

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
- **Purpose:** Execute a manual device action and wait for publish/ACK finalization.

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

#### Success response example

```json
{
  "ok": true,
  "data": {
    "action_id": 123,
    "device_id": 1,
    "device_code": "LED1",
    "action": "on",
    "status": "SUCCESS",
    "requested_at": "2026-03-29T12:45:00.000Z",
    "acked_at": "2026-03-29T12:45:01.000Z",
    "device_state": {
      "state": 1,
      "updated_at": "2026-03-29T12:45:01.000Z",
      "last_action_id": 123
    }
  }
}
```

#### Failure response examples

Device already busy:

```json
{
  "ok": false,
  "error": {
    "code": "DEVICE_BUSY",
    "message": "Device already has a pending action"
  }
}
```

ACK timeout:

```json
{
  "ok": false,
  "error": {
    "code": "ACTION_FAILED",
    "message": "ACK timeout"
  },
  "data": {
    "action_id": 124,
    "device_id": 1,
    "device_code": "LED1",
    "action": "on",
    "status": "FAIL",
    "requested_at": "2026-03-29T12:45:10.000Z",
    "acked_at": "2026-03-29T12:45:15.000Z"
  }
}
```

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

Examples:
- `q=2026-03-29`
- `q=2026-03-29 19:30`
- `q=2026-03-29T19:30`
- `q=12`
- `q=LED1`

#### Success response example

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "action_id": 123,
        "device_id": 1,
        "device_code": "LED1",
        "device_name": "LED 1",
        "device_type": "LED",
        "action": "on",
        "status": "SUCCESS",
        "requested_at": "2026-03-29T12:45:00.000Z",
        "acked_at": "2026-03-29T12:45:01.000Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "page_size": 10,
    "total_items": 1,
    "total_pages": 1,
    "sort_by": "requested_at",
    "sort_dir": "desc"
  }
}
```

#### Error response example

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "sort_by is not allowed"
  }
}
```

#### Notes

- Default sort is `requested_at desc`.
- `from` must be earlier than or equal to `to`.

### 3.5 Get Sensor History

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

Examples:
- `q=15`
- `q=TEMP`
- `q=temperature`
- `q=28.4`
- `q=1830`
- `q=2026-03-29`
- `q=2026-03-29 19:30`

#### Success response example

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "reading_id": 15,
        "sensor_id": 1,
        "sensor_code": "TEMP",
        "sensor_type": "temperature",
        "sensor_name": "Temperature",
        "unit": "°C",
        "ts": "2026-03-29T12:44:08.000Z",
        "value_num": 28.9
      }
    ]
  },
  "meta": {
    "page": 1,
    "page_size": 10,
    "total_items": 1,
    "total_pages": 1,
    "sort_by": "reading_id",
    "sort_dir": "desc"
  }
}
```

#### Notes

- Current default sort is `reading_id desc`.
- `from` must be earlier than or equal to `to`.

## 4. Common Validation / Error Notes

- `page` and `page_size` must be positive integers.
- `page_size` is clamped to a maximum of `100`.
- `q` must be `100` characters or fewer.
- `sort_dir` must be `asc` or `desc`.
- Sort fields are whitelist-based per endpoint.
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

- Unknown routes return `404 NOT_FOUND`.
- Unhandled server errors return `500 INTERNAL_ERROR`.

## 5. Example Testing Flow

Recommended quick manual test order:
1. Call `GET /api/v1/dashboard`
2. Call `GET /api/v1/dashboard/realtime` using the previous `last_ts`
3. Call `POST /api/v1/devices/:device_id/toggle`
4. Call `GET /api/v1/actions` to confirm action rows
5. Call `GET /api/v1/sensor-readings` to confirm telemetry-backed sensor rows

Useful artifacts:
- [docs/postman/IOT_MVP.postman_collection.json](../postman/IOT_MVP.postman_collection.json)
- [docs/postman/IOT_Local.postman_environment.json](../postman/IOT_Local.postman_environment.json)
