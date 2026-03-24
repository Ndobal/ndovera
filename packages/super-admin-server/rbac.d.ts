import { Request, Response, NextFunction } from 'express';
export type SuperUser = {
    id: string;
    name?: string;
    email?: string;
    roles: string[];
    activeRole?: string;
};
export declare function attachSuperUserFromHeaders(req: Request, res: Response, next: NextFunction): void;
export declare function createSuperSessionCookie(user: SuperUser, rememberMe?: boolean): string;
export declare function clearSuperSessionCookie(): string;
export declare function requireSuperRole(...allowed: string[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function superHasPermission(user: SuperUser | undefined, permission: string): boolean;
