NDOVERA Library Feature

This folder implements the unified Library system with three locked tabs:
- E-Books (digital library)
- Offline Library (school-scoped physical inventory)
- Book Studio (ND-BOOK creation/export)

Security notes:
- Downloads are packaged per-user (DRM simulation in `service/libraryService.js`).
- AI review is simulated client-side; replace with server-side AI in production.

Integration:
- Import `src/features/library` and add to the main Sidebar/Routes where needed.

Admin & Librarian panels are provided for local UI flows and should connect to secure back-end endpoints for audit logs and inventory management.
