# Дымок Frontend

React + TypeScript + Vite frontend for the Dymok web interface.

## Commands

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
npm run build
npm run lint
npm run test:e2e -- --reporter=line
```

The frontend calls the backend at `VITE_API_BASE_URL` or `http://127.0.0.1:8000`
by default.
