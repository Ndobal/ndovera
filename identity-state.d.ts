export type IdentityCategory = 'student' | 'staff' | 'parent' | 'admin' | 'alumni' | 'global';
export type IdentityUserStatus = 'active' | 'inactive';
export type SchoolRecord = {
    id: string;
    name: string;
    subdomain: string;
    createdAt: string;
};
export type IdentityUserRecord = {
    id: string;
    schoolId: string;
    schoolName: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    passwordHash: string;
    category: IdentityCategory;
    status: IdentityUserStatus;
    roles: string[];
    activeRole: string;
    aliases: string[];
    createdAt: string;
    updatedAt: string;
};
export type StudentRecord = {
    id: string;
    schoolId: string;
    schoolName: string;
    userId: string;
    name: string;
    parentUserIds: string[];
    status: 'active' | 'transferred' | 'alumni';
    previousUserIds: string[];
    createdAt: string;
    updatedAt: string;
};
export type TransferRecord = {
    id: string;
    studentId: string;
    fromSchoolId: string;
    toSchoolId: string;
    fromUserId: string;
    toUserId: string;
    reason?: string;
    requestedBy?: string;
    createdAt: string;
    completedAt: string;
};
export type IdentityLifecycleAction = 'deactivated' | 'reactivated';
export type IdentityLifecycleEventRecord = {
    id: string;
    userId: string;
    schoolId: string;
    schoolName: string;
    userName: string;
    action: IdentityLifecycleAction;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    reason?: string;
    createdAt: string;
};
export type IdentityState = {
    schools: SchoolRecord[];
    users: IdentityUserRecord[];
    students: StudentRecord[];
    transfers: TransferRecord[];
    lifecycleEvents: IdentityLifecycleEventRecord[];
    counters: Record<string, number>;
};
export type ProvisionInput = {
    category: IdentityCategory;
    schoolId?: string;
    schoolName?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    password?: string;
    roles?: string[];
};
export type CreateSchoolWithOwnerInput = {
    schoolName: string;
    subdomain: string;
    schoolId?: string;
    ownerName: string;
    ownerEmail?: string | null;
    ownerPhone?: string | null;
    ownerPassword?: string;
    ownerRoles?: string[];
};
export type UpdateIdentityUserInput = {
    userId: string;
    schoolId?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
    password?: string;
    roles?: string[];
    activeRole?: string;
    category?: IdentityCategory;
    status?: IdentityUserStatus;
    aliasToAdd?: string | null;
    auditActorId?: string;
    auditActorName?: string;
    auditActorRole?: string;
    auditReason?: string;
};
export type ListIdentityLifecycleEventsOptions = {
    schoolId?: string;
    userId?: string;
    limit?: number;
};
export declare function makeIdentityCode(category: IdentityCategory, schoolName: string, sequence: number): string;
export declare function loadIdentityState(): Promise<IdentityState>;
export declare function saveIdentityState(state: IdentityState): Promise<void>;
export declare function isIdentityUserActive(user: IdentityUserRecord): boolean;
export declare function listIdentityUsers(state: IdentityState, schoolId?: string, includeInactive?: boolean): IdentityUserRecord[];
export declare function listIdentityLifecycleEvents(state: IdentityState, options?: ListIdentityLifecycleEventsOptions): IdentityLifecycleEventRecord[];
export declare function ensureSchool(state: IdentityState, schoolId: string, schoolName: string, subdomain?: string): SchoolRecord;
export declare function countUsersByCategory(state: IdentityState, schoolId?: string): {
    students: number;
    staff: number;
    parents: number;
    admins: number;
    alumni: number;
    global: number;
    total: number;
};
export declare function countInactiveUsers(state: IdentityState, schoolId?: string): number;
export declare function buildMetrics(state: IdentityState): {
    schools: {
        id: string;
        name: string;
        subdomain: string;
        counts: {
            students: number;
            staff: number;
            parents: number;
            admins: number;
            alumni: number;
            global: number;
            total: number;
        };
        inactiveUsers: number;
    }[];
    totals: {
        students: number;
        staff: number;
        parents: number;
        admins: number;
        alumni: number;
        global: number;
        total: number;
    };
    inactiveUsers: number;
    transfers: number;
};
export declare function findUserByIdentifier(state: IdentityState, identifier: string): IdentityUserRecord | undefined;
export declare function verifyStoredPassword(password: string, passwordHash: string): any;
export declare function provisionUser(state: IdentityState, input: ProvisionInput): Promise<{
    user: IdentityUserRecord;
    temporaryPassword: string | null;
}>;
export declare function createSchoolWithOwner(state: IdentityState, input: CreateSchoolWithOwnerInput): Promise<{
    school: SchoolRecord;
    owner: IdentityUserRecord;
    temporaryPassword: string | null;
}>;
export declare function assignRoleToUser(state: IdentityState, input: {
    targetUserId: string;
    schoolId: string;
    role: string;
    makeActive?: boolean;
    uniquePerSchool?: boolean;
}): Promise<{
    user: IdentityUserRecord;
}>;
export declare function updateIdentityUser(state: IdentityState, input: UpdateIdentityUserInput): Promise<{
    user: IdentityUserRecord;
    lifecycleEvent: IdentityLifecycleEventRecord | null;
}>;
export declare function transferStudent(state: IdentityState, studentUserId: string, targetSchoolId: string, reason?: string, requestedBy?: string): Promise<{
    student: StudentRecord;
    user: IdentityUserRecord;
    transfer: TransferRecord;
}>;
