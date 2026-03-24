declare module 'better-sqlite3'
declare module 'multer'
declare module 'cookie-parser'
declare module 'csurf'
declare module 'bcryptjs'

declare namespace Express {
	interface Request {
		file?: {
			buffer: Buffer
			[key: string]: any
		}
	}

	namespace Multer {
		interface File {
			buffer: Buffer
			[key: string]: any
		}
	}
}
