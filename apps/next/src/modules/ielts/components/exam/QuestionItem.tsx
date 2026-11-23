import type { FC } from 'react';
import type { Question } from '../../types/exam';
import { Bookmark, CheckCircle2, XCircle, Info } from 'lucide-react';

interface QuestionItemProps {
  question: Question;
  userAnswer?: string | string[];
  onAnswerChange: (orderNumber: number, answer: string | string[]) => void;
  isFlagged: boolean;
  onToggleFlag: (orderNumber: number) => void;
  isReviewMode?: boolean;
  isCorrect?: boolean;
  fontSize: 'sm' | 'base' | 'lg';
}

function renderMarkdownText(text: string) {
  if (!text) return null;
  let cleaned = text;
  if ((cleaned.match(/\*\*/g) || []).length % 2 !== 0) {
    cleaned = cleaned.replace(/\*\*+$/, '');
  }
  const parts = cleaned.split(/(\*\*.*?\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-gray-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export const QuestionItem: FC<QuestionItemProps> = ({
  question,
  userAnswer,
  onAnswerChange,
  isFlagged,
  onToggleFlag,
  isReviewMode,
  isCorrect,
  fontSize,
}) => {
  const textSizeClass = {
    sm: 'text-[15px] leading-[1.65]',
    base: 'text-[16px] leading-[1.65]',
    lg: 'text-[18px] leading-[1.75]',
  }[fontSize];

  const orderNumClass = {
    sm: 'text-[15px]',
    base: 'text-[16px]',
    lg: 'text-[18px]',
  }[fontSize];

  const inputFieldClass = {
    sm: 'text-[15px] py-1.5 px-2.5',
    base: 'text-[16px] py-2 px-3',
    lg: 'text-[18px] py-2.5 px-3.5',
  }[fontSize];

  const reviewExplClass = {
    sm: 'text-[13.5px]',
    base: 'text-[14.5px]',
    lg: 'text-[16px]',
  }[fontSize];

  // Render TRUE_FALSE_NOT_GIVEN or YES_NO_NOT_GIVEN or MULTIPLE_CHOICE_SINGLE
  const isRadioType =
    question.type === 'TRUE_FALSE_NOT_GIVEN' ||
    question.type === 'YES_NO_NOT_GIVEN' ||
    question.type === 'MULTIPLE_CHOICE_SINGLE';

  const defaultOptions =
    question.type === 'TRUE_FALSE_NOT_GIVEN'
      ? [
          { id: 'TRUE', text: 'TRUE' },
          { id: 'FALSE', text: 'FALSE' },
          { id: 'NOT GIVEN', text: 'NOT GIVEN' },
        ]
      : question.type === 'YES_NO_NOT_GIVEN'
      ? [
          { id: 'YES', text: 'YES' },
          { id: 'NO', text: 'NO' },
          { id: 'NOT GIVEN', text: 'NOT GIVEN' },
        ]
      : question.options || [];

  return (
    <div
      id={`q-card-${question.orderNumber}`}
      className={`border-2 rounded-2xl bg-white p-5 md:p-6 transition-all scroll-mt-6 mb-3.5 shadow-xs font-sans text-gray-900 ${
        isReviewMode
          ? isCorrect
            ? 'border-emerald-500 bg-emerald-50/30'
            : 'border-rose-400 bg-rose-50/30'
          : isFlagged
          ? 'border-amber-400 bg-amber-50/20'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Question Header & Prompt */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-start gap-3 flex-1">
          <span className={`inline-flex items-center justify-center font-extrabold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-0.5 ${orderNumClass} select-none shrink-0`}>
            {question.orderNumber}
          </span>
          <div className={`text-gray-900 font-medium ${textSizeClass} flex-1 pt-0.5`}>
            {renderMarkdownText(question.prompt)}
          </div>
        </div>

        {/* Flag Bookmark button */}
        {!isReviewMode && (
          <button
            onClick={() => onToggleFlag(question.orderNumber)}
            title={isFlagged ? 'Remove flag' : 'Flag for review'}
            className={`p-1.5 rounded-xl border transition ${
              isFlagged
                ? 'text-amber-600 bg-amber-50 border-amber-300 hover:bg-amber-100'
                : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isFlagged ? 'fill-amber-500' : ''}`} />
          </button>
        )}

        {/* Correct/Incorrect badge in Review mode */}
        {isReviewMode && (
          <div className="flex items-center gap-1 shrink-0">
            {isCorrect ? (
              <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Correct
              </span>
            ) : (
              <span className="flex items-center text-xs font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-xl">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Incorrect
              </span>
            )}
          </div>
        )}
      </div>

      {/* Question Body / Inputs — PNO Quiz <Clickable> Option Cards */}
      {isRadioType && (
        <div className="space-y-2.5 mt-3">
          {defaultOptions.map((opt) => {
            const isSelected = userAnswer === opt.id;
            const normTarget = Array.isArray(question.correctAnswer)
              ? question.correctAnswer.map((c) => c.trim().toUpperCase())
              : [String(question.correctAnswer || '').trim().toUpperCase()];
            const isTargetCorrect =
              isReviewMode && normTarget.includes(opt.id.trim().toUpperCase());

            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 cursor-pointer select-none px-4 py-3 rounded-xl border-2 transition ${
                  isReviewMode
                    ? isTargetCorrect
                      ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900'
                      : isSelected && !isCorrect
                      ? 'bg-rose-50 border-rose-400 line-through text-rose-800'
                      : 'border-gray-200 bg-white opacity-75'
                    : isSelected
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-semibold shadow-2xs'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="relative flex items-center justify-center shrink-0 mt-1">
                  <input
                    type="radio"
                    name={`q-${question.orderNumber}`}
                    value={opt.id}
                    checked={isSelected}
                    disabled={isReviewMode}
                    onChange={() => onAnswerChange(question.orderNumber, opt.id)}
                    className="sr-only"
                  />
                  {isSelected ? (
                    <span className="w-4.5 h-4.5 rounded-full border-2 border-blue-600 bg-blue-600 inline-flex items-center justify-center shrink-0">
                      <span className="w-2 h-2 rounded-full bg-white"></span>
                    </span>
                  ) : (
                    <span className="w-4.5 h-4.5 rounded-full border-2 border-gray-300 bg-white inline-flex items-center justify-center shrink-0"></span>
                  )}
                </div>

                <span className={`text-gray-900 tracking-wide ${textSizeClass}`}>
                  {opt.id && !['TRUE', 'FALSE', 'NOT GIVEN', 'YES', 'NO'].includes(opt.id) && (
                    <strong className="mr-1.5 text-blue-700">{opt.id}.</strong>
                  )}
                  {renderMarkdownText(opt.text)}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Multiple Choice Multi (e.g. Choose TWO / THREE) — PNO Quiz <Clickable> Option Cards */}
      {question.type === 'MULTIPLE_CHOICE_MULTI' && (
        <div className="space-y-2.5 mt-3">
          {(question.options || []).map((opt) => {
            const currentAnswers = Array.isArray(userAnswer) ? userAnswer : [];
            const isSelected = currentAnswers.includes(opt.id);
            const targetList = (
              Array.isArray(question.correctAnswer)
                ? question.correctAnswer
                : String(question.correctAnswer || '').split(',')
            ).map((s) => s.trim().toUpperCase());
            const isTargetCorrect =
              isReviewMode && targetList.includes(opt.id.trim().toUpperCase());

            const handleToggleCheckbox = () => {
              if (isReviewMode) return;
              let next: string[];
              if (isSelected) {
                next = currentAnswers.filter((id) => id !== opt.id);
              } else {
                if (question.maxSelect && currentAnswers.length >= question.maxSelect) {
                  next = [...currentAnswers.slice(1), opt.id];
                } else {
                  next = [...currentAnswers, opt.id];
                }
              }
              onAnswerChange(question.orderNumber, next);
            };

            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 cursor-pointer select-none px-4 py-3 rounded-xl border-2 transition ${
                  isReviewMode
                    ? isTargetCorrect
                      ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900'
                      : isSelected && !isTargetCorrect
                      ? 'bg-rose-50 border-rose-400 line-through text-rose-800'
                      : 'border-gray-200 bg-white opacity-75'
                    : isSelected
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-semibold shadow-2xs'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="relative flex items-center justify-center shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isReviewMode}
                    onChange={handleToggleCheckbox}
                    className="sr-only"
                  />
                  {isSelected ? (
                    <span className="w-4.5 h-4.5 rounded-md border-2 border-blue-600 bg-blue-600 text-white inline-flex items-center justify-center shrink-0 text-[11px] font-bold">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4.5 h-4.5 rounded-md border-2 border-gray-300 bg-white inline-flex items-center justify-center shrink-0"></span>
                  )}
                </div>
                <span className={`text-gray-900 ${textSizeClass}`}>
                  <strong className="mr-1.5 text-blue-700">{opt.id}.</strong> {renderMarkdownText(opt.text)}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Fill in Blank / Sentence completion — PNO Quiz WriteCard Input Style */}
      {question.type === 'FILL_IN_BLANK' && (
        <div className="mt-3.5">
          <div className="flex flex-wrap items-center gap-2.5 max-w-lg">
            <span className={`font-bold text-gray-600 text-sm uppercase tracking-wider`}>Your Answer:</span>
            <input
              type="text"
              disabled={isReviewMode}
              value={typeof userAnswer === 'string' ? userAnswer : ''}
              onChange={(e) => onAnswerChange(question.orderNumber, e.target.value)}
              placeholder="Type your answer..."
              className={`w-full sm:w-auto flex-1 border-2 rounded-xl focus:outline-none transition font-bold ${inputFieldClass} ${
                isReviewMode
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-rose-400 bg-rose-50 text-rose-900'
                  : userAnswer
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 focus:bg-white'
                  : 'border-gray-200 bg-gray-100 hover:border-blue-300 focus:border-blue-500 focus:bg-white text-gray-900 placeholder:font-medium'
              }`}
            />
          </div>
        </div>
      )}

      {/* Matching Dropdown / Select — PNO Quiz Select Style */}
      {question.type === 'MATCHING' && (
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <span className={`font-bold text-gray-600 text-sm uppercase tracking-wider`}>Select Answer:</span>
          <select
            disabled={isReviewMode}
            value={typeof userAnswer === 'string' ? userAnswer : ''}
            onChange={(e) => onAnswerChange(question.orderNumber, e.target.value)}
            className={`font-bold border-2 rounded-xl focus:outline-none min-w-[230px] max-w-full shadow-2xs cursor-pointer transition ${inputFieldClass} ${
              userAnswer
                ? 'border-blue-600 bg-blue-50/60 text-blue-950'
                : 'border-gray-200 bg-gray-100 hover:border-blue-300 focus:border-blue-500 focus:bg-white text-gray-900'
            }`}
          >
            <option value="">-- Choose an option --</option>
            {(question.options || []).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.id} {opt.text ? ` - ${opt.text}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Review Mode Explanation & Answers Details */}
      {isReviewMode && (
        <div className={`mt-4 pt-3.5 border-t-2 border-gray-100 space-y-2 ${reviewExplClass}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="text-gray-700">
              <span className="font-semibold text-gray-500">Your answer: </span>
              <span className={isCorrect ? 'font-bold text-emerald-700' : 'font-bold text-rose-600'}>
                {Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer || '(not answered)'}
              </span>
            </div>
            <div className="text-gray-900">
              <span className="font-semibold text-gray-500">Correct answer: </span>
              <span className="font-bold text-emerald-800">
                {Array.isArray(question.correctAnswer)
                  ? question.correctAnswer.join(', ')
                  : question.correctAnswer}
                {question.acceptableAnswers && question.acceptableAnswers.length > 0 && (
                  <span className="font-normal text-gray-500 ml-1">
                    (Also: {question.acceptableAnswers.join(', ')})
                  </span>
                )}
              </span>
            </div>
          </div>

          {question.explanation && (
            <div className={`mt-2.5 p-3.5 bg-blue-50/80 border-2 border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5 leading-relaxed ${reviewExplClass}`}>
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold mr-1">Explanation:</span>
                <span>{question.explanation}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
