# IoT Dashboard MVP

Full-stack IoT demo system for monitoring environmental telemetry, controlling devices, and reviewing device and sensor activity.

This repository contains:
- a Node.js + Express backend
- a React + Vite frontend
- MySQL schema/init scripts
- MQTT integration for ESP32 telemetry and ACK-driven device control

## 1. Overview

The current MVP supports one ESP32 board that publishes:
- sensors: `TEMP`, `HUM`, `LIGHT`
- devices: `LED1`, `LED2`, `LED3`, `LED4`, `LED5`

The system flow is:
- ESP32 publishes telemetry to Mosquitto
- backend ingests telemetry and stores canonical state in MySQL
- frontend polls backend APIs for dashboard and history/statistics views
- manual device toggles and frontend-only automation use the same backend toggle API

## 2. Main Features

- Polling-based realtime dashboard
- Manual device toggle with MQTT ACK handling
- Action History with search, filters, pagination, and auto refresh while open
- Device Usage chart with daily all-device aggregation and auto refresh while open
- Sensor History with search across displayed fields, pagination, ID-based sort, and auto refresh while open
- Frontend-only automation rules stored in `localStorage`
- MQTT telemetry ingest with full active-device snapshot validation

## 3. System Architecture

High-level flow:
- ESP32 -> MQTT Broker -> Express backend -> MySQL
- React frontend -> HTTP APIs -> Express backend

Important current runtime behavior:
- Dashboard uses HTTP polling every 2 seconds
- Action History auto-refreshes every 5 seconds while its page is open
- Device Usage auto-refreshes every 5 seconds while its page is open
- Sensor History auto-refreshes every 5 seconds while its page is open
- Automation is frontend-only and runs globally while the SPA is open
- Backend assigns canonical DB timestamps; telemetry `ts_ms` is debug/order only

## 4. Technologies Used

- Frontend: React 18, Vite, React Router, Recharts, CSS Modules
- Backend: Node.js, Express, mysql2/promise, mqtt.js
- Database: MySQL 8.x
- Broker: Mosquitto
- Hardware: ESP32

## 5. Project Structure

```text
.
|-- docs/
|   |-- api/
|   |   |-- API.md
|   |   `-- openapi.yaml
|   |-- postman/
|   |   |-- IOT_Local.postman_environment.json
|   |   `-- IOT_MVP.postman_collection.json
|   `-- backend-mvp-integration-checklist-windows.md
|-- frontend/
|   |-- public/
|   |   `-- openapi.yaml
|   |-- src/
|   |-- .env.example
|   `-- package.json
|-- SQL/
|   `-- init.sql
|-- src/
|   |-- config/
|   |-- constants/
|   |-- controllers/
|   |-- middleware/
|   |-- mqtt/
|   |-- repositories/
|   |-- routes/
|   |-- services/
|   |-- utils/
|   |-- app.js
|   `-- server.js
|-- .env.example
|-- package.json
`-- scripts/
    `-- check-syntax.js
```

## 6. Environment Variables

### Backend (`.env`)

Copy the backend template first:

```powershell
Copy-Item .env.example .env
```

Current backend variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | Express HTTP port |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_NAME` | MySQL schema name |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `MQTT_URL` | Broker URL used by mqtt.js |
| `MQTT_TOPIC_TELEMETRY` | Telemetry subscribe topic |
| `MQTT_TOPIC_CMD` | Device command publish topic |
| `MQTT_TOPIC_ACK` | ACK subscribe topic |
| `ACK_TIMEOUT_MS` | Toggle ACK timeout in milliseconds |
| `TZ` | Node timezone for consistent backend timestamps; current template uses `UTC` |

### Frontend (`frontend/.env`)

Copy the frontend template:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Current frontend variable:

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL for the backend API; default `http://127.0.0.1:4000` |

## 7. Local Setup / Run Guide

### 7.1 Start Mosquitto

The backend expects a broker at:

```text
mqtt://127.0.0.1:1884
```

You can use any Mosquitto setup that listens on that host/port, or adjust `MQTT_URL` in `.env`.

### 7.2 Initialize MySQL

The canonical schema/init file is:

- [SQL/init.sql](SQL/init.sql)

Apply it with the MySQL CLI:

```powershell
Get-Content .\SQL\init.sql | mysql -u root -p
```

Notes:
- the script drops and recreates `iot_demo`
- it seeds five devices and three sensors
- it seeds `device_state`
- `sensor_state` is intentionally empty until first valid telemetry

### 7.3 Run Backend

Install backend dependencies:

```bash
npm install
```

Start the backend in development mode:

```bash
npm run dev
```

Start in normal mode:

```bash
npm start
```

Syntax check:

```bash
npm run check
```

### 7.4 Run Frontend

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 8. MQTT Topics / Payload Summary

Current topics from `.env.example`:

- telemetry: `iot/demo/esp32_01/telemetry`
- command: `iot/demo/esp32_01/cmd`
- ack: `iot/demo/esp32_01/ack`

### Telemetry payload

Expected high-level shape:

```json
{
  "ts_ms": 1711711800000,
  "temp": 28.4,
  "hum": 71.2,
  "light": 1830,
  "devices": [
    { "code": "LED1", "state": 1 },
    { "code": "LED2", "state": 0 },
    { "code": "LED3", "state": 1 },
    { "code": "LED4", "state": 0 },
    { "code": "LED5", "state": 1 }
  ]
}
```

Notes:
- `devices[]` must be the full active device snapshot
- `temp` and `hum` may be `null`
- `light` must be numeric
- backend uses server time for DB timestamps
- `ts_ms` is not used as the canonical DB timestamp

### Command payload

Published by backend to the command topic:

```json
{
  "action_id": 123,
  "device_code": "LED1",
  "action": "on"
}
```

### ACK payload

Published by ESP32 to the ACK topic:

```json
{
  "action_id": 123,
  "success": true
}
```

## 9. API Summary

Current core backend endpoints:
- `GET /api/v1/dashboard`
- `GET /api/v1/dashboard/realtime?since=...`
- `POST /api/v1/devices/:device_id/toggle`
- `GET /api/v1/actions`
- `GET /api/v1/device-usage`
- `GET /api/v1/sensor-readings`

Detailed API documentation:
- [docs/api/API.md](docs/api/API.md)

Postman artifacts:
- [docs/postman/IOT_MVP.postman_collection.json](docs/postman/IOT_MVP.postman_collection.json)
- [docs/postman/IOT_Local.postman_environment.json](docs/postman/IOT_Local.postman_environment.json)

OpenAPI files:
- [docs/api/openapi.yaml](docs/api/openapi.yaml)
- [frontend/public/openapi.yaml](frontend/public/openapi.yaml)

Frontend Swagger-style docs route:
- `/api-docs` when the Vite frontend is running

## 10. Frontend-Only Automation Note

Automation currently runs in the frontend only.

Current behavior:
- rule selections are stored in `localStorage`
- the automation runner lives at app level, not only on Dashboard
- rules keep evaluating while the SPA is open
- rules stop when the browser tab/app is closed
- backend does not persist automation rules
- backend does not distinguish manual vs automation action source

Current generic rules:
- Rule 1: if temperature > 30 -> ON, else OFF
- Rule 2: if light < 1000 -> ON, else OFF
- Rule 3: if humidity > 80 -> OFF, else ON

## 11. Known Limitations

- Single-board MVP assumptions are hardcoded through current seed/config expectations
- Automation is frontend-only for this phase
- Dashboard/history updates use polling, not WebSocket/SSE
- Pending ACK tracking is in-memory in the backend process
- Local demo runs assume a reachable Mosquitto broker and one active browser session for frontend automation

## 12. Future Improvements

- Move automation from frontend-only to backend-managed rules
- Track action source (manual vs automation)
- Add stronger deployment/runtime config for multi-instance backends
- Add richer dashboards and reporting
- Add authentication and access control if the project scope expands

## 13. Demo / Testing Notes

Suggested quick demo flow:
1. Start Mosquitto and MySQL
2. Initialize DB with `SQL/init.sql`
3. Run backend and frontend
4. Open Dashboard and confirm live sensor/device state
5. Send telemetry and observe dashboard updates
6. Toggle a device and observe Action History update
7. Open Device Usage and verify daily On/Off counts for all five devices
8. Open Sensor History and verify auto refresh plus search behavior
9. Demonstrate a frontend-only automation rule while staying on a non-Dashboard page

Detailed Windows integration checklist:
- [docs/backend-mvp-integration-checklist-windows.md](docs/backend-mvp-integration-checklist-windows.md)
