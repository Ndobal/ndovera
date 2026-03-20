import React, { useState, useEffect } from "react";
import { EvaluationForm } from "./EvaluationForm";
import { ProgressBar } from "./ProgressBar";
import { loadUser } from "../../../services/authLocal";
import { useToast } from "../../../components/Toast";

export const EvaluationModal = ({ evaluationId, onClose }: { evaluationId: string, onClose: () => void }) => {
  const [targets, setTargets] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const user = loadUser();
  const { addToast } = useToast();

  useEffect(() => {
    fetch("/api/evaluation/targets", {
      headers: {
        'x-user-id': user?.id || '',
        'x-user-roles': user?.roles?.join(',') || '',
        'x-school-id': user?.schoolId || 'school_1'
      }
    })
      .then(res => res.json())
      .then(data => {
        setTargets(data || []);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, []);

  const handleSubmit = async (rating: number, comment: string) => {
    const target = targets[currentIndex];
    try {
      await fetch("/api/evaluation/submit", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-user-roles': user?.roles?.join(',') || ''
        },
        body: JSON.stringify({
          evaluation_id: evaluationId,
          target_id: target.id,
          rating,
          comment
        })
      });

      addToast('Feedback saved anonymously', 'success');

      if (currentIndex < targets.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        await fetch("/api/evaluation/finish", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id || ''
          },
          body: JSON.stringify({ evaluation_id: evaluationId })
        });
        addToast('Evaluation completed! Thank you.', 'success');
        onClose();
      }
    } catch (e) {
      addToast('Error saving feedback', 'error');
    }
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center text-emerald-500">Loading...</div>;
  if (!targets.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      
      <div className="relative w-full max-w-md bg-black border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">School Evaluation</h2>
          <p className="text-xs text-zinc-400">Your feedback helps improve our institution. Responses are 100% anonymous.</p>
        </div>

        <ProgressBar current={currentIndex} total={targets.length} />

        <EvaluationForm 
          target={targets[currentIndex]} 
          onSubmit={handleSubmit} 
        />

        <div className="mt-6 flex justify-center">
          <button 
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-white font-bold uppercase tracking-widest transition-all"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
};