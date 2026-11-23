import { useState, type FC } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  Target,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export interface AiCoachPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillType: 'writing' | 'speaking';
  taskTitle: string;
  taskPrompt: string;
  userContent: string;
  sampleContent?: string;
  wordCount?: number;
  partInfo?: string;
}

export const AiCoachPromptModal: FC<AiCoachPromptModalProps> = ({
  isOpen,
  onClose,
  skillType,
  taskTitle,
  taskPrompt,
  userContent,
  sampleContent,
  wordCount,
  partInfo,
}) => {
  // Target Band state
  const [targetBand, setTargetBand] = useState<'6.5' | '7.0' | '7.5' | '8.0' | '8.5+'>('7.5');
  const [currentLevel, setCurrentLevel] = useState<'5.5' | '6.0' | '6.5' | '7.0'>('6.0');

  // Focus priorities
  const [focusVocab, setFocusVocab] = useState(true);
  const [focusGrammar, setFocusGrammar] = useState(true);
  const [focusCoherence, setFocusCoherence] = useState(true);
  const [focusTaskDepth, setFocusTaskDepth] = useState(true);

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Focus areas text
  const selectedFocusList: string[] = [];
  if (focusVocab) selectedFocusList.push('Upgrade academic vocabulary (C1-C2), natural collocations, and idiomatic expressions');
  if (focusGrammar) selectedFocusList.push('Fix grammatical errors and diversify sentence structures (relative clauses, inversion, conditionals, advanced passive voice)');
  if (focusCoherence) {
    selectedFocusList.push(
      skillType === 'writing'
        ? 'Improve Coherence & Cohesion with seamless, natural linking devices'
        : 'Improve Fluency & Coherence, reduce hesitation, use natural discourse markers, and refine intonation'
    );
  }
  if (focusTaskDepth) {
    selectedFocusList.push(
      skillType === 'writing'
        ? 'Strengthen Task Response / Task Achievement with deeper arguments and persuasive evidence'
        : 'Expand answers with clear reasoning, explanations, and vivid personal examples'
    );
  }

  // Construct Pedagogical Prompt
  const buildPrompt = (): string => {
    const isWriting = skillType === 'writing';

    return `You are an official certified IELTS Examiner and an elite Band 8.5+ IELTS Coach.
I have just completed an IELTS ${isWriting ? 'Writing' : 'Speaking'} practice session on PNO. Please evaluate my submission and coach me step-by-step toward my target band score.

=== MY PERSONALIZED TARGET PROFILE ===
- Estimated current level: Band ${currentLevel}
- MY TARGET BAND SCORE: BAND ${targetBand} IELTS ${isWriting ? 'Writing' : 'Speaking'}
- Key priority areas I want to improve:
${selectedFocusList.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}

=== TASK PROMPT DETAILS ===
Topic: ${taskTitle} ${partInfo ? `(${partInfo})` : ''}
Prompt:
"${taskPrompt}"

=== MY SUBMISSION ${wordCount ? `(Word count: ${wordCount} words)` : ''} ===
"""
${userContent.trim() || '(No response entered yet — please remind me to paste my response)'}
"""
${
  sampleContent
    ? `
=== BAND 8.5+ REFERENCE MODEL ANSWER ===
"""
${sampleContent}
"""`
    : ''
}

=========================================
=== YOUR 5-STEP COACHING INSTRUCTIONS ===
1. ESTIMATED BAND SCORE & CRITERIA BREAKDOWN:
   - Provide an estimated Overall Band Score and individual scores across the 4 official IELTS criteria:
     ${
       isWriting
         ? '• Task Response / Task Achievement\n     • Coherence & Cohesion\n     • Lexical Resource\n     • Grammatical Range & Accuracy'
         : '• Fluency and Coherence\n     • Lexical Resource\n     • Grammatical Range and Accuracy\n     • Pronunciation'
     }

2. DETAILED SENTENCE-BY-SENTENCE CORRECTIONS:
   - List specific sentences or phrases with grammar errors, awkward phrasing, or unnatural collocations.
   - Provide the corrected version and explain why the correction improves the score.

3. UPGRADING FROM BAND ${currentLevel} TO BAND ${targetBand}:
   - Select 3–4 sentences from my response and rewrite/paraphrase them at a true Band ${targetBand} level.
   - Highlight high-value C1/C2 topic-specific vocabulary and collocations I should incorporate.

4. COMPLETE BAND ${targetBand} MODEL REWRITE BASED ON MY IDEAS:
   - Write a complete, natural Band ${targetBand} version built directly around my original arguments and ideas so I can study the structure and flow.

5. 3 ACTIONABLE NEXT-PRACTICE DRILLS:
   - Give me 3 concise, high-impact exercises or habits to fix my biggest weakness before my next test.
`;
  };

  const handleCopy = () => {
    const text = buildPrompt();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b-2 border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                AI Examiner & Band Upgrade Prompt Generator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Personalized coaching prompt ready to paste into ChatGPT, Claude, Gemini, or DeepSeek
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white text-slate-800">
          {/* Section 1: Target Band Selection */}
          <div className="bg-slate-50/70 border-2 border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">Your Target Band Score:</span>
              </div>
              <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                Target Band: {targetBand}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(['6.5', '7.0', '7.5', '8.0', '8.5+'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setTargetBand(b)}
                  className={`py-1.5 text-xs font-bold rounded-xl border-2 transition ${
                    targetBand === b
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Band {b}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Current Level & Focus Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Level */}
            <div className="bg-slate-50/70 border-2 border-slate-200 rounded-2xl p-4 space-y-2 shadow-2xs">
              <span className="text-xs font-bold text-slate-800 block">Estimated Current Level:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['5.5', '6.0', '6.5', '7.0'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCurrentLevel(lvl)}
                    className={`py-1.5 text-xs font-bold rounded-xl border-2 transition ${
                      currentLevel === lvl
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Band {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                AI will analyze the exact gap from Band {currentLevel} to Band {targetBand}.
              </p>
            </div>

            {/* Focus Priorities */}
            <div className="bg-slate-50/70 border-2 border-slate-200 rounded-2xl p-4 space-y-2 shadow-2xs">
              <span className="text-xs font-bold text-slate-800 block">Coaching Focus Areas:</span>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusVocab}
                    onChange={(e) => setFocusVocab(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>C1-C2 Vocabulary & Collocations</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusGrammar}
                    onChange={(e) => setFocusGrammar(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>Sentence Variety & Grammar Fixes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusCoherence}
                    onChange={(e) => setFocusCoherence(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>{skillType === 'writing' ? 'Coherence & Cohesion' : 'Fluency & Natural Intonation'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusTaskDepth}
                    onChange={(e) => setFocusTaskDepth(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>{skillType === 'writing' ? 'Argument Depth & Evidence' : 'Idea Expansion & Examples'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Live Prompt Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold">Generated AI Prompt Preview:</span>
              <span className="text-[11px] font-mono font-semibold text-slate-600">
                {buildPrompt().length} chars
              </span>
            </div>

            <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {buildPrompt()}
            </div>
          </div>

          {/* Section 4: AI Recommendations */}
          <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-semibold">Paste into any free AI assistant:</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition shadow-2xs"
              >
                <span>ChatGPT</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition shadow-2xs"
              >
                <span>Claude</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href="https://chat.deepseek.com"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition shadow-2xs"
              >
                <span>DeepSeek</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t-2 border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition"
          >
            Close
          </button>

          <button
            onClick={handleCopy}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-xs transition-all ${
              copied
                ? 'bg-emerald-600'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy AI Prompt (1-Click)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
