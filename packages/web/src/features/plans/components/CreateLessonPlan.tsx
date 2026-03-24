import React from 'react';
import LessonPlanBuilderSystem from './LessonPlanBuilderSystem';

export default function CreateLessonPlan({ goBack }: { goBack: () => void }) {
	return <LessonPlanBuilderSystem goBack={goBack} showBackButton />;
}
