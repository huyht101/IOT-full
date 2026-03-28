# Backend MVP Integration Checklist (Windows)

This checklist verifies the current backend locally on Windows without changing code. It assumes:

- A fresh MySQL schema initialized from `SQL/init.sql`
- One local MQTT broker on `127.0.0.1:1884`
- PowerShell
- Mosquitto CLI installed (`mosquitto_pub.exe`, `mosquitto_sub.exe`)

Use `curl.exe` for HTTP requests so non-2xx responses are still easy to inspect in PowerShell.

## Local Setup

### 1. Install dependencies

Purpose: Make the local environment match the repo assumptions.

Run:

```powershell
npm install
Copy-Item .env.example .env
```

Expected DB changes: None.

Expected behavior: None yet.

Verify in logs: None.

### 2. Initialize MySQL

Purpose: Create the 6-table schema and seed devices, sensors, and initial device state.

Run:

```powershell
mysql -u root -p -e "DROP DATABASE IF EXISTS iot_demo; CREATE DATABASE iot_demo;"
Get-Content .\SQL\init.sql | mysql -u root -p iot_demo
mysql -u root -p iot_demo -e "SELECT device_id, device_code FROM devices ORDER BY device_id; SELECT sensor_id, sensor_code FROM sensors ORDER BY sensor_id; SELECT device_id, state, last_action_id FROM device_state ORDER BY device_id;"
```

Expected DB changes:

- `devices`: `LED1`, `LED2`, `LED3`
- `sensors`: `TEMP`, `HUM`, `LIGHT`
- `device_state`: 3 rows, all OFF
- `sensor_state`: empty
- `actions`: empty

Expected behavior: None yet.

Verify in logs: MySQL import succeeds with no SQL errors.

### 3. Start the backend and helper terminals

Purpose: Verify env loading, DB connection, MQTT connection, and HTTP startup.

Run in separate terminals:

```powershell
# Terminal A: backend
npm run dev

# Terminal B: command topic watcher
mosquitto_sub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/cmd' -v

# Terminal C: ACK topic watcher
mosquitto_sub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/ack' -v

# Terminal D: MySQL shell
mysql -u root -p iot_demo
```

Expected DB changes: None.

Expected behavior: HTTP server listens on port `4000`.

Verify in logs:

- `MQTT connected: mqtt://127.0.0.1:1884`
- `MQTT subscribed: iot/demo/esp32_01/telemetry, iot/demo/esp32_01/ack`
- `HTTP server listening on port 4000`

### 4. Keep these SQL checks handy

Purpose: Reuse the same DB inspection after each test.

Run in Terminal D as needed:

```sql
SELECT action_id, device_id, action, status, requested_at, acked_at
FROM actions ORDER BY action_id DESC LIMIT 10;

SELECT device_id, state, updated_at, last_action_id
FROM device_state ORDER BY device_id;

SELECT sensor_id, ts, value_num, updated_at
FROM sensor_state ORDER BY sensor_id;

SELECT reading_id, sensor_id, ts, value_num
FROM sensor_readings ORDER BY reading_id DESC LIMIT 12;
```

Expected DB changes: None by themselves.

Expected behavior: None.

Verify in logs: None.

## Manual Test Cases

### 5. Valid telemetry full snapshot

Purpose: Verify normal telemetry ingest transaction.

Setup: Fresh server running.

Run:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/telemetry' -m '{"ts_ms":1000,"temp":28.4,"hum":71.2,"light":1830,"devices":[{"code":"LED1","state":1},{"code":"LED2","state":0},{"code":"LED3","state":1}]}'
```

Expected DB changes:

- `sensor_readings`: 3 new rows for TEMP/HUM/LIGHT
- `sensor_state`: 3 upserted rows with one backend-assigned timestamp
- `device_state`: LED1=1, LED2=0, LED3=1
- `last_action_id`: unchanged

Expected API response / behavior:

- No direct API response
- Dashboard later reflects these values

Verify in logs:

- No `Ignoring telemetry payload`
- No `MQTT message handling failed`

### 6. Telemetry with `temp=null`

Purpose: Verify TEMP insert/update is skipped while HUM/LIGHT still process.

Setup: Run after case 5.

Run:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/telemetry' -m '{"ts_ms":2000,"temp":null,"hum":72.5,"light":1845,"devices":[{"code":"LED1","state":1},{"code":"LED2","state":1},{"code":"LED3","state":0}]}'
```

Expected DB changes:

- `sensor_readings`: 2 new rows only for HUM and LIGHT
- TEMP reading count does not increase
- `sensor_state`: HUM and LIGHT update
- TEMP `sensor_state.ts/value_num` stays at the previous valid value
- `device_state`: LED1=1, LED2=1, LED3=0

Expected API response / behavior:

- Dashboard shows latest HUM/LIGHT and previous valid TEMP

Verify in logs: No error log.

### 7. Telemetry with `hum=null`

Purpose: Verify HUM insert/update is skipped while TEMP/LIGHT still process.

Setup: Run after case 6.

Run:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/telemetry' -m '{"ts_ms":3000,"temp":29.1,"hum":null,"light":1900,"devices":[{"code":"LED1","state":0},{"code":"LED2","state":1},{"code":"LED3","state":0}]}'
```

Expected DB changes:

- `sensor_readings`: 2 new rows only for TEMP and LIGHT
- HUM reading count does not increase
- `sensor_state`: TEMP and LIGHT update
- HUM `sensor_state.ts/value_num` stays at the previous valid value
- `device_state`: LED1=0, LED2=1, LED3=0

Expected API response / behavior:

- Dashboard shows latest TEMP/LIGHT and previous valid HUM

Verify in logs: No error log.

### 8. Telemetry with malformed `devices[]`

Purpose: Verify malformed telemetry is rejected safely with no DB writes.

Setup: Note current row counts first from Terminal D.

Run:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/telemetry' -m '{"ts_ms":4000,"temp":30.0,"hum":70.0,"light":2000,"devices":{"code":"LED1","state":1}}'
```

Expected DB changes:

- No new `sensor_readings`
- No `sensor_state` changes
- No `device_state` changes

Expected API response / behavior: None.

Verify in logs:

- `Ignoring telemetry payload: devices must be an array`

### 9. Toggle success

Purpose: Verify `PENDING -> SUCCESS`, command publish, ACK success, and fast `device_state` update.

Setup: Force all LEDs OFF first so the expected state is deterministic.

Run:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/telemetry' -m '{"ts_ms":5000,"temp":28.0,"hum":68.0,"light":1700,"devices":[{"code":"LED1","state":0},{"code":"LED2","state":0},{"code":"LED3","state":0}]}'
curl.exe -i -X POST 'http://127.0.0.1:4000/api/v1/devices/1/toggle' -H 'Content-Type: application/json' -d '{"action":"on"}'
```

Expected DB changes:

- The POST inserts one `actions` row as `PENDING`
- After ACK success, that row becomes `SUCCESS` with `acked_at`
- `device_state` for `device_id=1` becomes `state=1`
- `device_state.last_action_id` becomes the new `action_id`

Expected API response / behavior:

- The POST blocks until ACK arrives
- Response is HTTP 200 with `ok:true`
- Response data includes `status:"SUCCESS"` and `device_state.state=1`

Verify in logs:

- Terminal B shows a command like `{"action_id":X,"device_code":"LED1","action":"on"}`
- Publish the matching ACK from another window:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/ack' -m '{"action_id":X,"success":true}'
```

- Terminal A shows the POST as HTTP 200
- No `ACK success finalization failed`

### 10. Toggle ACK false

Purpose: Verify `PENDING -> FAIL` on negative ACK and no `device_state` update in the toggle flow.

Setup: Ensure LED2 is OFF via telemetry if needed.

Run:

```powershell
curl.exe -i -X POST 'http://127.0.0.1:4000/api/v1/devices/2/toggle' -H 'Content-Type: application/json' -d '{"action":"on"}'
```

Expected DB changes:

- One new `actions` row is inserted as `PENDING`
- After negative ACK, it becomes `FAIL` with `acked_at`
- `device_state` for `device_id=2` stays at its previous state

Expected API response / behavior:

- HTTP 502
- `ok:false`
- `error.code:"ACTION_FAILED"`
- `error.message:"ACK reported failure"`
- `data.status:"FAIL"`

Verify in logs:

- Terminal B shows the LED2 command payload
- Publish:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/ack' -m '{"action_id":Y,"success":false}'
```

- Terminal A shows HTTP 502 and no crash

### 11. Toggle timeout

Purpose: Verify no ACK causes FAIL after `ACK_TIMEOUT_MS`.

Setup: Use LED3 and do not publish any ACK.

Run:

```powershell
curl.exe -i -X POST 'http://127.0.0.1:4000/api/v1/devices/3/toggle' -H 'Content-Type: application/json' -d '{"action":"on"}'
```

Expected DB changes:

- One new `actions` row is inserted as `PENDING`
- After about 5 seconds it becomes `FAIL` with `acked_at`
- `device_state` for `device_id=3` stays unchanged

Expected API response / behavior:

- HTTP 504
- `ok:false`
- `error.code:"ACTION_FAILED"`
- `error.message:"ACK timeout"`
- `data.status:"FAIL"`

Verify in logs:

- Terminal B shows the LED3 command payload
- Terminal A shows the POST as HTTP 504
- No uncaught exception

### 12. Late ACK after timeout

Purpose: Verify late ACK is ignored after timeout finalization.

Setup: Reuse the `action_id` from case 11 after it already failed.

Run:

```powershell
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/ack' -m '{"action_id":Z,"success":true}'
```

Expected DB changes:

- No further changes to that `actions` row
- It stays `FAIL`
- `device_state` remains unchanged

Expected API response / behavior: None.

Verify in logs:

- `Ignoring ACK for action Z: no pending entry`

### 13. DEVICE_BUSY

Purpose: Verify concurrent toggle on the same device is rejected while an earlier action is still `PENDING`.

Setup: Start one request for LED1 and do not ACK it yet. Send a second request on LED1 from another PowerShell window within 5 seconds.

Run:

```powershell
# Window 1
curl.exe -i -X POST 'http://127.0.0.1:4000/api/v1/devices/1/toggle' -H 'Content-Type: application/json' -d '{"action":"off"}'

# Window 2, before Window 1 finishes
curl.exe -i -X POST 'http://127.0.0.1:4000/api/v1/devices/1/toggle' -H 'Content-Type: application/json' -d '{"action":"on"}'
```

Expected DB changes:

- First request inserts one `PENDING` row
- Second request inserts nothing
- Only the first row later finalizes

Expected API response / behavior:

- Window 2 returns HTTP 409
- Response body includes `ok:false` and `error.code:"DEVICE_BUSY"`
- Window 1 eventually returns 200, 502, or 504 depending on ACK outcome

Verify in logs:

- Terminal A shows one hanging POST and a second POST as 409

### 14. Dashboard first load

Purpose: Verify current state joins and the 3-hour chart payload.

Setup: Run after telemetry cases 5 to 7.

Run:

```powershell
curl.exe -s 'http://127.0.0.1:4000/api/v1/dashboard'
```

Expected DB changes: None.

Expected API response / behavior:

- `ok:true`
- `data.devices` contains 3 rows with current LED state
- `data.sensors` contains TEMP/HUM/LIGHT with latest valid values
- `data.chart_pts` contains recent chart points
- `data.last_ts` is non-null once data exists

Verify in logs:

- Terminal A shows GET 200

### 15. Dashboard realtime with valid `since`

Purpose: Verify delta polling behavior.

Setup: Capture `last_ts`, then publish one new valid telemetry message.

Run:

```powershell
$first = curl.exe -s 'http://127.0.0.1:4000/api/v1/dashboard'
$since = (( $first | ConvertFrom-Json ).data.last_ts)
mosquitto_pub.exe -h 127.0.0.1 -p 1884 -t 'iot/demo/esp32_01/telemetry' -m '{"ts_ms":6000,"temp":27.8,"hum":67.5,"light":1600,"devices":[{"code":"LED1","state":1},{"code":"LED2","state":0},{"code":"LED3","state":1}]}'
curl.exe -s "http://127.0.0.1:4000/api/v1/dashboard/realtime?since=$since"
```

Expected DB changes:

- 3 new `sensor_readings`
- 3 `sensor_state` updates
- 3 `device_state` updates

Expected API response / behavior:

- `ok:true`
- `data.new_pts` contains only points newer than `$since`
- `data.new_last_ts` is newer than `$since`
- `devices` and `sensors` reflect the latest state

Verify in logs:

- No telemetry error log
- Terminal A shows GET 200

### 16. Dashboard realtime with future `since`

Purpose: Verify future timestamps are rejected clearly.

Setup: None beyond the running server.

Run:

```powershell
curl.exe -i 'http://127.0.0.1:4000/api/v1/dashboard/realtime?since=2099-01-01T00:00:00.000Z'
```

Expected DB changes: None.

Expected API response / behavior:

- HTTP 400
- `ok:false`
- `error.code:"VALIDATION_ERROR"`
- `error.message:"since cannot be in the future"`

Verify in logs:

- Terminal A shows GET 400
- No stack trace

### 17. Action History sort/filter/page

Purpose: Verify pagination, filtering, and whitelist sorting for action records.

Setup: Use the data created by cases 9 to 13.

Run:

```powershell
curl.exe -s 'http://127.0.0.1:4000/api/v1/actions?page=1&page_size=2&status=FAIL&sort_by=requested_at&sort_dir=desc'
curl.exe -s 'http://127.0.0.1:4000/api/v1/actions?page=2&page_size=2&sort_by=device_code&sort_dir=asc'
```

Expected DB changes: None.

Expected API response / behavior:

- First call returns only FAIL rows
- First call includes `meta.page=1` and `meta.page_size=2`
- Second call returns the next page
- Sorting follows the allowed fields only

Verify in logs:

- Terminal A shows both GETs as 200

### 18. Sensor History sort/filter/page

Purpose: Verify filtering, paging, and sort mapping for sensor reading history.

Setup: Use the data created by cases 5 to 7 and 15.

Run:

```powershell
curl.exe -s 'http://127.0.0.1:4000/api/v1/sensor-readings?page=1&page_size=2&sensor_code=TEMP&sort_by=ts&sort_dir=desc'
curl.exe -s 'http://127.0.0.1:4000/api/v1/sensor-readings?page=1&page_size=3&sensor_type=light&sort_by=value_num&sort_dir=asc'
```

Expected DB changes: None.

Expected API response / behavior:

- First call returns only TEMP rows
- Second call returns only `sensor_type=light`
- Both include pagination metadata

Verify in logs:

- Terminal A shows both GETs as 200

### 19. Invalid toggle action

Purpose: Verify body validation on `/toggle`.

Setup: None.

Run:

```powershell
curl.exe -i -X POST 'http://127.0.0.1:4000/api/v1/devices/1/toggle' -H 'Content-Type: application/json' -d '{"action":"blink"}'
```

Expected DB changes:

- No new `actions` row

Expected API response / behavior:

- HTTP 400
- `ok:false`
- `error.code:"VALIDATION_ERROR"`

Verify in logs:

- Terminal A shows POST 400

### 20. Actions history invalid range

Purpose: Verify `from <= to` validation.

Setup: None.

Run:

```powershell
curl.exe -i 'http://127.0.0.1:4000/api/v1/actions?from=2026-03-29T00:00:00Z&to=2026-03-28T00:00:00Z'
```

Expected DB changes: None.

Expected API response / behavior:

- HTTP 400
- `ok:false`
- `error.code:"VALIDATION_ERROR"`
- Message indicates `from` must be less than or equal to `to`

Verify in logs:

- Terminal A shows GET 400

### 21. Sensor history invalid sort field

Purpose: Verify sort whitelist enforcement.

Setup: None.

Run:

```powershell
curl.exe -i 'http://127.0.0.1:4000/api/v1/sensor-readings?sort_by=drop_table&sort_dir=asc'
```

Expected DB changes: None.

Expected API response / behavior:

- HTTP 400
- `ok:false`
- `error.code:"VALIDATION_ERROR"`

Verify in logs:

- Terminal A shows GET 400

### 22. Dashboard realtime missing `since`

Purpose: Verify required query validation.

Setup: None.

Run:

```powershell
curl.exe -i 'http://127.0.0.1:4000/api/v1/dashboard/realtime'
```

Expected DB changes: None.

Expected API response / behavior:

- HTTP 400
- `ok:false`
- `error.code:"VALIDATION_ERROR"`
- `error.message:"since is required"`

Verify in logs:

- Terminal A shows GET 400

## Acceptance Criteria

1. Startup succeeds with DB and MQTT connected.
2. Telemetry writes only valid sensor values, always processes LIGHT, and updates `device_state` from the full snapshot.
3. Toggle flow produces `SUCCESS` only on `ACK success=true`.
4. Publish fail, ACK false, and timeout produce `FAIL` and do not change `device_state` in that toggle flow.
5. Late ACK is ignored.
6. `DEVICE_BUSY` blocks overlapping pending commands on the same device.
7. Dashboard first load and realtime polling return the current MVP payload shapes.
8. History endpoints honor filters, sort whitelists, and pagination.
9. Validation failures return 400 with the standard error wrapper and no process crash.

## Assumptions

- `SQL/init.sql` is used once on a fresh DB, so `device_id` 1/2/3 map to LED1/LED2/LED3 and `sensor_id` 1/2/3 map to TEMP/HUM/LIGHT.
- Commands above assume PowerShell and local Mosquitto CLI tooling.
- `ACK_TIMEOUT_MS=5000` from `.env`.
- Some successful flows do not emit a custom business log, so verify them by HTTP status, DB state, and absence of error logs.
