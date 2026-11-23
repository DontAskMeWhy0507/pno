import type { Exam, ScoreReport, UserAnswerRecord } from '../types/exam';

export type ExamSkillType = 'reading' | 'listening' | 'general_reading';

export function calculateIELTSBand(
  correctCount: number,
  skillType: ExamSkillType = 'reading',
  totalQuestions: number = 40
): number {
  // If this is a mini-test or practice quiz with fewer than 40 questions,
  // scale proportionally so 10/10 maps to Band 9.0 rather than Band 4.0
  let effectiveCorrect = correctCount;
  if (totalQuestions > 0 && totalQuestions !== 40) {
    effectiveCorrect = Math.round((correctCount / totalQuestions) * 40);
  }

  if (skillType === 'listening') {
    if (effectiveCorrect >= 39) return 9.0;
    if (effectiveCorrect >= 37) return 8.5;
    if (effectiveCorrect >= 35) return 8.0;
    if (effectiveCorrect >= 32) return 7.5;
    if (effectiveCorrect >= 30) return 7.0;
    if (effectiveCorrect >= 26) return 6.5;
    if (effectiveCorrect >= 23) return 6.0;
    if (effectiveCorrect >= 18) return 5.5;
    if (effectiveCorrect >= 16) return 5.0;
    if (effectiveCorrect >= 13) return 4.5;
    if (effectiveCorrect >= 10) return 4.0;
    if (effectiveCorrect >= 8) return 3.5;
    if (effectiveCorrect >= 6) return 3.0;
    if (effectiveCorrect >= 4) return 2.5;
    return 2.0;
  }

  if (skillType === 'general_reading') {
    if (effectiveCorrect >= 40) return 9.0;
    if (effectiveCorrect >= 39) return 8.5;
    if (effectiveCorrect >= 37) return 8.0;
    if (effectiveCorrect >= 36) return 7.5;
    if (effectiveCorrect >= 34) return 7.0;
    if (effectiveCorrect >= 32) return 6.5;
    if (effectiveCorrect >= 30) return 6.0;
    if (effectiveCorrect >= 27) return 5.5;
    if (effectiveCorrect >= 23) return 5.0;
    if (effectiveCorrect >= 19) return 4.5;
    if (effectiveCorrect >= 15) return 4.0;
    if (effectiveCorrect >= 12) return 3.5;
    if (effectiveCorrect >= 8) return 3.0;
    return 2.0;
  }

  // Academic Reading (Default)
  if (effectiveCorrect >= 39) return 9.0;
  if (effectiveCorrect >= 37) return 8.5;
  if (effectiveCorrect >= 35) return 8.0;
  if (effectiveCorrect >= 33) return 7.5;
  if (effectiveCorrect >= 30) return 7.0;
  if (effectiveCorrect >= 27) return 6.5;
  if (effectiveCorrect >= 23) return 6.0;
  if (effectiveCorrect >= 20) return 5.5;
  if (effectiveCorrect >= 16) return 5.0;
  if (effectiveCorrect >= 13) return 4.5;
  if (effectiveCorrect >= 10) return 4.0;
  if (effectiveCorrect >= 8) return 3.5;
  if (effectiveCorrect >= 6) return 3.0;
  if (effectiveCorrect >= 4) return 2.5;
  return 2.0;
}

export function normalizeAnswer(ans: string | undefined | null): string {
  if (!ans) return '';
  return ans
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?]+$/, '') // strip trailing punctuation
    .replace(/\s+/g, ' ');
}

export function isAnswerCorrect(
  userAns: string | string[] | undefined,
  correctAns: string | string[],
  acceptableAnswers?: string[]
): boolean {
  if (!userAns) return false;

  const normalizedUser = normalizeAnswer(Array.isArray(userAns) ? userAns.join(',') : userAns);
  const normalizedCorrect = normalizeAnswer(Array.isArray(correctAns) ? correctAns.join(',') : correctAns);

  if (normalizedUser && normalizedUser === normalizedCorrect) return true;

  // Handle multi-select answers (array or comma-separated option letters like "A, C") in any selection order
  const isLetterMultiList = (val: string | string[]) => {
    const items = Array.isArray(val) ? val : val.split(',');
    return items.length > 1 && items.every((item) => /^[a-z]$/i.test(normalizeAnswer(item)));
  };

  if (Array.isArray(correctAns) || (typeof correctAns === 'string' && isLetterMultiList(correctAns))) {
    const correctList = (Array.isArray(correctAns) ? correctAns : correctAns.split(','))
      .map((s) => normalizeAnswer(s))
      .filter(Boolean)
      .sort();

    const userList = (Array.isArray(userAns) ? userAns : userAns.split(','))
      .map((s) => normalizeAnswer(s))
      .filter(Boolean)
      .sort();

    // Exact set match (e.g. user selected both A and C)
    if (userList.length === correctList.length && userList.every((val, idx) => val === correctList[idx])) {
      return true;
    }

    // In IELTS, for paired questions like Q21 and Q22 (Choose TWO letters A-E),
    // if each question has correctAns = "A, C" and the candidate enters "A" for Q21,
    // that single answer is one of the valid options and is correct.
    if (userList.length === 1 && userList[0] && correctList.includes(userList[0])) {
      return true;
    }
  }

  // Check acceptable alternatives list
  if (acceptableAnswers && acceptableAnswers.length > 0) {
    for (const alt of acceptableAnswers) {
      if (normalizedUser === normalizeAnswer(alt)) return true;
    }
  }

  // Support slash variations e.g. "fruit / fruits" or "seeds / fruit" or "A / B"
  if (typeof correctAns === 'string' && correctAns.includes('/')) {
    const parts = correctAns.split('/').map((p) => normalizeAnswer(p));
    if (parts.includes(normalizedUser)) return true;
  }

  return false;
}

export function gradeExam(exam: Exam, answers: UserAnswerRecord): ScoreReport {
  let totalCorrect = 0;
  let totalQuestions = 0;
  const partScores: { [partNumber: number]: { correct: number; total: number } } = {};
  const details: ScoreReport['details'] = [];

  const isListening =
    exam.category?.toLowerCase().includes('listening') ||
    (exam.title && /listening/i.test(exam.title)) ||
    exam.parts.some((p) => Boolean(p.audioUrl));

  const isGeneralTraining =
    exam.category?.toLowerCase().includes('general') ||
    (exam.title && /general/i.test(exam.title));

  const skillType: ExamSkillType = isListening
    ? 'listening'
    : isGeneralTraining
    ? 'general_reading'
    : 'reading';

  // Track paired multi-answer selections so a candidate cannot get 2 points by answering "A" twice
  const pairedUsedAnswers: Record<string, Set<string>> = {};

  for (const part of exam.parts) {
    const partScore = { correct: 0, total: 0 };
    partScores[part.partNumber] = partScore;

    for (const group of part.questionGroups) {
      for (const question of group.questions) {
        totalQuestions++;
        partScore.total++;

        const userAns = answers[question.orderNumber];
        let correct = isAnswerCorrect(userAns, question.correctAnswer, question.acceptableAnswers);

        // De-duplicate paired questions sharing identical multi-answers (e.g. Q21 & Q22 both have answer "A, C")
        const isMultiOption =
          (Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1) ||
          (typeof question.correctAnswer === 'string' && question.correctAnswer.includes(','));

        if (correct && isMultiOption && userAns) {
          const pairKey = `${group.id}_${Array.isArray(question.correctAnswer) ? question.correctAnswer.join(',') : question.correctAnswer}`;
          const usedSet = (pairedUsedAnswers[pairKey] ??= new Set());

          const normUserStr = normalizeAnswer(Array.isArray(userAns) ? userAns.join(',') : userAns);
          if (usedSet.has(normUserStr)) {
            // Already credited for another question in this pair, cannot reuse same option
            correct = false;
          } else {
            usedSet.add(normUserStr);
          }
        }

        if (correct) {
          totalCorrect++;
          partScore.correct++;
        }

        details.push({
          questionNumber: question.orderNumber,
          userAnswer: userAns || '',
          correctAnswer: question.correctAnswer,
          isCorrect: correct,
          explanation: question.explanation,
        });
      }
    }
  }

  // Sort details by question number
  details.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    totalCorrect,
    totalQuestions,
    bandScore: calculateIELTSBand(totalCorrect, skillType, totalQuestions),
    partScores,
    details,
  };
}

