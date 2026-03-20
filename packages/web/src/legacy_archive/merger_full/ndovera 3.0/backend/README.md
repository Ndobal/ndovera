# Ndovera Backend API

This backend is built with Node.js (Express), PostgreSQL (Prisma ORM), and follows strict security best practices:

- Argon2 password hashing
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Secure REST API for Students, Staff, Ledger, Attendance, LamsTransactions
- Input validation and sanitization
- Rate limiting and brute-force protection
- Secure CORS and HTTP headers
- Audit logging and monitoring
- HTTPS-ready configuration

## Setup
1. Copy `.env.example` to `.env` and set your secrets and database URL.
2. Run `npm install` in the backend directory.
3. Run `npx prisma migrate dev` to set up the database.
4. Start the server: `npm run dev` (or `npm start` for production)

## Security Notes
- All sensitive data is encrypted at rest and in transit.
- All endpoints are protected by RBAC and input validation.
- Audit logs are kept for all sensitive actions.

## Deployment
- Ready for cloud platforms (Render, Railway, Vercel, etc.)
- HTTPS strongly recommended in production.

---
