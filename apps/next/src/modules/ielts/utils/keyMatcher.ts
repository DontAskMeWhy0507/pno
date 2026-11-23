import type { Exam } from '../types/exam';

export interface ParsedKeyItem {
  orderNumber: number;
  answer: string;
  explanation: string;
}

/**
 * Parses freeform answer key text (from ChatGPT, Claude, Gemini, answer sheets, teacher notes)
 * Supports multiple formats:
 * 1. 1. [ANSWER] FALSE \n [EXPLAIN] Paragraph 1 confirms...
 * 2. 1. FALSE - Paragraph 1 evidence...
 * 3. 1. B : Detailed explanation...
 * 4. 1. TRUE | Paragraph 2...
 * 5. 21-22. A, C | Audio Section 3...
 * 6. 21 & 22: A, C
 * 7. Simple list: 1. TRUE \n 2. FALSE \n 3. NOT GIVEN
 */
export function parseQuickKeyText(text: string): ParsedKeyItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ParsedKeyItem[] = [];

  let currentItem: ParsedKeyItem | null = null;

  for (const line of lines) {
    // Check range match first: e.g. "21-22. A, C", "21–22: A, C", "21 & 22. A, C", "Questions 21-22: A, C"
    const rangeMatch = line.match(
      /^(?:Questions?|Câu)?\s*(\d+)\s*(?:[-–]|&|\band\b)\s*(\d+)[\.\)\:\s\-–]+(.*)/i
    );

    if (rangeMatch) {
      if (currentItem) {
        items.push(currentItem);
        currentItem = null;
      }

      const startQ = parseInt(rangeMatch[1]!, 10);
      const endQ = parseInt(rangeMatch[2]!, 10);
      const rest = (rangeMatch[3] || '').trim();

      let ansPart = rest;
      let expPart = '';

      // Check for separator like " | ", " - ", " : ", " [EXPLAIN] "
      if (rest.toUpperCase().includes('[EXPLAIN]')) {
        const parts = rest.split(/\[EXPLAIN(?:ATION)?\]/i);
        ansPart = (parts[0] || '').replace(/^\[ANSWER\]\s*/i, '').trim();
        expPart = (parts[1] || '').trim();
      } else {
        const sepMatch = rest.match(/^(.+?)(?:\s*[|]\s*|\s+[-–:]\s+|\s+(?:Giải thích|Dẫn chứng|Explanation|Lý do)\s*[:\-–]?\s*)(.+)$/i);
        if (sepMatch) {
          ansPart = sepMatch[1]!.trim();
          expPart = sepMatch[2]!.trim();
        }
      }

      // If answers are listed e.g. "A, C" or "A and C" or "TRUE, FALSE"
      const ansTokens = ansPart
        .split(/[,;&]|\band\b/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (let qn = startQ; qn <= endQ; qn++) {
        const idx = qn - startQ;
        const assignedAns = idx < ansTokens.length ? ansTokens[idx]! : ansPart;
        items.push({
          orderNumber: qn,
          answer: assignedAns.replace(/^\[ANSWER\]\s*/i, '').trim(),
          explanation: expPart.replace(/^\[EXPLAIN(?:ATION)?\]\s*/i, '').trim(),
        });
      }
      continue;
    }

    // Match single line starting with question number: e.g. "1.", "1)", "Question 1:", "Câu 1:"
    const numMatch = line.match(/^(?:Questions?|Câu)?\s*(\d+)[\.\)\:\s\-–]+(.*)/i);

    if (numMatch) {
      if (currentItem) {
        items.push(currentItem);
      }

      const qNum = parseInt(numMatch[1]!, 10);
      const rest = (numMatch[2] || '').trim();

      let answer = '';
      let explanation = '';

      // Check tags: [ANSWER] ... [EXPLAIN] ...
      if (rest.toUpperCase().includes('[ANSWER]') || rest.toUpperCase().includes('[EXPLAIN]')) {
        const aM = rest.match(/\[ANSWER\]\s*([^\[]+)/i);
        const eM = rest.match(/\[EXPLAIN(?:ATION)?\]\s*(.+)/i);
        answer = aM?.[1]?.trim() || '';
        explanation = eM?.[1]?.trim() || '';
      } else {
        // Match separators: " | ", " - ", " : ", or keywords like "Giải thích:", "Dẫn chứng:", "Explanation:"
        const sepMatch = rest.match(
          /^([A-Za-z0-9\s,\/\-_]+?)(?:\s*[|]\s*|\s+[-–:]\s*|\s+(?:Giải thích|Dẫn chứng|Explanation|Lý do)\s*[:\-–]?\s*|\s*\((.+)\)$)(.*)/i
        );
        if (sepMatch) {
          answer = sepMatch[1]!.trim();
          explanation = (sepMatch[2] || sepMatch[3] || '').replace(/^\s*[-–:|]\s*/, '').trim();
        } else {
          // If just answer (e.g. "TRUE" or "A" or "building")
          answer = rest;
        }
      }

      currentItem = {
        orderNumber: qNum,
        answer: answer.replace(/^\[ANSWER\]\s*/i, '').trim(),
        explanation: explanation.replace(/^\[EXPLAIN(?:ATION)?\]\s*/i, '').trim(),
      };
    } else if (currentItem) {
      // Continuation of explanation on next line
      if (/^\[EXPLAIN(?:ATION)?\]/i.test(line)) {
        const expContent = line.replace(/^\[EXPLAIN(?:ATION)?\]\s*/i, '').trim();
        currentItem.explanation += (currentItem.explanation ? '\n' : '') + expContent;
      } else if (!/^\[ANSWER\]/i.test(line)) {
        currentItem.explanation += (currentItem.explanation ? '\n' : '') + line;
      }
    }
  }

  if (currentItem) {
    items.push(currentItem);
  }

  return items;
}

/**
 * Merges parsed key items into an Exam structure, matching by question orderNumber
 */
export function mergeKeysIntoExam(
  exam: Exam,
  keyItems: ParsedKeyItem[]
): { exam: Exam; updatedCount: number } {
  const cloned: Exam = JSON.parse(JSON.stringify(exam));
  const keyMap = new Map<number, ParsedKeyItem>();
  for (const item of keyItems) {
    keyMap.set(item.orderNumber, item);
  }

  let updatedCount = 0;

  for (const part of cloned.parts) {
    for (const group of part.questionGroups) {
      for (const q of group.questions) {
        const matched = keyMap.get(q.orderNumber);
        if (matched) {
          if (matched.answer) {
            if (matched.answer.includes('/')) {
              q.acceptableAnswers = matched.answer.split('/').map((s) => s.trim()).filter(Boolean);
              q.correctAnswer = q.acceptableAnswers[0] || matched.answer;
            } else {
              q.correctAnswer = matched.answer;
            }
          }
          if (matched.explanation) {
            q.explanation = matched.explanation;
          }
          updatedCount++;
        }
      }
    }
  }

  return { exam: cloned, updatedCount };
}


/**
 * Standard AI Prompt Templates ready to copy and use with ChatGPT, Claude, Gemini, DeepSeek
 */
export const AI_EXPLAIN_PROMPT_TEMPLATE = `You are an expert IELTS 9.0 examiner and tutor. Please review the following IELTS Reading test passage and questions, and provide ACCURATE OFFICIAL ANSWERS with DETAILED EXPLANATIONS (including direct sentence citations from the passage).

Output the result in the exact tag format below so I can directly paste it into the IELTS practice software:

1. [ANSWER] <Answer for Q1 (e.g. TRUE / FALSE / NOT GIVEN or A / B / C / D or exact words)>
[EXPLAIN] <Detailed explanation citing the specific paragraph and sentence as evidence>

2. [ANSWER] <Answer for Q2>
[EXPLAIN] <Detailed explanation citing the passage...>

(Continue consecutively through the final question of the test)

EXAM PASSAGE & QUESTIONS TO SOLVE:
[Paste your passage content and questions here]
`;

export const AI_FULL_EXAM_PROMPT_TEMPLATE = `You are a Cambridge IELTS exam author. Please create a complete IELTS Academic Reading test (or format the provided passage) using the exact tag specifications below so it can be imported directly into the practice platform:

[TITLE] IELTS READING TEST - TITLE HERE
[TIME] 60
[CATEGORY] IELTS Academic Reading
[DESC] Authentic IELTS Academic Reading practice test with complete answers and detailed explanations

=== PART 1 ===
[PASSAGE_TITLE] Passage 1 Title
[SUBTITLE] Subtitle or summary (optional)
[PASSAGE]
Passage 1 content goes here (approx. 700 - 900 words)...

--- GROUP: Questions 1–6 ---
[INSTRUCTIONS] Do the following statements agree with the information given in the text? Choose TRUE if the statement agrees, FALSE if the statement contradicts, NOT GIVEN if there is no information.
[TYPE] TRUE_FALSE_NOT_GIVEN

1. Statement for Question 1...
[ANSWER] TRUE
[EXPLAIN] Paragraph 1 states: "..." which confirms this statement.

2. Statement for Question 2...
[ANSWER] FALSE
[EXPLAIN] Paragraph 2 states: "..." which directly contradicts this statement.

--- GROUP: Questions 7–13 ---
[INSTRUCTIONS] Complete the notes below. Choose ONE WORD ONLY from the passage for each answer.
[TYPE] FILL_IN_BLANK

7. Sentence with a blank space... ________
[ANSWER] target_word
[EXPLAIN] Paragraph 3 states: "..."

=== PART 2 ===
[PASSAGE_TITLE] Passage 2 Title
[PASSAGE]
Passage 2 content goes here...

=== PART 3 ===
[PASSAGE_TITLE] Passage 3 Title
[PASSAGE]
Passage 3 content goes here...
`;
