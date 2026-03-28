# IoT Demo Backend MVP

Node.js + Express + MySQL + MQTT backend for the locked IoT demo MVP.

## Current MVP assumptions

- Exactly 1 ESP32 board is in scope.
- Current board publishes 3 sensors: `TEMP`, `HUM`, `LIGHT`.
- Current board controls 3 devices: `LED1`, `LED2`, `LED3`.
- No auth.
- Dashboard updates by HTTP polling every 2 seconds.
- MQTT telemetry is a full device snapshot every 2 seconds.
- MQTT ACK is per-device and keyed by `action_id`.
- Server time is the canonical timestamp source for all DB timestamps.

## Tech stack

- Node.js with CommonJS
- Express
- mysql2/promise
- mqtt.js
- dotenv
- cors
- morgan
- nodemon

## Project structure

```text
.
|-- docs/
|   `-- backend-mvp-integration-checklist-windows.md
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

## Setup

1. Install dependencies:

```bash
npm install
```

`node_modules` is local-only and should not be committed. After cloning or pulling the repo, run `npm install` to restore dependencies locally.

2. Create `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

`.env` is a local-only file and is ignored by git.

3. Initialize MySQL:

```powershell
Get-Content .\SQL\init.sql | mysql -u root -p
```

4. Start the backend in development mode:

```bash
npm run dev
```

5. Start in normal mode:

```bash
npm start
```

6. Run the syntax check across the whole `src/` tree:

```bash
npm run check
```

## Manual integration checklist

For a full Windows step-by-step backend verification flow, including exact MQTT payloads, API requests, DB checks, and expected logs, use:

- `docs/backend-mvp-integration-checklist-windows.md`

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP server port |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_NAME` | MySQL schema name |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `MQTT_URL` | Broker connection URL |
| `MQTT_TOPIC_TELEMETRY` | Telemetry subscribe topic |
| `MQTT_TOPIC_CMD` | Command publish topic |
| `MQTT_TOPIC_ACK` | ACK subscribe topic |
| `ACK_TIMEOUT_MS` | Toggle ACK timeout in milliseconds |
| `TZ` | Node.js timezone. Use `UTC` for consistent timestamps |

## MQTT startup behavior

- The MQTT client is created during server startup.
- The subscriber listens to:
  - `MQTT_TOPIC_TELEMETRY`
  - `MQTT_TOPIC_ACK`
- Telemetry messages are parsed safely and ingested in one DB transaction.
- ACK messages resolve the in-memory pending action map and update DB state.

## API endpoints

- `GET /api/v1/dashboard`
- `GET /api/v1/dashboard/realtime?since=ISO_DATETIME`
- `POST /api/v1/devices/:device_id/toggle`
- `GET /api/v1/actions`
- `GET /api/v1/sensor-readings`

For `GET /api/v1/dashboard/realtime`, `since` should come from the backend timestamp returned by the dashboard APIs. Future values are rejected.

All responses use the same wrapper:

```json
{
  "ok": true,
  "data": {}
}
```

or

```json
{
  "ok": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Some message"
  }
}
```

## Extension points

- Current device and sensor definitions are centralized in `src/constants/index.js`.
- Runtime device and sensor lookups are loaded from DB where practical.
- Current telemetry parsing lives in `src/services/telemetry.service.js`.
- Reusable device command execution lives in `src/services/deviceCommand.service.js`.
- A future automation module can call the same command execution service used by the toggle endpoint.

## Where to change things later

- Add future MVP devices:
  - Update seed data in `SQL/init.sql`
  - Update centralized demo constants in `src/constants/index.js`
  - If telemetry payload shape changes, extend `src/services/telemetry.service.js`

- Add future MVP sensors:
  - Update seed data in `SQL/init.sql`
  - Update centralized demo constants in `src/constants/index.js`
  - Extend the telemetry parser and dashboard chart pivot query

- Add future automation:
  - Reuse `src/services/deviceCommand.service.js`
  - Do not duplicate MQTT publish, ACK, and DB action logic elsewhere

## Current limitations to note

- The current `actions` table does not record whether the action source was manual UI or future automation.
- Pending ACK tracking is in-memory for this single-process MVP. A multi-instance deployment would need shared coordination.
- Current telemetry parsing is intentionally locked to the MVP payload shape with `temp`, `hum`, `light`, and a full `devices[]` snapshot.

## Minor assumptions used here

- `device_type` and `sensor_type` are stored as `VARCHAR` in MySQL for easier future extension, while validation is enforced in application code.
- `POST /api/v1/devices/:device_id/toggle` returns a success payload only on ACK success. Publish failure, ACK failure, and timeout return a wrapped error with the failed action data.
- The canonical initialization script for this backend is `SQL/init.sql`.
