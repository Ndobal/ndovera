# Ndovera Library Server

This small Express.js server provides backend endpoints for the Library feature such as:

- **POST /api/purchase** – validate payment amount, issue a license JWT
- **POST /api/package** – verify license and generate download token + ND-BOOK payload
- **POST /api/admin/log** – record admin decisions (approval, reject)
- **POST /api/ai/review** – returns a canned review report (replace with real AI service in production)

## Setup

```powershell
cd c:\Users\HP\Documents\ndovera\frontend\server
npm install
npm start    # server listens on port 4000 by default
```

Environment variables (see `.env`):
- `JWT_SECRET` – secret key for license tokens
- `PORT` – server port (default 4000)

This server is a lightweight prototype; real deployment should use a proper database, persistent audit logs, secure key management, payment gateway integration, and production-grade hosting.
