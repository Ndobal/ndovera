export declare const mockData: {
    user: {
        id: string;
        name: string;
        role: string;
    };
    students: {
        id: string;
        name: string;
    }[];
    teachers: {
        id: string;
        name: string;
    }[];
    children: {
        id: string;
        name: string;
        grade: string;
    }[];
    announcements: {
        id: string;
        title: string;
        detail: string;
    }[];
    liveClasses: {
        id: string;
        title: string;
        schedule: string;
        attendees: number;
        limit: number;
        tools: string[];
    }[];
    financeStats: {
        totalCollected: number;
        outstanding: number;
    };
    dashboardSummary: {
        student: {
            stats: {
                latestAverage: string;
                subjectCount: number;
                liveClassCount: number;
                pendingAssignments: number;
                submittedAssignments: number;
            };
            liveClasses: never[];
            announcements: never[];
        };
        teacher: {
            stats: {
                subjectCount: number;
                classCount: number;
                assignmentCount: number;
                pendingGrading: number;
                lessonPlanCount: number;
                liveClassCount: number;
            };
            liveClasses: never[];
            assignments: never[];
        };
        generic: {
            stats: {
                subjectCount: number;
                pendingTraining: number;
            };
            announcements: never[];
        };
    };
    messages: {
        id: string;
        text: string;
    }[];
    notifications: {
        id: string;
        text: string;
    }[];
    books: {
        id: string;
        title: string;
        status: string;
    }[];
};
