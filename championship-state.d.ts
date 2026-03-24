export type ChampionshipFlagName = 'championship_enabled' | 'hosted_exams_enabled' | 'spelling_bee_enabled' | 'essay_ai_enabled' | 'proctoring_enabled' | 'live_mode_enabled' | 'ads_enabled' | 'global_competitions';
export type CompetitionType = 'quiz' | 'spelling' | 'essay' | 'math' | 'live' | 'exam';
export type CompetitionScope = 'school' | 'global' | 'hosted';
export type CompetitionMode = 'single' | 'stage';
export type CompetitionStatus = 'draft' | 'scheduled' | 'active' | 'completed';
export type ParticipantStatus = 'joined' | 'in_progress' | 'submitted';
export type FeatureFlag = {
    name: ChampionshipFlagName;
    enabled: boolean;
};
export type CompetitionQuestion = {
    id: string;
    competitionId: string;
    type: string;
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation?: string | null;
    extraData?: Record<string, unknown> | null;
    points: number;
    position: number;
};
export type CompetitionRecord = {
    id: string;
    schoolId?: string | null;
    title: string;
    description?: string | null;
    type: CompetitionType;
    scope: CompetitionScope;
    mode: CompetitionMode;
    entryFee: number;
    status: CompetitionStatus;
    startTime?: string | null;
    endTime?: string | null;
    hostOrganization?: string | null;
    hostedByNdovera: boolean;
    isLive: boolean;
    liveRoomUrl?: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    questionCount?: number;
    participantCount?: number;
    joined?: boolean;
    participantStatus?: ParticipantStatus | null;
    currentScore?: number;
    rank?: number | null;
};
export type ParticipantRecord = {
    id: string;
    competitionId: string;
    userId: string;
    schoolId?: string | null;
    score: number;
    status: ParticipantStatus;
    joinedAt: string;
    submittedAt?: string | null;
    totalTimeTaken: number;
    violationCount: number;
};
export type SubmissionRecord = {
    id: string;
    participantId: string;
    questionId: string;
    answer: string;
    isCorrect: boolean;
    timeTaken: number;
    submittedAt: string;
};
export type LeaderboardEntry = {
    competitionId: string;
    userId: string;
    score: number;
    timeTaken: number;
    rank: number;
    name?: string | null;
};
export type CompetitionDetail = {
    competition: CompetitionRecord;
    questions: Array<Omit<CompetitionQuestion, 'correctAnswer'> & {
        answered?: boolean;
        submittedAnswer?: string | null;
        isCorrect?: boolean | null;
        correctAnswer?: string;
    }>;
    participant: ParticipantRecord | null;
    leaderboard: LeaderboardEntry[];
    featureFlags: FeatureFlag[];
    stats: {
        questionCount: number;
        participantCount: number;
        submittedCount: number;
        violationCount: number;
    };
};
export type CreateCompetitionInput = {
    schoolId?: string | null;
    title: string;
    description?: string | null;
    type: CompetitionType;
    scope: CompetitionScope;
    mode: CompetitionMode;
    entryFee?: number;
    status?: CompetitionStatus;
    startTime?: string | null;
    endTime?: string | null;
    hostOrganization?: string | null;
    hostedByNdovera?: boolean;
    isLive?: boolean;
    liveRoomUrl?: string | null;
    createdBy: string;
    questions: Array<{
        type: string;
        prompt: string;
        options?: string[];
        correctAnswer: string;
        explanation?: string | null;
        extraData?: Record<string, unknown> | null;
        points?: number;
    }>;
};
export declare function listFeatureFlags(): Promise<FeatureFlag[]>;
export declare function setFeatureFlag(name: ChampionshipFlagName, enabled: boolean): Promise<{
    name: ChampionshipFlagName;
    enabled: boolean;
}>;
export declare function createCompetition(input: CreateCompetitionInput): Promise<{
    competition: CompetitionRecord;
    questions: {
        id: `${string}-${string}-${string}-${string}-${string}`;
        competitionId: `${string}-${string}-${string}-${string}-${string}`;
        type: string;
        prompt: string;
        options: string[];
        correctAnswer: string;
        explanation: string | null;
        extraData: Record<string, unknown> | null;
        points: number;
        position: number;
    }[];
}>;
export declare function listCompetitions(params: {
    schoolId?: string | null;
    userId?: string | null;
    includeGlobal?: boolean;
}): Promise<{
    joined: boolean;
    participantStatus: any;
    currentScore: number | undefined;
    rank: number | null;
    id: string;
    schoolId?: string | null;
    title: string;
    description?: string | null;
    type: CompetitionType;
    scope: CompetitionScope;
    mode: CompetitionMode;
    entryFee: number;
    status: CompetitionStatus;
    startTime?: string | null;
    endTime?: string | null;
    hostOrganization?: string | null;
    hostedByNdovera: boolean;
    isLive: boolean;
    liveRoomUrl?: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    questionCount?: number;
    participantCount?: number;
}[]>;
export declare function joinCompetition(input: {
    competitionId: string;
    userId: string;
    schoolId?: string | null;
}): Promise<CompetitionDetail>;
export declare function submitCompetitionAnswer(input: {
    competitionId: string;
    userId: string;
    questionId: string;
    answer: string;
    timeTaken?: number;
    schoolId?: string | null;
}): Promise<CompetitionDetail>;
export declare function recordViolation(input: {
    competitionId: string;
    userId: string;
    type: string;
    schoolId?: string | null;
    metadata?: Record<string, unknown> | null;
}): Promise<CompetitionDetail>;
export declare function getCompetitionDetail(params: {
    competitionId: string;
    viewerUserId?: string | null;
    schoolId?: string | null;
    includeAnswers?: boolean;
}): Promise<CompetitionDetail>;
