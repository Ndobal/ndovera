import { Request, Response, NextFunction } from 'express';
export type User = {
    id: string;
    name?: string;
    email?: string;
    school_id?: string;
    roles: string[];
    activeRole?: string;
};
export declare function createSessionCookie(user: User, rememberMe?: boolean): string;
export declare function clearSessionCookie(): string;
export declare function attachUserFromHeaders(req: Request, res: Response, next: NextFunction): void;
export declare function requireRoles(...allowed: string[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function hasPermission(user: User | undefined, permission: string): boolean;
