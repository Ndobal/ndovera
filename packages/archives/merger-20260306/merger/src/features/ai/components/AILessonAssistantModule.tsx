import React, { useState } from 'react';
import { Bot, Sparkles, Wand2 } from 'lucide-react';

export default function AILessonAssistantModule({ auras, deductAuras }) {
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const AURA_COST = 50;

  const handleGenerate = () => {
    if (auras < AURA_COST) {
        alert("Not enough Auras!");
        return;
    }
    setIsGenerating(true);
    // Simulate API call
    setTimeout(() => {
        deductAuras(AURA_COST, 'AI Lesson Assistant');
        setGeneratedContent(`## AI-Generated Student Notes on "${prompt}"\n\n*   **Key Concept 1:** Detailed explanation of the first important point.\n*   **Key Concept 2:** In-depth analysis of the second key concept.\n*   **Example:** A practical example to illustrate the concepts.`);
        setIsGenerating(false);
    }, 1500);
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">AI Lesson Assistant</h1>
          <p className="text-sm text-slate-400">Generate student-friendly notes, exercises, and practice questions.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-sm font-bold">
            <Sparkles className="w-4 h-4 fill-amber-400" />
            <span>{auras.toLocaleString()} Auras Available</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><Wand2 className="w-5 h-5 text-indigo-400" /> Content Generator</h3>
            <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'A simple explanation of photosynthesis for SS1 students'"
                rows={5}
                className="w-full bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200"
            />
            <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-slate-400">Cost: <span className="font-bold text-amber-400">{AURA_COST} Auras</span></p>
                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed">
                    <Bot className="w-4 h-4" />
                    {isGenerating ? 'Generating...' : 'Generate Content'}
                </button>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Generated Content</h3>
            <div className="prose prose-invert prose-sm max-w-none bg-slate-800 rounded-lg p-4 min-h-[200px]">
                {generatedContent ? <div dangerouslySetInnerHTML={{__html: generatedContent.replace(/\n/g, '<br />')}} /> : <p className="text-slate-400">Your generated content will appear here...</p>}
            </div>
        </div>
      </div>
    </div>
  );
}
