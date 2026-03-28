# IoT Dashboard Frontend

React + Vite frontend for the current IoT MVP. This frontend integrates with the existing backend only and does not change backend behavior or schema.

## Stack

- React
- Vite
- React Router
- Recharts
- Lucide React
- CSS Modules

## Setup

1. Move into the frontend workspace:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create the local environment file:

```powershell
Copy-Item .env.example .env
```

4. Start the development server:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
```

## Environment

The frontend reads the backend base URL from `VITE_API_BASE_URL`.

Default:

```env
VITE_API_BASE_URL=http://127.0.0.1:4000
```

If your backend runs elsewhere, update `.env` before starting Vite.

## Frontend-only automation

This phase keeps automation in the frontend only.

- Selected rules are stored in `localStorage`
- Rules are re-evaluated whenever dashboard data refreshes
- The frontend calls the existing toggle endpoint when a selected rule implies a different device state
- Duplicate toggle spam is prevented by checking the current known state, per-device in-flight status, and the last automation attempt for each device

No backend automation endpoint is added in this frontend workspace.
