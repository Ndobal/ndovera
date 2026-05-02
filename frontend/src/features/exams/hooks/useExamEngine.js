import { useState, useCallback } from 'react';
import * as svc from '../service/examService';

export function useExamEngine(userId) {
  const [examList, setExamList] = useState([]);
  const [currentExam, setCurrentExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const list = await svc.fetchExamList();
      setExamList(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const beginExam = useCallback(
    async (examId) => {
      setLoading(true);
      try {
        const data = await svc.startExam(examId, userId);
        setCurrentExam(data.exam);
        setQuestions(data.questions);
        setAnswers({});
        setResult(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const recordAnswer = useCallback((questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  const submit = useCallback(async () => {
    if (!currentExam) return;
    setLoading(true);
    try {
      const res = await svc.submitExam(currentExam.id, userId, answers);
      setResult(res.result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [currentExam, userId, answers]);

  const reset = useCallback(() => {
    setCurrentExam(null);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
  }, []);

  return {
    examList,
    currentExam,
    questions,
    answers,
    result,
    loading,
    error,
    loadExams,
    beginExam,
    recordAnswer,
    submit,
    reset,
  };
}