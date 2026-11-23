import React, { type FC } from 'react';
import type { QuestionGroup, UserAnswerRecord, ScoreReport, QuestionOption } from '../../types/exam';
import { QuestionItem } from './QuestionItem';
import { Bookmark, CheckCircle2, XCircle, Info } from 'lucide-react';

interface QuestionGroupRendererProps {
  group: QuestionGroup;
  answers: UserAnswerRecord;
  onAnswerChange: (orderNumber: number, answer: string | string[]) => void;
  flaggedQuestions: number[];
  onToggleFlag: (orderNumber: number) => void;
  isReviewMode?: boolean;
  scoreReport?: ScoreReport | null;
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

export const QuestionGroupRenderer: FC<QuestionGroupRendererProps> = ({
  group,
  answers,
  onAnswerChange,
  flaggedQuestions,
  onToggleFlag,
  isReviewMode,
  scoreReport,
  fontSize,
}) => {
  const hasInlineBlanks = Boolean(group.sharedContent && /\{\{\d+\}\}/.test(group.sharedContent));

  // Exact 1-to-1 font scale matched with PassageViewer
  const instructionTextClass = {
    sm: 'text-[15px] leading-[1.65]',
    base: 'text-[16px] leading-[1.65]',
    lg: 'text-[18px] leading-[1.75]',
  }[fontSize];

  const summaryTextClass = {
    sm: 'text-[15px] leading-[1.65]',
    base: 'text-[16px] leading-[1.65]',
    lg: 'text-[18px] leading-[1.75]',
  }[fontSize];

  const inputControlClass = {
    sm: 'text-[15px] py-1.5 px-2.5',
    base: 'text-[16px] py-1.5 px-3',
    lg: 'text-[18px] py-2 px-3.5',
  }[fontSize];

  const wordBankItemClass = {
    sm: 'text-[15px] px-3.5 py-2',
    base: 'text-[16px] px-4 py-2.5',
    lg: 'text-[18px] px-4.5 py-3',
  }[fontSize];

  const badgeTextClass = {
    sm: 'text-[13px] px-2 py-0.5',
    base: 'text-[14px] px-2 py-0.5',
    lg: 'text-[15px] px-2.5 py-1',
  }[fontSize];

  // If this group is a Summary / Notes / Table Completion with inline blanks
  if (hasInlineBlanks && group.sharedContent) {
    const paragraphs = group.sharedContent.split(/\n+/).filter((p) => p.trim());

    return (
      <div className="space-y-4 mb-8 font-sans text-gray-900">
        {/* 1. Group Instructions Box (PNO Quiz Card Style) */}
        <div className={`border-2 border-gray-200 rounded-2xl p-5 md:p-6 bg-white ${instructionTextClass} text-gray-900 shadow-xs mb-4 font-sans`}>
          {group.title && (
            <h3 className="font-extrabold text-gray-900 text-base md:text-lg mb-2">{group.title}</h3>
          )}
          <div className="font-normal text-gray-700 whitespace-pre-line leading-[1.65]">
            {group.instructions
              .split(
                /(TRUE|FALSE|NOT GIVEN|YES|NO|ONE WORD ONLY|NO MORE THAN TWO WORDS|NO MORE THAN THREE WORDS|\b[A-N]-[A-N]\b|\b\d+[-–]\d+\b)/g
              )
              .map((part, i) => {
                if (
                  [
                    'TRUE',
                    'FALSE',
                    'NOT GIVEN',
                    'YES',
                    'NO',
                    'ONE WORD ONLY',
                    'NO MORE THAN TWO WORDS',
                    'NO MORE THAN THREE WORDS',
                  ].includes(part) ||
                  /^[A-N]-[A-N]$/.test(part) ||
                  /^\d+[-–]\d+$/.test(part)
                ) {
                  return (
                    <strong key={i} className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                      {part}
                    </strong>
                  );
                }
                return renderMarkdownText(part);
              })}
          </div>
        </div>

        {/* 2. Summary Completion Card (PNO Quiz Card Style) */}
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-5 md:p-7 shadow-xs text-gray-900 font-sans">
          {group.summaryTitle && (
            <h4 className="font-extrabold text-base md:text-[17px] text-gray-900 mb-4 pb-3 border-b-2 border-gray-100">
              {renderMarkdownText(group.summaryTitle)}
            </h4>
          )}

          <div className={`space-y-4 ${summaryTextClass} text-gray-900`}>
            {paragraphs.map((para, pIdx) => {
              const segments = para.split(/(\{\{\d+\}\})/g);

              return (
                <p key={pIdx} className="leading-[1.85]">
                  {segments.map((seg, sIdx) => {
                    const blankMatch = seg.match(/^\{\{(\d+)\}\}$/);
                    if (!blankMatch) {
                      return <React.Fragment key={sIdx}>{renderMarkdownText(seg)}</React.Fragment>;
                    }

                    const orderNum = parseInt(blankMatch[1] || '0', 10);
                    const q = group.questions.find((item) => item.orderNumber === orderNum);
                    const userAns = answers[orderNum];
                    const isFlagged = flaggedQuestions.includes(orderNum);

                    let isCorrect: boolean | undefined = undefined;
                    if (isReviewMode && scoreReport) {
                      const detail = scoreReport.details.find((d) => d.questionNumber === orderNum);
                      if (detail) {
                        isCorrect = detail.isCorrect;
                      }
                    }

                    const optionsList: QuestionOption[] =
                      (group.wordBank && group.wordBank.length > 0
                        ? group.wordBank
                        : q?.options) || [];

                    const hasOptions = optionsList.length > 0;

                    return (
                      <span
                        key={sIdx}
                        id={`q-card-${orderNum}`}
                        className="inline-flex items-center align-middle mx-1 my-0.5 gap-1.5 px-1 py-0.5 rounded-xl transition"
                      >
                        {/* Order Number Badge */}
                        <span
                          className={`inline-flex items-center justify-center font-bold rounded-lg border-2 select-none ${badgeTextClass} ${
                            isFlagged
                              ? 'bg-amber-100 text-amber-800 border-amber-400 font-extrabold'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {orderNum}
                        </span>

                        {/* Interactive Slot: Using span instead of div to maintain valid DOM nesting */}
                        {isReviewMode ? (
                          <span className="inline-flex items-center gap-1.5 align-middle">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs md:text-sm font-bold rounded-xl border-2 ${
                                isCorrect
                                   ? 'bg-green-50 border-green-500 text-green-900'
                                  : 'bg-red-50 border-red-400 text-red-900'
                              }`}
                            >
                              {isCorrect ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-700 shrink-0 inline" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-700 shrink-0 inline" />
                              )}
                              <span>
                                {userAns ? (
                                  hasOptions ? (
                                    <>
                                      {userAns}
                                      {optionsList.find((o) => o.id === userAns)?.text && (
                                        <span className="font-normal ml-1">
                                          ({optionsList.find((o) => o.id === userAns)?.text})
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    userAns
                                  )
                                ) : (
                                  '(blank)'
                                )}
                              </span>
                            </span>
                            {!isCorrect && q && (
                              <span className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 px-2.5 py-1 rounded-xl text-xs md:text-sm font-bold">
                                Answer: {q.correctAnswer}
                                {hasOptions && optionsList.find((o) => o.id === q.correctAnswer)?.text && (
                                  <span className="font-normal ml-1">
                                    ({optionsList.find((o) => o.id === q.correctAnswer)?.text})
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                        ) : hasOptions ? (
                          <select
                            id={`input-q-${orderNum}`}
                            value={typeof userAns === 'string' ? userAns : ''}
                            onChange={(e) => onAnswerChange(orderNum, e.target.value)}
                            className={`inline-block font-bold rounded-xl border-2 transition cursor-pointer ${inputControlClass} ${
                              userAns
                                ? 'bg-blue-50 border-blue-600 text-blue-900'
                                : 'bg-gray-100 border-gray-200 text-gray-800 hover:border-blue-300 focus:bg-white focus:border-blue-500 focus:outline-none'
                            }`}
                          >
                            <option value="">-- Select --</option>
                            {optionsList.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.id} - {opt.text}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={`input-q-${orderNum}`}
                            type="text"
                            value={typeof userAns === 'string' ? userAns : ''}
                            onChange={(e) => onAnswerChange(orderNum, e.target.value)}
                            placeholder={`Type answer (${orderNum})...`}
                            className={`inline-block font-bold rounded-xl border-2 transition w-36 md:w-48 ${inputControlClass} ${
                              userAns
                                ? 'bg-blue-50 border-blue-600 text-blue-900'
                                : 'bg-gray-100 border-gray-200 text-gray-900 hover:border-blue-300 focus:bg-white focus:border-blue-500 focus:outline-none placeholder:text-gray-400 placeholder:font-medium'
                            }`}
                          />
                        )}

                        {/* Quick Flag Button */}
                        <button
                          onClick={() => onToggleFlag(orderNum)}
                          className={`p-1 rounded-lg transition-colors ml-0.5 ${
                            isFlagged
                              ? 'text-amber-600 bg-amber-50 hover:text-amber-700'
                              : 'text-gray-300 hover:text-amber-500'
                          }`}
                          title={isFlagged ? 'Remove flag' : 'Flag for review'}
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${
                              isFlagged ? 'fill-amber-500 text-amber-600' : ''
                            }`}
                          />
                        </button>
                      </span>
                    );
                  })}
                </p>
              );
            })}
          </div>

          {/* 3. Word Bank Card (if present) */}
          {group.wordBank && group.wordBank.length > 0 && (
            <div className="mt-6 border-2 border-gray-200 rounded-2xl bg-slate-50/70 p-4 md:p-5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-gray-800 mb-3 flex items-center justify-between border-b-2 border-gray-200 pb-2">
                <span>Word Bank</span>
                <span className="text-xs font-medium text-gray-500 normal-case">
                  Select the matching letter for each blank
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {group.wordBank.map((item) => {
                  const usedByQ = group.questions.find(
                    (q) => answers[q.orderNumber] === item.id || answers[q.orderNumber] === item.text
                  );
                  return (
                    <div
                      key={item.id}
                      className={`border-2 rounded-xl flex items-center gap-2.5 transition ${wordBankItemClass} ${
                        usedByQ
                          ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-65'
                          : 'bg-white border-gray-200 hover:border-blue-300 text-gray-900 shadow-2xs'
                      }`}
                    >
                      <span className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-blue-600 text-white rounded-lg shrink-0">
                        {item.id}
                      </span>
                      <span className="font-semibold text-gray-800 leading-tight">{item.text}</span>
                      {usedByQ && (
                        <span className="ml-auto text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                          Q{usedByQ.orderNumber}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Review Mode Explanations Section */}
          {isReviewMode && (
            <div className="mt-6 border-2 border-blue-200 rounded-2xl bg-blue-50/40 p-4 md:p-5">
              <h5 className="font-bold text-xs md:text-sm text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-blue-200 pb-2">
                <Info className="w-4 h-4 text-blue-700" />
                <span>Explanations for this question group</span>
              </h5>
              <div className="space-y-3">
                {group.questions.map((q) => {
                  if (!q.explanation) return null;
                  return (
                    <div key={q.id} className="text-[13px] md:text-sm text-blue-950 leading-relaxed">
                      <strong className="text-blue-900 font-bold mr-1">Q{q.orderNumber}:</strong>
                      <span>{q.explanation}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STANDARD QUESTION LIST (True/False/Not Given, MCQ, Matching Headings...)
  return (
    <div className="space-y-4 mb-8 font-sans text-gray-900">
      {/* Group Instructions Box (PNO Quiz Card Style) */}
      <div className={`border-2 border-gray-200 rounded-2xl p-5 md:p-6 bg-white ${instructionTextClass} text-gray-900 shadow-xs mb-4 font-sans`}>
        {group.title && (
          <h3 className="font-extrabold text-gray-900 text-base md:text-lg mb-2">{group.title}</h3>
        )}
        <div className="font-normal text-gray-700 whitespace-pre-line leading-[1.65]">
          {group.instructions
            .split(
              /(TRUE|FALSE|NOT GIVEN|YES|NO|ONE WORD ONLY|NO MORE THAN TWO WORDS|NO MORE THAN THREE WORDS)/g
            )
            .map((part, i) => {
              if (
                [
                  'TRUE',
                  'FALSE',
                  'NOT GIVEN',
                  'YES',
                  'NO',
                  'ONE WORD ONLY',
                  'NO MORE THAN TWO WORDS',
                  'NO MORE THAN THREE WORDS',
                ].includes(part)
              ) {
                return (
                  <strong key={i} className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                    {part}
                  </strong>
                );
              }
              return renderMarkdownText(part);
            })}
        </div>
        {group.sharedContent && (
          <div className={`mt-3 p-4 bg-slate-50 border-2 border-gray-200 rounded-xl font-sans ${instructionTextClass} text-gray-900 whitespace-pre-line`}>
            {renderMarkdownText(group.sharedContent)}
          </div>
        )}
      </div>

      {/* List of Questions in Group */}
      <div className="space-y-3.5">
        {group.questions.map((q) => {
          let isCorrect: boolean | undefined = undefined;
          if (isReviewMode && scoreReport) {
            const detail = scoreReport.details.find((d) => d.questionNumber === q.orderNumber);
            if (detail) {
              isCorrect = detail.isCorrect;
            }
          }

          return (
            <QuestionItem
              key={q.id}
              question={q}
              userAnswer={answers[q.orderNumber]}
              onAnswerChange={onAnswerChange}
              isFlagged={flaggedQuestions.includes(q.orderNumber)}
              onToggleFlag={onToggleFlag}
              isReviewMode={isReviewMode}
              isCorrect={isCorrect}
              fontSize={fontSize}
            />
          );
        })}
      </div>
    </div>
  );
};
