import type { Exam, Part, QuestionGroup, Question, QuestionType, QuestionOption } from '../types/exam';
import type { WritingExam } from '../types/writing';
import type { SpeakingExam, SpeakingQuestion } from '../types/speaking';

export interface ParseResult {
  exam: Exam;
  warning?: string;
}

export interface QuestionPatternGuide {
  id: string;
  name: string;
  englishName: string;
  badge: string;
  badgeColor: string;
  description: string;
  syntax: string;
  example: string;
  tips: string[];
}

export function parseIELTSText(rawText: string): ParseResult {
  // 1. Remove UTF-8 BOM, zero-width spaces, and normalize non-breaking spaces
  const sanitized = (rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  const lines = sanitized.split(/\r?\n/).map((l) => l.trim());

  let title = 'Custom IELTS Practice Test';
  let durationMinutes = 60;
  let category = 'IELTS Academic Reading';
  let description = '';

  const parts: Part[] = [];
  let currentPart: Part | null = null;
  let currentGroup: QuestionGroup | null = null;
  let currentQuestion: Partial<Question> | null = null;

  let currentPassageLines: string[] = [];
  let readingPassageMode = false;

  let currentSummaryLines: string[] = [];
  let readingSummaryMode = false;

  let currentGroupHeadings: QuestionOption[] = [];
  let readingHeadingsMode = false;

  let currentGroupOptions: QuestionOption[] = [];
  let readingOptionsMode = false;

  let readingWordBankMode = false;

  const flushPassage = () => {
    if (currentPart && readingPassageMode) {
      currentPart.passage = currentPassageLines.join('\n').trim();
      readingPassageMode = false;
      currentPassageLines = [];
    }
  };

  const flushSummary = () => {
    if (currentGroup && readingSummaryMode) {
      let raw = currentSummaryLines.join('\n').trim();
      // Auto replace blank patterns like 27. _________ or 27__________ into {{27}}
      raw = raw.replace(/(?:\*\*|\b)?(\d+)(?:\*\*|\b)?\s*[_—–\.]{2,}/g, '{{$1}}');
      currentGroup.sharedContent = raw;
      readingSummaryMode = false;
      currentSummaryLines = [];
    }
  };

  const ensurePart = (partNum: number, pTitle?: string): Part => {
    let p = parts.find((x) => x.partNumber === partNum);
    if (!p) {
      p = {
        id: `part-${partNum}`,
        partNumber: partNum,
        title: pTitle || (category?.toLowerCase().includes('listening') ? `Section ${partNum}` : `Reading Passage ${partNum}`),
        subtitle: '',
        passage: '',
        footnotes: '',
        audioUrl: '',
        questionGroups: [],
      };
      parts.push(p);
    }
    return p;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (readingPassageMode && currentPassageLines.length > 0 && currentPassageLines[currentPassageLines.length - 1] !== '') {
        currentPassageLines.push('');
      }
      if (readingSummaryMode && currentSummaryLines.length > 0 && currentSummaryLines[currentSummaryLines.length - 1] !== '') {
        currentSummaryLines.push('');
      }
      continue;
    }

    // Metadata Tags
    if (line.toUpperCase().startsWith('[TITLE]')) {
      title = line.substring(7).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[TIME]')) {
      const parsedTime = parseInt(line.substring(6).trim(), 10);
      if (!isNaN(parsedTime)) durationMinutes = parsedTime;
      continue;
    }
    if (line.toUpperCase().startsWith('[CATEGORY]')) {
      category = line.substring(10).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[DESC]')) {
      description = line.substring(6).trim();
      continue;
    }

    // Part / Section Header: e.g. === PART 1 ===, === SECTION 1 ===, or PASSAGE 1
    const partMatch =
      line.match(/^={2,}\s*(?:PART|PASSAGE|SECTION)\s*([1-4])\s*={2,}/i) ||
      line.match(/^(?:PART|PASSAGE|SECTION)\s*([1-4])(?:\s*[:\-–]|$)/i);
    if (partMatch) {
      flushPassage();
      flushSummary();
      readingWordBankMode = false;
      readingHeadingsMode = false;
      readingOptionsMode = false;

      const pNum = parseInt(partMatch[1]!, 10);
      currentPart = ensurePart(pNum);
      currentGroup = null;
      currentQuestion = null;
      currentGroupHeadings = [];
      currentGroupOptions = [];
      continue;
    }

    if (!currentPart) {
      currentPart = ensurePart(1);
    }

    // Passage / Section Title / Subtitle / Audio / Passage Content Tag
    if (line.toUpperCase().startsWith('[PASSAGE_TITLE]')) {
      flushPassage();
      flushSummary();
      currentPart.title = line.substring(15).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[SECTION_TITLE]')) {
      flushPassage();
      flushSummary();
      currentPart.title = line.substring(15).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[AUDIO]')) {
      currentPart.audioUrl = line.substring(7).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[SUBTITLE]')) {
      currentPart.subtitle = line.substring(10).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[FOOTNOTE]')) {
      flushPassage();
      currentPart.footnotes = line.substring(10).trim();
      continue;
    }
    if (line.toUpperCase().startsWith('[PASSAGE]')) {
      flushSummary();
      readingPassageMode = true;
      readingSummaryMode = false;
      readingWordBankMode = false;
      readingHeadingsMode = false;
      readingOptionsMode = false;
      currentPassageLines = [];
      continue;
    }

    // Question Group Header: e.g. --- GROUP: Questions 1-6 --- or Questions 1-6
    const groupMatch =
      line.match(/^-{2,}\s*(?:GROUP:?)?\s*(Questions?\s*\d+\s*[-–]\s*\d+.*)-{2,}/i) ||
      line.match(/^(Questions?\s*\d+\s*[-–]\s*\d+.*)/i);
    if (groupMatch) {
      flushPassage();
      flushSummary();
      readingWordBankMode = false;
      readingHeadingsMode = false;
      readingOptionsMode = false;

      const gTitle = groupMatch[1]!.trim();
      currentGroup = {
        id: `p${currentPart.partNumber}-g${currentPart.questionGroups.length + 1}`,
        title: gTitle,
        instructions: '',
        questions: [],
      };
      currentPart.questionGroups.push(currentGroup);
      currentQuestion = null;
      currentGroupHeadings = [];
      currentGroupOptions = [];
      continue;
    }

    // Group Instructions Tag
    if (line.toUpperCase().startsWith('[INSTRUCTIONS]')) {
      flushSummary();
      if (currentGroup) {
        currentGroup.instructions = line.substring(14).trim();
      }
      continue;
    }

    // Group Summary Title Tag (for Summary Completion)
    if (line.toUpperCase().startsWith('[SUMMARY_TITLE]')) {
      flushSummary();
      if (currentGroup) {
        currentGroup.summaryTitle = line.substring(15).trim();
      }
      continue;
    }

    // Summary / Shared Content Tag
    if (line.toUpperCase().startsWith('[SHARED_CONTENT]') || line.toUpperCase().startsWith('[SUMMARY]')) {
      flushPassage();
      readingSummaryMode = true;
      readingPassageMode = false;
      readingWordBankMode = false;
      readingHeadingsMode = false;
      readingOptionsMode = false;
      currentSummaryLines = [];
      continue;
    }

    // Word Bank Tag (for Summary with Box)
    if (line.toUpperCase().startsWith('[WORD_BANK]')) {
      flushSummary();
      readingWordBankMode = true;
      readingSummaryMode = false;
      readingHeadingsMode = false;
      readingOptionsMode = false;
      if (currentGroup && !currentGroup.wordBank) {
        currentGroup.wordBank = [];
      }
      continue;
    }

    // Headings List Tag (for Matching Headings)
    if (line.toUpperCase().startsWith('[HEADINGS]') || line.toUpperCase().startsWith('[LIST_OF_HEADINGS]')) {
      flushSummary();
      readingHeadingsMode = true;
      readingWordBankMode = false;
      readingSummaryMode = false;
      readingOptionsMode = false;
      currentGroupHeadings = [];
      continue;
    }

    // Group Shared Options Tag (for Matching Features / Which Paragraph)
    if (line.toUpperCase().startsWith('[OPTIONS]')) {
      flushSummary();
      readingOptionsMode = true;
      readingHeadingsMode = false;
      readingWordBankMode = false;
      readingSummaryMode = false;
      currentGroupOptions = [];
      continue;
    }

    // Group Question Type Tag
    if (line.toUpperCase().startsWith('[TYPE]')) {
      flushSummary();
      const typeStr = line.substring(6).trim().toUpperCase();
      if (currentGroup) {
        (currentGroup as any)._defaultType = typeStr;
      }
      continue;
    }

    // Max Select Tag (for Choose TWO / THREE)
    if (line.toUpperCase().startsWith('[MAX_SELECT]')) {
      const maxN = parseInt(line.substring(12).trim(), 10);
      if (!isNaN(maxN)) {
        if (currentQuestion) currentQuestion.maxSelect = maxN;
        if (currentGroup) (currentGroup as any)._defaultMaxSelect = maxN;
      }
      continue;
    }

    // If we are reading passage body
    if (readingPassageMode) {
      currentPassageLines.push(line);
      continue;
    }

    // If we are reading summary content
    if (readingSummaryMode) {
      const isTimestamp = /^\(?\d{1,2}:\d{2}/.test(line);
      const isDecimal = /^\d+\.\d+/.test(line);
      const isQuestionLine =
        !isTimestamp &&
        !isDecimal &&
        (/^(?:Questions?|Câu)\s*\d+[\.\)\:\-–\s]/i.test(line) ||
          /^\d+[\.\)]\s+/.test(line) ||
          /^\d+[:\-–]\s+/.test(line));

      if (!line.startsWith('[') && !line.startsWith('---') && !line.startsWith('===') && !isQuestionLine) {
        currentSummaryLines.push(line);
        continue;
      } else {
        flushSummary();
      }
    }

    // If we are reading word bank items: e.g. A. poverty or A poverty
    if (readingWordBankMode) {
      const wbMatch = line.match(/^([A-N])\s*[\.\)\-–\s]\s*(.+)/i) || line.match(/^([A-N])\s+(.+)/i);
      if (wbMatch && currentGroup) {
        if (!currentGroup.wordBank) currentGroup.wordBank = [];
        currentGroup.wordBank.push({
          id: wbMatch[1]!.toUpperCase(),
          text: wbMatch[2]!.trim(),
        });
        continue;
      } else if (!line.startsWith('[')) {
        readingWordBankMode = false;
      } else {
        readingWordBankMode = false;
      }
    }

    // If we are reading headings list: e.g. i. The history or i  The history
    if (readingHeadingsMode) {
      const hMatch = line.match(/^(i{1,3}|iv|v|vi{1,3}|ix|x{1,3}|xi{1,3}|xii)\s*[\.\)\-–\s]\s*(.+)/i);
      if (hMatch) {
        currentGroupHeadings.push({
          id: hMatch[1]!.toLowerCase(),
          text: hMatch[2]!.trim(),
        });
        continue;
      } else {
        readingHeadingsMode = false;
      }
    }

    // If we are reading shared group options: e.g. A. Terry Hunt or A  Terry Hunt
    if (readingOptionsMode) {
      const optM = line.match(/^([A-N])\s*[\.\)\-–\s]\s*(.+)/i);
      if (optM) {
        currentGroupOptions.push({
          id: optM[1]!.toUpperCase(),
          text: optM[2]!.trim(),
        });
        continue;
      } else {
        readingOptionsMode = false;
      }
    }

    // Range Question Match: e.g. 7-8. Which TWO... or 20–21. Which TWO...
    const rMatch = line.match(/^(\d+)\s*[-–]\s*(\d+)\s*[\.\)\-–\s]\s*(.+)/);
    if (rMatch) {
      flushSummary();
      const rStart = parseInt(rMatch[1]!, 10);
      const rEnd = parseInt(rMatch[2]!, 10);
      const rPrompt = rMatch[3]!.trim();
      const count = rEnd - rStart + 1;

      if (!currentGroup) {
        currentGroup = {
          id: `p${currentPart.partNumber}-g1`,
          title: `Questions ${rStart}–${rEnd}`,
          instructions: `Choose ${count} letters.`,
          questions: [],
        };
        currentPart.questionGroups.push(currentGroup);
      }

      const rangeQuestions: Question[] = [];
      for (let qN = rStart; qN <= rEnd; qN++) {
        const qItem: Question = {
          id: `q${qN}`,
          orderNumber: qN,
          type: 'MULTIPLE_CHOICE_MULTI',
          prompt: `${rPrompt} (Q${qN})`,
          options: [],
          maxSelect: count,
          correctAnswer: '',
          explanation: '',
        };
        currentGroup.questions.push(qItem);
        rangeQuestions.push(qItem);
      }
      currentQuestion = rangeQuestions[0] ?? null;
      (currentGroup as any)._lastRangeQuestions = rangeQuestions;
      continue;
    }

    // Individual Question Match: e.g. 1. Prompt or 1) Prompt or Question 1: Prompt or 27. [ANSWER] D
    // Or inline blank line without question prefix: e.g. "Caller name: Sarah {{1}}" or "Arrival date: 14th {{4}}"
    const isTimestamp = /^\(?\d{1,2}:\d{2}/.test(line);
    const isDecimal = /^\d+\.\d+/.test(line);
    const qMatch = !isTimestamp && !isDecimal
      ? line.match(/^(?:Questions?|Câu)\s*(\d+)[\.\)\:\-–\s]\s*(.*)/i) ||
        line.match(/^(\d+)[\.\)]\s+(.*)/) ||
        line.match(/^(\d+)[:\-–]\s+(.*)/)
      : null;
    const inlineBlankMatch =
      !qMatch && !isTimestamp && !isDecimal && !line.startsWith('---') && !line.startsWith('===') && !line.startsWith('[') && !line.startsWith('*')
        ? line.match(/\{\{(\d+)\}\}/)
        : null;

    if (qMatch || inlineBlankMatch) {
      flushSummary();
      const qNum = qMatch ? parseInt(qMatch[1]!, 10) : parseInt(inlineBlankMatch![1]!, 10);
      let qPrompt = qMatch ? (qMatch[2] || '').trim() : line.trim();
      let extractedAnswer = '';

      // Check if qPrompt starts with an inline answer tag e.g. [ANSWER] D or Answer: TRUE
      const inlineAnsMatch = qPrompt.match(/^(?:\[ANSWER\]|Answer:|Đáp án:)\s*(.+)/i);
      if (inlineAnsMatch) {
        extractedAnswer = inlineAnsMatch[1]!.trim();
        qPrompt = `Question ${qNum}`;
      } else if (
        // If it's a summary or matching group and qPrompt is just a single letter / roman numeral (e.g. "27. D" or "14. iii")
        currentGroup &&
        (currentGroup.wordBank?.length ||
          currentGroupHeadings.length ||
          currentGroupOptions.length ||
          (currentGroup.sharedContent && currentGroup.sharedContent.includes(`{{${qNum}}}`))) &&
        (/^[A-N]$/i.test(qPrompt) || /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(qPrompt))
      ) {
        extractedAnswer = qPrompt;
        qPrompt = `Question ${qNum}`;
      }

      // Clean trailing unmatched asterisks e.g. "Some prompt text**"
      if (qPrompt.endsWith('**') && !qPrompt.startsWith('**') && (qPrompt.match(/\*\*/g) || []).length % 2 !== 0) {
        qPrompt = qPrompt.replace(/\*\*+$/, '').trim();
      }

      if (!currentGroup) {
        currentGroup = {
          id: `p${currentPart.partNumber}-g1`,
          title: `Questions ${qNum}–`,
          instructions: 'Answer the questions according to the text.',
          questions: [],
        };
        currentPart.questionGroups.push(currentGroup);
      }

      const instrLower = (currentGroup.instructions || '').toLowerCase();
      let defaultType: QuestionType = 'FILL_IN_BLANK';

      if ((currentGroup as any)._defaultType) {
        defaultType = (currentGroup as any)._defaultType as QuestionType;
      } else if (instrLower.includes('true') && instrLower.includes('false')) {
        defaultType = 'TRUE_FALSE_NOT_GIVEN';
      } else if (instrLower.includes('yes') && instrLower.includes('no')) {
        defaultType = 'YES_NO_NOT_GIVEN';
      } else if (currentGroup.wordBank && currentGroup.wordBank.length > 0) {
        defaultType = 'MATCHING';
      } else if (currentGroupHeadings.length > 0 || currentGroupOptions.length > 0) {
        defaultType = 'MATCHING';
      } else if (instrLower.includes('choose the correct letter') || instrLower.includes('choose the correct option')) {
        defaultType = 'MULTIPLE_CHOICE_SINGLE';
      } else if (
        inlineBlankMatch ||
        instrLower.includes('complete') ||
        instrLower.includes('no more than') ||
        instrLower.includes('blank') ||
        instrLower.includes('notes') ||
        instrLower.includes('sentences')
      ) {
        defaultType = 'FILL_IN_BLANK';
      } else {
        defaultType = 'FILL_IN_BLANK';
      }

      let inheritedOptions: QuestionOption[] = [];
      if (defaultType === 'TRUE_FALSE_NOT_GIVEN') {
        inheritedOptions = [
          { id: 'TRUE', text: 'TRUE' },
          { id: 'FALSE', text: 'FALSE' },
          { id: 'NOT GIVEN', text: 'NOT GIVEN' },
        ];
      } else if (defaultType === 'YES_NO_NOT_GIVEN') {
        inheritedOptions = [
          { id: 'YES', text: 'YES' },
          { id: 'NO', text: 'NO' },
          { id: 'NOT GIVEN', text: 'NOT GIVEN' },
        ];
      } else if (currentGroup.wordBank && currentGroup.wordBank.length > 0) {
        inheritedOptions = currentGroup.wordBank;
      } else if (currentGroupHeadings.length > 0) {
        inheritedOptions = currentGroupHeadings;
      } else if (currentGroupOptions.length > 0) {
        inheritedOptions = currentGroupOptions;
      }

      const newQ: Question = {
        id: `q${qNum}`,
        orderNumber: qNum,
        type: defaultType,
        prompt: qPrompt || `Question ${qNum}`,
        options: inheritedOptions,
        correctAnswer: extractedAnswer,
        explanation: '',
      };

      if (extractedAnswer.includes('/')) {
        newQ.acceptableAnswers = extractedAnswer.split('/').map((s) => s.trim()).filter(Boolean);
        newQ.correctAnswer = newQ.acceptableAnswers[0] || extractedAnswer;
      }

      currentGroup.questions.push(newQ);
      currentQuestion = newQ;
      (currentGroup as any)._lastRangeQuestions = null;
      continue;
    }

    // Marked option or answer e.g. * A. Mitchell or * B. 2005 or * B or * Mitchell
    const markedMatch = line.match(/^\*\s*(?:([A-N])\s*[\.\)\-–\:\s]\s*)?(.*)/i);
    if (markedMatch && (markedMatch[1] || markedMatch[2])) {
      const optLetter = (markedMatch[1] || '').toUpperCase();
      const markText = (markedMatch[2] || '').trim();

      if (currentQuestion) {
        if (
          currentQuestion.type === 'MULTIPLE_CHOICE_SINGLE' ||
          currentQuestion.type === 'MULTIPLE_CHOICE_MULTI' ||
          currentQuestion.type === 'MATCHING'
        ) {
          if (optLetter) {
            currentQuestion.correctAnswer = optLetter;
            if (
              currentQuestion.type !== 'MATCHING' &&
              markText &&
              (!currentQuestion.options || !currentQuestion.options.some((o) => o.id === optLetter))
            ) {
              if (!currentQuestion.options) currentQuestion.options = [];
              currentQuestion.options.push({ id: optLetter, text: markText });
            }
          } else if (markText) {
            currentQuestion.correctAnswer = markText;
          }
        } else {
          // Fill in blank
          currentQuestion.correctAnswer = markText || optLetter;
        }
        continue;
      }
    }

    // Multiple choice option: e.g. A. text or A) text
    const optMatch = line.match(/^([A-N])\s*[\.\)\-–\s]\s*(.+)/);
    if (optMatch) {
      const optId = optMatch[1]!.toUpperCase();
      const optText = optMatch[2]!.trim();

      const lastRange = (currentGroup as any)?._lastRangeQuestions as Question[] | undefined;
      if (lastRange && lastRange.length > 0) {
        for (const rq of lastRange) {
          if (!rq.options) rq.options = [];
          rq.options.push({ id: optId, text: optText });
        }
        continue;
      }

      if (currentQuestion) {
        currentQuestion.type = 'MULTIPLE_CHOICE_SINGLE';
        if (!currentQuestion.options || currentQuestion.options.some((o) => o.id === 'TRUE')) {
          currentQuestion.options = [];
        }
        currentQuestion.options.push({ id: optId, text: optText });
        continue;
      }
    }

    // Answer Tag: [ANSWER] TRUE or Answer: TRUE
    const ansMatch = line.match(/^(?:\[ANSWER\]|Answer:|Đáp án:)\s*(.+)/i);
    if (ansMatch) {
      const ansVal = ansMatch[1]!.trim();
      const lastRange = (currentGroup as any)?._lastRangeQuestions as Question[] | undefined;

      if (lastRange && lastRange.length > 0) {
        const parts = ansVal.split(/[,;]\s*/).map((s) => s.trim());
        lastRange.forEach((rq, idx) => {
          rq.correctAnswer = parts[idx] || ansVal;
        });
        continue;
      }

      if (currentQuestion) {
        if (ansVal.includes('/')) {
          currentQuestion.acceptableAnswers = ansVal.split('/').map((s) => s.trim());
          currentQuestion.correctAnswer = currentQuestion.acceptableAnswers[0] || ansVal;
        } else {
          currentQuestion.correctAnswer = ansVal;
        }
        continue;
      }
    }

    // Explanation Tag: [EXPLAIN] or Explanation: or Giải thích:
    const explMatch = line.match(/^(?:\[EXPLAIN\]|\[EXPLANATION\]|Explanation:|Giải thích:)\s*(.+)/i);
    if (explMatch) {
      const expVal = explMatch[1]!.trim();
      const lastRange = (currentGroup as any)?._lastRangeQuestions as Question[] | undefined;
      if (lastRange && lastRange.length > 0) {
        lastRange.forEach((rq) => {
          rq.explanation = expVal;
        });
        continue;
      }

      if (currentQuestion) {
        currentQuestion.explanation = expVal;
        continue;
      }
    }

    // If currentGroup exists and doesn't have instructions yet, lines before question 1 are instructions
    if (currentGroup && currentGroup.questions.length === 0 && !currentGroup.instructions) {
      currentGroup.instructions = line;
      continue;
    }
  }

  // Final flushes
  flushPassage();
  flushSummary();

  // Ensure at least 1 part exists if none was specified
  if (parts.length === 0) {
    parts.push(ensurePart(1));
  } else if (!category?.toLowerCase().includes('listening') && parts.length < 3 && parts.every(p => p.partNumber <= parts.length)) {
    // For Reading only: ensure 3 parts if sequentially building a standard 3-passage reading test
    while (parts.length < 3) {
      parts.push(ensurePart(parts.length + 1));
    }
  }

  // Sort parts
  parts.sort((a, b) => a.partNumber - b.partNumber);

  return {
    exam: {
      id: `exam_${Date.now()}`,
      title,
      description,
      category,
      durationMinutes,
      parts,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isBuiltin: false,
    },
  };
}

/**
 * Complete official 40-question sample IELTS Academic Reading test
 * Covering all 3 parts and all 8 question types with answers and explanations
 */
export const FULL_40_QUESTIONS_TXT_TEMPLATE = `[TITLE] CAMBRIDGE 19 - PRACTICE TEST 1 READING
[TIME] 60
[CATEGORY] IELTS Academic Reading
[DESC] Complete 40-question IELTS Academic Reading practice test covering all 8 computer-delivered question types.

=== PART 1 ===
[PASSAGE_TITLE] The Baobabs of Madagascar
[SUBTITLE] Ancient giants of the island facing ecological transformations
[PASSAGE]
The island of Madagascar in the Indian Ocean is the best place in the world to see baobabs. These spectacular trees, with their massive trunks and distinctive horizontal root-like branches, can live over 800 years. Of the eight known species, six are found only there, while a seventh has made its way across the Mozambique Channel from mainland Africa with a certain amount of human help.

Some of the most visited and photographed baobabs in Madagascar are at the Avenue des Baobabs in the western province of Menabe, close to the town of Morondava. There, a dozen trees straddle a narrow sandy road, soaring 30 metres into the sky. Known as renala – ‘mother of the forest’ - in the local Malagasy language, these trees belong to the tallest baobab species in the world: Adansonia grandidieri, named after two great 19th-century French botanists, Michel Adanson and Alfred Grandidier.

Baobabs have religious and spiritual significance for many Malagasy tribes, although the majority of the island's population will probably never see one – they only grow along the western margin of the island and not in the more populous central highlands. However, as the national tree and the national emblem, the trees are an ideal symbol for increasing awareness not only of the endangered forests, but also of the traditional beliefs of the people who live alongside them.

Back in the early 20th century, much of the Morondava plain was cleared for rice and sugar-cane fields. However, many baobabs were spared because they are valuable as a food source and renewable building material. These days many stand alone in fields, a reminder of where the forest once was. But now it seems that even the mighty baobabs are falling down.

The exact cause of the falling baobabs is uncertain, but some people think that the water used to irrigate the nearby fields is partly to blame. Baobabs are adapted to the annual wet season, but their roots cannot cope with constantly waterlogged soils. Lone trees separated from the surrounding forest are also susceptible to cyclones, which reach speeds of over 200 kph in the area.

[FOOTNOTE] * Malagasy: of or relating to Madagascar

--- GROUP: Questions 1–6 ---
[INSTRUCTIONS] Do the following statements agree with the information given in Reading Passage 1?
Write TRUE if the statement agrees with the information,
FALSE if the statement contradicts the information,
NOT GIVEN if there is no information on this.
[TYPE] TRUE_FALSE_NOT_GIVEN

1. All of the baobab species found on Madagascar are native exclusively to the island.
[ANSWER] FALSE
[EXPLAIN] Paragraph 1: Six are found only there, while a seventh has made its way across from mainland Africa.

2. Adanson and Grandidier were the first European botanists to describe Madagascar's plants.
[ANSWER] NOT GIVEN
[EXPLAIN] Paragraph 2 mentions the names of both botanists, but does not indicate whether they were the first.

3. The Avenue des Baobabs landscape was formed as a result of human agricultural activities.
[ANSWER] TRUE
[EXPLAIN] Paragraph 4: Much of the Morondava plain was cleared for rice and sugar-cane fields.

4. Malagasy people avoid cutting down baobabs because they hold them in spiritual reverence.
[ANSWER] FALSE
[EXPLAIN] Paragraph 4: Many baobabs were spared because they are valuable as a food source and renewable building material.

5. Baobab trees are capable of surviving indefinitely in flooded conditions.
[ANSWER] FALSE
[EXPLAIN] Paragraph 5: Their roots cannot cope with constantly waterlogged soils.

6. Cyclones represent a severe threat to isolated baobab trees.
[ANSWER] TRUE
[EXPLAIN] Paragraph 5: Lone trees separated from the forest are also susceptible to cyclones reaching speeds over 200 kph.

--- GROUP: Questions 7–13 ---
[INSTRUCTIONS] Complete the notes below. Choose ONE WORD ONLY from the passage for each answer.
[TYPE] FILL_IN_BLANK

7. The local name renala translates to the ________ of the forest.
[ANSWER] mother
[EXPLAIN] Paragraph 2: Known as renala – 'mother of the forest'.

8. Baobabs primarily grow along the ________ margin of Madagascar.
[ANSWER] western
[EXPLAIN] Paragraph 3: They only grow along the western margin of the island.

9. Baobabs serve as an ideal national ________ for environmental protection.
[ANSWER] symbol / emblem
[EXPLAIN] Paragraph 3: As the national tree and the national emblem, the trees are an ideal symbol...

10. In the 20th century, plains were cleared to establish fields of ________ and sugar cane.
[ANSWER] rice
[EXPLAIN] Paragraph 4: Cleared for rice and sugar-cane fields.

11. Baobab timber and bark provide renewable ________ material for locals.
[ANSWER] building
[EXPLAIN] Paragraph 4: Valuable as a food source and renewable building material.

12. Farmers use artificial ________ methods that keep the soil overly wet.
[ANSWER] irrigation
[EXPLAIN] Paragraph 5: Water used to irrigate the nearby fields is partly to blame.

13. Extreme winds from seasonal ________ can topple 30-metre baobab trunks.
[ANSWER] cyclones
[EXPLAIN] Paragraph 5: Susceptible to cyclones, which reach speeds of over 200 kph.

=== PART 2 ===
[PASSAGE_TITLE] The Mystery of Easter Island
[SUBTITLE] How archaeological evidence overturned the ecocide theory
[PASSAGE]
Section A
Easter Island, or Rapa Nui, is a remote volcanic speck in the South Pacific, famous for its colossal stone statues, or moai. When the Dutch explorer Jacob Roggeveen arrived on Easter Day in 1722, he found an isolated society living on a treeless landscape. For decades, conventional wisdom held that the islanders had committed environmental suicide. According to this ecocide narrative, popularized by Jared Diamond, the settlers chopped down the once-lush palm forests to move huge statues and fuel agriculture, leading to societal collapse.

Section B
Recent excavations, however, paint a radically different picture. Archaeologists Terry Hunt and Carl Lipo analyzed palm seed fragments preserved in caves. Nearly all surviving seed shells display tiny gnaw marks characteristic of the Polynesian rat (Rattus exulans). The settlers had brought these rats aboard their canoes as livestock. In the absence of natural predators, the rat population exploded into millions, devouring the seeds before new palm seedlings could germinate.

Section C
Furthermore, anthropological surveys revealed ingenious farming techniques. Instead of recklessly exhausting their soils, the islanders constructed extensive lithic mulches – rock gardens composed of broken volcanic basalt. These rocks prevented moisture evaporation, protected crops from desiccating winds, and continuously enriched the soil with minerals. Soil scientists now agree that Easter Island supported a thriving, stable population right up until European contact introduced continental diseases.

Section D
The question of how the islanders transported hundreds of massive moai without wooden rollers has also found an astonishing answer. Lipo and Hunt experimented with concrete replicas. By attaching three sturdy ropes to the head of a statue, a small team of twenty workers could rock the replica forward from side to side in an upright walking motion. Ancient island legends that the moai 'walked' to their platforms were quite literally true.

Section E
Rather than a cautionary tale of reckless self-destruction, Easter Island offers an inspiring story of human resilience and ecological adaptability in an extremely fragile island ecosystem.

Section F
Today, modern environmental historians view the civilization of Rapa Nui not as a collapsed society, but as a remarkable testament to collective ingenuity. The statues remain towering monuments to the sophisticated organization and communal spirit of their Pacific Polynesian creators.

--- GROUP: Questions 14–19 ---
[INSTRUCTIONS] Reading Passage 2 has six sections, A-F. Choose the correct heading for each section from the list of headings below.
[TYPE] MATCHING
[HEADINGS]
i. An innovative agricultural technique using rocks
ii. Experimental confirmation of ancient walking legends
iii. The traditional ecocide hypothesis and its proponents
iv. The true biological culprit behind deforestation
v. Re-evaluating the historical legacy of the islanders
vi. Early European trade agreements with native leaders
vii. Construction methods of offshore wooden canoes
viii. Modern scientific reverence for Pacific engineering

14. Section A
[ANSWER] iii
[EXPLAIN] Section A presents the traditional ecocide hypothesis popularized by Jared Diamond.

15. Section B
[ANSWER] iv
[EXPLAIN] Section B reveals the true biological culprit: Polynesian rats consuming palm seeds.

16. Section C
[ANSWER] i
[EXPLAIN] Section C details the ingenious agricultural technique of rock gardens (lithic mulch) to conserve moisture.

17. Section D
[ANSWER] ii
[EXPLAIN] Section D presents experimental tests confirming the ancient legends of statues 'walking' upright.

18. Section E
[ANSWER] v
[EXPLAIN] Section E summarizes the reassessment of the islanders' legacy as one of resilience and adaptability.

19. Section F
[ANSWER] viii
[EXPLAIN] Section F highlights modern scientific reverence and appreciation for Rapa Nui engineering.

--- GROUP: Questions 20–21 ---
[INSTRUCTIONS] Choose TWO letters, A-E.
Which TWO factors contributed directly to the loss of palm forests according to recent findings?
[TYPE] MULTIPLE_CHOICE_MULTI
[MAX_SELECT] 2

20-21. Factors in forest disappearance:
A. The rapid consumption of tree seeds by rodents
B. Catastrophic volcanic eruptions covering fertile land
C. Continuous timber cutting for canoe construction
D. Human clearance of land for rock gardens
E. Prolonged drought caused by climate shifts
[ANSWER] A, D
[EXPLAIN] The text confirms rat consumption of seeds (A) and human land clearance for rock gardens (D).

--- GROUP: Questions 22–26 ---
[INSTRUCTIONS] Look at the following statements and the list of researchers below. Match each statement with the correct researcher, A-C.
[TYPE] MATCHING
[OPTIONS]
A. Jacob Roggeveen
B. Jared Diamond
C. Terry Hunt and Carl Lipo

22. Popularized the idea that the islanders intentionally devastated their own habitat.
[ANSWER] B
[EXPLAIN] Section A: Popularized by Jared Diamond, the settlers chopped down palm forests.

23. Recorded the first European sighting of Easter Island and its treeless landscape.
[ANSWER] A
[EXPLAIN] Section A: Dutch explorer Jacob Roggeveen arrived on Easter Day in 1722.

24. Discovered physical evidence of rodent tooth marks on ancient palm seed remnants.
[ANSWER] C
[EXPLAIN] Section B: Archaeologists Terry Hunt and Carl Lipo analyzed palm seed fragments.

25. Demonstrated that heavy statues could be moved vertically using ropes.
[ANSWER] C
[EXPLAIN] Section D: Lipo and Hunt experimented with replicas and ropes.

26. Believed the collapse of Easter Island was an ecocide disaster.
[ANSWER] B
[EXPLAIN] Section A: According to this ecocide narrative, popularized by Jared Diamond.

=== PART 3 ===
[PASSAGE_TITLE] The Science of Human Sleep and Cognition
[SUBTITLE] How neurobiology is uncovering the essential functions of slumber
[PASSAGE]
Sleep is one of the most conserved biological behaviors across the animal kingdom. Far from being a state of passive rest, sleep is an active and dynamic neurological process essential for memory consolidation, metabolic cleanup, and psychological regulation.

During non-rapid eye movement (NREM) sleep, particularly slow-wave deep sleep, the brain generates slow synchronized electrical oscillations. These brainwaves facilitate the transfer of short-term memories from the temporary storage of the hippocampus into the permanent architecture of the neocortex. Neuroscientists have observed that depriving individuals of slow-wave sleep impairs their ability to retain newly acquired factual knowledge.

Simultaneously, the brain's glymphatic system becomes remarkably active during deep sleep. Cerebrospinal fluid rushes through brain tissue, flushing away metabolic waste products that accumulate during waking hours. Foremost among these toxins is beta-amyloid, a protein implicated in the pathology of Alzheimer's disease. Chronic sleep deficit allows these toxic aggregates to build up, progressively compromising neuronal integrity.

Rapid eye movement (REM) sleep, by contrast, is characterized by vivid dreaming and high cortical activation resembling waking consciousness. REM sleep serves as a psychological therapy session, dissolving emotional distress from waking memories. Furthermore, REM sleep enhances creative problem-solving by forging connections between distant conceptual networks that waking logic might overlook.

Despite these vital advantages, modern industrialized society suffers from an unprecedented epidemic of sleep deprivation. Artificial blue light from smartphones suppresses the nocturnal secretion of melatonin, the neurohormone signaling biological night. Public health specialists argue that prioritizing eight hours of nightly rest is not a luxury, but an imperative foundation for cognitive health and longevity.

--- GROUP: Questions 27–31 ---
[INSTRUCTIONS] Complete the summary using the list of words and phrases, A-F, below.
[SUMMARY_TITLE] Biological processes during slow-wave sleep
[SHARED_CONTENT]
Deep slow-wave rest is crucial for cognitive preservation. During this stage, synchronized electrical waves transfer information from the {{27}} to permanent neural storage in the {{28}}. In addition, the brain activates its {{29}} system, which operates like a biological cleansing cycle. This process flushes away toxic proteins such as {{30}}, which is closely connected with {{31}} disease.
[WORD_BANK]
A. hippocampus
B. neocortex
C. glymphatic
D. beta-amyloid
E. Alzheimer's
F. melatonin

27. [ANSWER] A
[EXPLAIN] Paragraph 2: transfer from the hippocampus...
28. [ANSWER] B
[EXPLAIN] Paragraph 2: ...into the permanent architecture of the neocortex.
29. [ANSWER] C
[EXPLAIN] Paragraph 3: glymphatic system becomes remarkably active...
30. [ANSWER] D
[EXPLAIN] Paragraph 3: flushing away metabolic waste... foremost among these toxins is beta-amyloid.
31. [ANSWER] E
[EXPLAIN] Paragraph 3: implicated in the pathology of Alzheimer's disease.

--- GROUP: Questions 32–35 ---
[INSTRUCTIONS] Choose the correct letter, A, B, C or D.
[TYPE] MULTIPLE_CHOICE_SINGLE

32. What is the primary function of slow-wave oscillations during NREM sleep?
A. to produce vivid visual dreams
B. to transfer memories into long-term storage
C. to stimulate rapid physical muscle recovery
D. to lower body core temperature
[ANSWER] B
[EXPLAIN] Paragraph 2: facilitate the transfer of short-term memories into permanent neocortex.

33. What is the role of the glymphatic system during slumber?
A. to synthesize essential sleep hormones
B. to clear out harmful metabolic by-products
C. to regulate emotional distress from waking hours
D. to prevent sudden eye movement
[ANSWER] B
[EXPLAIN] Paragraph 3: cerebrospinal fluid flushes away metabolic waste products.

34. How does REM sleep assist cognitive function?
A. by boosting creative links between concepts
B. by reducing cellular respiration in the cortex
C. by stimulating melatonin synthesis
D. by preventing emotional memory retention
[ANSWER] A
[EXPLAIN] Paragraph 4: enhances creative problem-solving by forging connections between distant networks.

35. What is mentioned as a major cause of modern sleep disruption?
A. consumption of processed food
B. exposure to smartphone blue light
C. excessive physical exercise late at night
D. lack of environmental noise insulation
[ANSWER] B
[EXPLAIN] Paragraph 5: artificial blue light from smartphones suppresses melatonin secretion.

--- GROUP: Questions 36–40 ---
[INSTRUCTIONS] Do the following statements agree with the claims of the writer in Reading Passage 3?
Write YES if the statement agrees with the claims,
NO if the statement contradicts the claims,
NOT GIVEN if it is impossible to say what the writer thinks.
[TYPE] YES_NO_NOT_GIVEN

36. Sleep is a behavior unique to human beings and higher mammals.
[ANSWER] NO
[EXPLAIN] Paragraph 1: One of the most conserved biological behaviors across the animal kingdom.

37. People deprived of deep sleep show decreased ability to learn new facts.
[ANSWER] YES
[EXPLAIN] Paragraph 2: Depriving individuals of slow-wave sleep impairs their ability to retain factual knowledge.

38. The accumulation of beta-amyloid has no correlation with neurological disorders.
[ANSWER] NO
[EXPLAIN] Paragraph 3: Implicated in the pathology of Alzheimer's disease.

39. REM sleep completely eliminates negative emotions associated with past events.
[ANSWER] NO
[EXPLAIN] Paragraph 4: Dissolving emotional distress, but does not completely eliminate memory.

40. Adults need significantly less sleep than adolescents to maintain optimal health.
[ANSWER] NOT GIVEN
[EXPLAIN] Paragraph 5 recommends 8 hours per night, but does not compare requirements between adults and adolescents.
`;

/**
 * Full syntax specification covering all 8 IELTS Reading question types
 */
export const FULL_IELTS_PATTERN_SPEC = `================================================================================
IELTS READING TXT SPECIFICATION GUIDE (ALL 8 OFFICIAL QUESTION TYPES)
================================================================================
The parser automatically extracts reading passages, identifies question groups,
and pairs official answers with explanations with 100% fidelity to the computer-delivered exam.

I. OVERALL EXAM STRUCTURE:
--------------------------------------------------------------------------------
[TITLE] <Exam Name - Example: CAMBRIDGE 19 - PRACTICE TEST 1 READING>
[TIME] 60
[CATEGORY] IELTS Academic Reading
[DESC] <Short description of the exam>

=== PART 1 ===
[PASSAGE_TITLE] <Passage 1 Title>
[SUBTITLE] <Passage summary/subtitle (optional)>
[PASSAGE]
<Passage 1 text content...>
[FOOTNOTE] <* Difficult vocabulary notes (optional)>

--- GROUP: Questions 1–6 ---
[INSTRUCTIONS] <Instructions for this group>
[TYPE] <Question type format>
... (Questions 1 through 6) ...

=== PART 2 ===
[PASSAGE_TITLE] <Passage 2 Title>
[PASSAGE]
<Passage 2 text content...>
... (Question groups 14 through 26) ...

=== PART 3 ===
[PASSAGE_TITLE] <Passage 3 Title>
[PASSAGE]
<Passage 3 text content...>
... (Question groups 27 through 40) ...


II. DETAILED SYNTAX FOR ALL 8 OFFICIAL QUESTION TYPES:
--------------------------------------------------------------------------------

1. TRUE / FALSE / NOT GIVEN OR YES / NO / NOT GIVEN:
-----------------------------------------------------
[TYPE] TRUE_FALSE_NOT_GIVEN (or YES_NO_NOT_GIVEN)
Question syntax:
1. All of the baobab species found on Madagascar are native exclusively to the island.
[ANSWER] FALSE
[EXPLAIN] Paragraph 1: Six are found only there, while a seventh has made its way across...

2. Adanson and Grandidier were the first European botanists to describe Madagascar's plants.
[ANSWER] NOT GIVEN
[EXPLAIN] Paragraph 2 mentions the two botanists but does not specify if they were first.

2. MULTIPLE CHOICE SINGLE (CHOOSE 1 OF 4: A, B, C, D):
------------------------------------------------------------------------
[TYPE] MULTIPLE_CHOICE_SINGLE
Question syntax:
32. What is the primary function of slow-wave oscillations during NREM sleep?
A. to produce vivid visual dreams
B. to transfer memories into long-term storage
C. to stimulate rapid physical muscle recovery
D. to lower body core temperature
[ANSWER] B
[EXPLAIN] Paragraph 2: facilitate the transfer of short-term memories into permanent neocortex.

3. MULTIPLE CHOICE MULTI (CHOOSE TWO / THREE):
----------------------------------------------------------------
[TYPE] MULTIPLE_CHOICE_MULTI
[MAX_SELECT] 2
Question syntax (consecutive numbers e.g. 20-21.):
20-21. Which TWO factors contributed directly to the loss of palm forests?
A. The rapid consumption of tree seeds by rodents
B. Catastrophic volcanic eruptions covering fertile land
C. Continuous timber cutting for canoe construction
D. Human clearance of land for rock gardens
E. Prolonged drought caused by climate shifts
[ANSWER] A, D
[EXPLAIN] The text confirms rat consumption of seeds (A) and human land clearance for rock gardens (D).

4. DIRECT COMPLETION (SENTENCE / NOTE / SUMMARY / TABLE COMPLETION - NO BOX):
-----------------------------------------------------------------------------
[TYPE] FILL_IN_BLANK
Question syntax (use ________ for the blank):
7. The local name renala translates to the ________ of the forest.
[ANSWER] mother
[EXPLAIN] Paragraph 2: Known as renala – 'mother of the forest'.
(If multiple synonyms are accepted, separate with / e.g.: symbol / emblem)

5. SUMMARY COMPLETION WITH WORD BANK (BOX OF WORDS A-F):
--------------------------------------------------------------------
[INSTRUCTIONS] Complete the summary using the list of words and phrases, A-F, below.
[SUMMARY_TITLE] Biological processes during slow-wave sleep
[SHARED_CONTENT]
Deep slow-wave rest is crucial for cognitive preservation. During this stage, synchronized electrical waves transfer information from the {{27}} to permanent neural storage in the {{28}}. In addition, the brain activates its {{29}} system, which operates like a biological cleansing cycle. This process flushes away toxic proteins such as {{30}}, which is closely connected with {{31}} disease.
[WORD_BANK]
A. hippocampus
B. neocortex
C. glymphatic
D. beta-amyloid
E. Alzheimer's
F. melatonin

27. [ANSWER] A
[EXPLAIN] Paragraph 2: transfer from the hippocampus...
28. [ANSWER] B
[EXPLAIN] Paragraph 2: into the permanent architecture of the neocortex.

6. MATCHING HEADINGS (LIST OF HEADINGS: i, ii, iii...):
-----------------------------------------------------------
[TYPE] MATCHING
[HEADINGS]
i. An innovative agricultural technique using rocks
ii. Experimental confirmation of ancient walking legends
iii. The traditional ecocide hypothesis and its proponents
iv. The true biological culprit behind deforestation
v. Re-evaluating the historical legacy of the islanders

14. Section A
[ANSWER] iii
[EXPLAIN] Section A presents the traditional ecocide hypothesis of Jared Diamond.
15. Section B
[ANSWER] iv
[EXPLAIN] Section B identifies the true culprit as the Polynesian rat.

7. MATCHING FEATURES / RESEARCHERS / PARAGRAPHS:
------------------------------------------------------------------------
[TYPE] MATCHING
[OPTIONS]
A. Jacob Roggeveen
B. Jared Diamond
C. Terry Hunt and Carl Lipo

22. Popularized the idea that the islanders intentionally devastated their own habitat.
[ANSWER] B
[EXPLAIN] Section A: Popularized by Jared Diamond.
23. Recorded the first European sighting of Easter Island.
[ANSWER] A
[EXPLAIN] Section A: Dutch explorer Jacob Roggeveen arrived in 1722.

8. INLINE SHORTCUT SYNTAX:
---------------------------------------------------------
The parser also supports direct inline answers:
27. [ANSWER] D
or
27. D
Both formats are parsed accurately into official computer-delivered answer records!
================================================================================
`;

/**
 * Detailed specification of standard TXT patterns for all official IELTS Reading question types
 */
export const IELTS_QUESTION_PATTERNS: QuestionPatternGuide[] = [
  {
    id: 'full_40q',
    name: '⭐ Complete 40-Question Exam (All 8 Question Types)',
    englishName: 'Complete 40-Question Exam (All 8 IELTS Types)',
    badge: '100% Complete',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
    description: 'A full 40-question exam across 3 Cambridge-standard reading passages, covering all 8 question types: T/F/NG, Fill in Blank, Matching Headings (i–viii), Choose TWO, Matching Features, Summary with Word Bank {{27}}…{{31}}, Single MCQ (A–D), and Y/N/NG. Includes 100% correct answers and detailed explanations.',
    syntax: `[TITLE] CAMBRIDGE 19 - PRACTICE TEST 1 READING
[TIME] 60
[CATEGORY] IELTS Academic Reading

=== PART 1 === (Questions 1-13: T/F/NG & Fill in blank)
=== PART 2 === (Questions 14-26: Headings, Choose 2, Matching)
=== PART 3 === (Questions 27-40: Summary Word Bank, MCQ, Y/N/NG)`,
    example: FULL_40_QUESTIONS_TXT_TEMPLATE,
    tips: [
      'This is a complete 40-question exam following the real IELTS on Computer test format.',
      'Click "Copy Template" to copy all 40 questions to the clipboard, or "Insert into Editor" to create a practice test instantly.',
      'Ideal to send as a reference template to AI tools (ChatGPT, Claude, DeepSeek) when asking them to generate new exam questions.',
    ],
  },
  {
    id: 'overview',
    name: 'Overall TXT File Structure',
    englishName: 'Overall Test Structure',
    badge: 'Basic',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'The standard skeleton of an IELTS Reading test file: general metadata, three reading passages (Part 1, 2, 3), and question groups.',
    syntax: `[TITLE] <Test title>
[TIME] <Duration in minutes (default 60)>
[CATEGORY] IELTS Academic Reading
[DESC] <Short description of the test (optional)>

=== PART 1 ===
[PASSAGE_TITLE] <Title of Reading Passage 1>
[SUBTITLE] <Subtitle / tagline (optional)>
[PASSAGE]
<Full text of Reading Passage 1...>
[FOOTNOTE] <* Vocabulary footnote (optional)>

--- GROUP: Questions 1–5 ---
[INSTRUCTIONS] <Instructions for this question group>
[TYPE] <Question type name>

1. <Question 1 content...>
[ANSWER] <Correct answer>
[EXPLAIN] <Detailed explanation with cited evidence...>

=== PART 2 ===
[PASSAGE_TITLE] <Title of Reading Passage 2>
[PASSAGE]
<Full text of Reading Passage 2...>

=== PART 3 ===
[PASSAGE_TITLE] <Title of Reading Passage 3>
[PASSAGE]
<Full text of Reading Passage 3...>`,
    example: `[TITLE] CAMBRIDGE 19 - TEST 1 READING
[TIME] 60
[CATEGORY] IELTS Academic Reading
[DESC] Standard IELTS Academic Reading test with answer key and explanations

=== PART 1 ===
[PASSAGE_TITLE] The Secrets of Sleep
[SUBTITLE] How nocturnal rest restores human cognition and physical stamina
[PASSAGE]
Sleep is an essential biological state characterized by suspended consciousness. During deep rest, muscles rebuild and the immune system repairs itself...`,
    tips: [
      'Use === PART 1 ===, === PART 2 ===, === PART 3 === to separate the three reading passages.',
      'Use --- GROUP: Questions X–Y --- to group related questions together.',
      'Each question only needs a line-number prefix (e.g. 1.), followed by [ANSWER] and [EXPLAIN] tags.',
    ],
  },
  {
    id: 'true_false',
    name: '1. True / False / Not Given & Yes / No / Not Given',
    englishName: 'T/F/NG & Y/N/NG',
    badge: 'Very Common',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Statement-verification questions — decide whether each statement agrees with, contradicts, or is not mentioned in the passage. The system auto-renders standard radio buttons matching the real computer-based exam.',
    syntax: `--- GROUP: Questions 1–4 ---
[INSTRUCTIONS] Do the following statements agree with the information given in Reading Passage 1?
Write TRUE if the statement agrees with the information,
FALSE if the statement contradicts the information,
NOT GIVEN if there is no information on this.
[TYPE] TRUE_FALSE_NOT_GIVEN

1. <Statement for question 1>
[ANSWER] TRUE
[EXPLAIN] <Quote from the passage proving the statement is true>

2. <Statement for question 2>
[ANSWER] FALSE
[EXPLAIN] <Quote from the passage proving the statement is false>

3. <Statement for question 3>
[ANSWER] NOT GIVEN
[EXPLAIN] <Explanation that the passage does not mention this information>`,
    example: `--- GROUP: Questions 1–3 ---
[INSTRUCTIONS] Do the following statements agree with the information given in the text?
[TYPE] TRUE_FALSE_NOT_GIVEN

1. All of the baobab species found on Madagascar are native to the island.
[ANSWER] FALSE
[EXPLAIN] Paragraph 1 states: Of the eight known species, six are found only there, while a seventh has made its way across...

2. Adanson and Grandidier were the first foreign botanists to visit Madagascar.
[ANSWER] NOT GIVEN
[EXPLAIN] Paragraph 1 mentions their names but does not state whether they were the first.

3. The landscape around the Avenue des Baobabs is the result of agricultural development.
[ANSWER] TRUE
[EXPLAIN] Paragraph 3: much of the Morondava plain was cleared for rice and sugar-cane fields.`,
    tips: [
      'For YES / NO / NOT GIVEN questions, simply change [TYPE] to YES_NO_NOT_GIVEN and use YES, NO, or NOT GIVEN as answers.',
      'The [EXPLAIN] tag lets learners review specific evidence from the passage after completing the question.',
    ],
  },
  {
    id: 'multiple_choice_single',
    name: '2. Multiple Choice — Single Answer (A, B, C, D)',
    englishName: 'Single Choice (MCQ)',
    badge: 'Basic',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Choose the single most correct answer from four options (A, B, C, D).',
    syntax: `--- GROUP: Questions 5–6 ---
[INSTRUCTIONS] Choose the correct letter, A, B, C or D.
[TYPE] MULTIPLE_CHOICE_SINGLE

5. <Question stem for question 5...>
A. <Option A content>
B. <Option B content>
C. <Option C content>
D. <Option D content>
[ANSWER] B
[EXPLAIN] <Evidence and reasoning for choosing B>`,
    example: `--- GROUP: Questions 5–6 ---
[INSTRUCTIONS] Choose the correct letter, A, B, C or D.
[TYPE] MULTIPLE_CHOICE_SINGLE

5. What does Jared Diamond blame for the lack of vegetation on Easter Island?
A. extreme climatic variations
B. the destructive actions of the settlers
C. severe volcanic activity
D. the introduction of foreign crops
[ANSWER] B
[EXPLAIN] Paragraph 2 states: Diamond believed that the inhabitants accidentally carried out self-destructive deforestation.

6. Why did the early settlers need large timber trees?
A. to construct seaworthy canoes
B. to build fortified stone towers
C. to fuel metallurgy ovens
D. to trade with neighboring islands
[ANSWER] A
[EXPLAIN] Paragraph 3: the local inhabitants needed canoes to go fishing and travel long distances.`,
    tips: [
      'Each option must start with an uppercase letter followed by a period (e.g. A., B., C., D.).',
      'The [ANSWER] tag only needs the single letter: A, B, C, or D.',
    ],
  },
  {
    id: 'multiple_choice_multi',
    name: '3. Multiple Choice — Choose TWO / THREE Answers',
    englishName: 'Multi-Select (Choose 2/3)',
    badge: 'Advanced',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Select 2 or 3 correct answers from a list of 5–7 options (A–E or A–G). Rendered as checkboxes with a maximum-selection limit enforced.',
    syntax: `--- GROUP: Questions 20–21 ---
[INSTRUCTIONS] Choose TWO letters, A-E.
[TYPE] MULTIPLE_CHOICE_MULTI
[MAX_SELECT] 2

20-21. <Question stem requiring two correct answers...>
A. <Option A>
B. <Option B>
C. <Option C>
D. <Option D>
E. <Option E>
[ANSWER] A, C
[EXPLAIN] <Evidence for options A and C from the passage>`,
    example: `--- GROUP: Questions 20–21 ---
[INSTRUCTIONS] Choose TWO letters, A-E.
[TYPE] MULTIPLE_CHOICE_MULTI
[MAX_SELECT] 2

20-21. Which TWO reasons are given for the rapid disappearance of the island palm trees?
A. deliberate forest fires set by hunters
B. excessive gnawing of palm nuts by rats
C. sudden drop in annual rainfall
D. extensive clearing for agricultural farming
E. prolonged volcanic ash deposits
[ANSWER] B, D
[EXPLAIN] Paragraph 4 explains that palm seeds were gnawed by rats and could not germinate (B), and paragraph 2 describes widespread tree-clearing for agriculture (D).`,
    tips: [
      'Use a hyphenated number prefix like 20-21. or 36-37. to auto-generate two consecutive questions sharing the same answer set.',
      'Use [MAX_SELECT] 2 or [MAX_SELECT] 3 to lock the maximum number of checkboxes a learner can select.',
      'Separate answer letters with commas in [ANSWER] (e.g. B, D).',
    ],
  },
  {
    id: 'fill_in_blank',
    name: '4. Sentence / Note / Table Completion (Fill in the Blank)',
    englishName: 'Completion (No Box)',
    badge: 'Very Common',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Type a word or phrase directly from the passage to complete a sentence, table, or summary note (e.g. ONE WORD ONLY / NO MORE THAN TWO WORDS).',
    syntax: `--- GROUP: Questions 7–10 ---
[INSTRUCTIONS] Complete the notes below. Write ONE WORD ONLY from the passage for each answer.
[TYPE] FILL_IN_BLANK

7. <Sentence with a gap indicated by ________ >
[ANSWER] <word_to_fill>
[EXPLAIN] <Quote from the passage containing the answer word>

8. <Next sentence with a gap ________ >
[ANSWER] <answer_1> / <alternative_answer_if_any>
[EXPLAIN] <Supporting evidence...>`,
    example: `--- GROUP: Questions 7–9 ---
[INSTRUCTIONS] Complete the notes below. Choose ONE WORD ONLY from the passage.
[TYPE] FILL_IN_BLANK

7. Baobab trees are valuable to local people as a renewable ________ material.
[ANSWER] building
[EXPLAIN] Paragraph 3: valuable as a food source and renewable building material.

8. Baobabs are unable to cope with constantly ________ soils.
[ANSWER] waterlogged
[EXPLAIN] Paragraph 3: their roots can't cope with constantly waterlogged soils.

9. Scientists measure tree rings to reconstruct past patterns of ________.
[ANSWER] rainfall / precipitation
[EXPLAIN] Paragraph 5: analysis of tree growth rings reveals historical rainfall fluctuations.`,
    tips: [
      'Mark the blank in the sentence with underscores ________.',
      'If the question accepts multiple synonyms or singular/plural variants, separate them with a forward slash / in [ANSWER] (e.g. building / buildings).',
    ],
  },
  {
    id: 'summary_wordbank',
    name: '5. Summary Completion with Word Bank (Choose from Box A–D / A–H)',
    englishName: 'Summary with Word Bank',
    badge: 'Featured',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'A summary paragraph rendered as a single block with interactive drop-down blanks ({{27}}, {{28}}…) paired with a word bank of options A, B, C, D — exactly matching the real computer-based exam interface.',
    syntax: `--- GROUP: Questions 27–30 ---
[INSTRUCTIONS] Complete the summary using the list of words and phrases, A-D, below.
[SUMMARY_TITLE] <Title of the summary paragraph>
[SHARED_CONTENT]
<Full summary paragraph; place {{27}}, {{28}}, {{29}}, {{30}} at each blank position>
[WORD_BANK]
A. <Word / phrase A>
B. <Word / phrase B>
C. <Word / phrase C>
D. <Word / phrase D>

27. [ANSWER] D
[EXPLAIN] <Evidence from the passage matching word D>
28. [ANSWER] A
[EXPLAIN] <Supporting evidence...>
29. [ANSWER] B
[EXPLAIN] <Supporting evidence...>
30. [ANSWER] C
[EXPLAIN] <Supporting evidence...>`,
    example: `--- GROUP: Questions 27–30 ---
[INSTRUCTIONS] Complete the summary using the list of words and phrases, A-D, below.
[SUMMARY_TITLE] Early European reaction to the discovery of Easter Island
[SHARED_CONTENT]
When Dutchman Jacob Roggeveen sailed to Easter Island in 1722, he was amazed by the stone statues he saw for a number of reasons. Firstly, it was clear that they were immensely heavy, and there was no {{27}} around, which would have helped with their construction. Another mystery was the poor quality of the local inhabitants' {{28}}; Roggeveen wondered how the people had managed to survive long trips. At the time of Roggeveen's visit, he observed that the people were living in {{29}} and there was no evidence of successful {{30}} on the island.
[WORD_BANK]
A. poverty
B. agriculture
C. boats
D. wood

27. [ANSWER] D
[EXPLAIN] Paragraph 2: there was no timber or trees on the treeless island to move the statues.
28. [ANSWER] C
[EXPLAIN] Paragraph 3: the local inhabitants only had small, fragile canoes and boats.
29. [ANSWER] A
[EXPLAIN] Paragraph 4: the people were living in extreme misery and poverty.
30. [ANSWER] B
[EXPLAIN] Paragraph 4: no organized farming or agriculture could be seen.`,
    tips: [
      '[SUMMARY_TITLE] creates a bold heading displayed above the summary paragraph.',
      'In [SHARED_CONTENT], write {{question_number}} (e.g. {{27}}) to render a clickable Word Bank blank — 100% matching the real computer-based exam.',
      '[WORD_BANK] lists the hint words/phrases labelled A., B., C., D.',
    ],
  },
  {
    id: 'matching_headings',
    name: '6. Matching Headings (Match Paragraph Headings: i, ii, iii…)',
    englishName: 'List of Headings',
    badge: 'Classic',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Match the most suitable heading from a numbered list (Roman numerals i, ii, iii…) to each paragraph (A, B, C…) of the reading passage.',
    syntax: `--- GROUP: Questions 14–18 ---
[INSTRUCTIONS] Reading Passage 2 has five sections, A-E. Choose the correct heading for each section from the list of headings below.
[TYPE] MATCHING
[HEADINGS]
i. <Heading i content>
ii. <Heading ii content>
iii. <Heading iii content>
iv. <Heading iv content>
v. <Heading v content>
vi. <Heading vi content>

14. Section A
[ANSWER] iii
[EXPLAIN] <Summary of main idea in Section A matching heading iii>

15. Section B
[ANSWER] i
[EXPLAIN] <Main idea evidence for Section B>

16. Section C
[ANSWER] v
[EXPLAIN] <Main idea evidence for Section C>`,
    example: `--- GROUP: Questions 14–17 ---
[INSTRUCTIONS] Reading Passage 2 has four paragraphs, A-D. Choose the correct heading for each paragraph from the list of headings below.
[TYPE] MATCHING
[HEADINGS]
i. Initial skepticism from traditional researchers
ii. The architectural impact on human mental performance
iii. Financial losses attributable to poor indoor quality
iv. Future prospects for biophilic skyscraper designs
v. Biological adaptations of forest animals

14. Paragraph A
[ANSWER] ii
[EXPLAIN] Paragraph A analyses how building environments directly affect cognitive ability and work productivity.

15. Paragraph B
[ANSWER] i
[EXPLAIN] Paragraph B describes the early scepticism from the scientific community when this topic first emerged.

16. Paragraph C
[ANSWER] iii
[EXPLAIN] Paragraph C provides economic loss figures — billions of dollars annually — due to sealed working environments.

17. Paragraph D
[ANSWER] iv
[EXPLAIN] Paragraph D forecasts the future of biophilic skyscraper design.`,
    tips: [
      'Declare the heading list inside the [HEADINGS] block.',
      'Use lowercase Roman numerals: i., ii., iii., iv., v., vi., vii., viii., ix., x.',
      'The [ANSWER] tag takes the corresponding Roman numeral (e.g. [ANSWER] ii).',
    ],
  },
  {
    id: 'matching_features',
    name: '7. Matching Features / Information / People',
    englishName: 'Matching Features / Names',
    badge: 'Common',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'Match statements to a list of researchers, locations, or identify which paragraph contains specific information (e.g. "Which paragraph contains the following information?").',
    syntax: `--- GROUP: Questions 22–25 ---
[INSTRUCTIONS] Look at the following statements (Questions 22-25) and the list of researchers below. Match each statement with the correct researcher, A-D.
[TYPE] MATCHING
[OPTIONS]
A. <Name / label A>
B. <Name / label B>
C. <Name / label C>
D. <Name / label D>

22. <Statement for question 22...>
[ANSWER] B
[EXPLAIN] <Evidence of person/place B's statement or research in the passage>

23. <Statement for question 23...>
[ANSWER] A
[EXPLAIN] <Evidence for person/place A>`,
    example: `--- GROUP: Questions 22–24 ---
[INSTRUCTIONS] Look at the following statements and the list of researchers below. Match each statement with the correct researcher, A-C.
[TYPE] MATCHING
[OPTIONS]
A. Terry Hunt
B. Carl Lipo
C. Jared Diamond

22. Argued that Polynesian rats caused deforestation by gnawing palm seeds.
[ANSWER] A
[EXPLAIN] Paragraph 4: Terry Hunt showed that almost all seed shells discovered were gnawed by rats.

23. Claimed that the island collapse occurred rapidly due to self-induced ecocide.
[ANSWER] C
[EXPLAIN] Paragraph 1: Jared Diamond claimed the islanders brought about their own environmental crash.

24. Conducted engineering models showing statues could be moved vertically.
[ANSWER] B
[EXPLAIN] Paragraph 5: Carl Lipo demonstrated that ropes allowed statues to be rocked forward upright.`,
    tips: [
      'Use the [OPTIONS] tag at the top of the question group to declare the shared list of people/places for all questions in that group.',
      'For "Which paragraph contains the following information?" (A–G) questions, declare: A. Paragraph A, B. Paragraph B… inside [OPTIONS].',
    ],
  },
];

export const SAMPLE_TXT_TEMPLATE = FULL_40_QUESTIONS_TXT_TEMPLATE;

export const SAMPLE_LISTENING_TXT_TEMPLATE = `[TITLE] IELTS Listening Practice Mock 1
[CATEGORY] IELTS Listening
[TIME] 30

=== SECTION 1 ===
[SECTION_TITLE] Customer Accommodation Booking
[AUDIO] /audio/vol9/test1.mp4

--- Questions 1–10 ---
Complete the notes below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

Customer Booking Form
Caller name: Sarah {{1}}
* A. Mitchell
Contact number: {{2}}
* A. 07945 882910
Preferred room type: {{3}}
* A. single
Arrival date: 14th {{4}}
* A. September
Length of stay: {{5}} nights
* A. 3
Breakfast included: {{6}}
* A. Yes
Payment method: by {{7}}
* A. credit card
Vehicle parking required: {{8}}
* A. garage
Special dietary request: {{9}}
* A. vegetarian
Estimated time of arrival: {{10}} PM
* A. 6.30

=== SECTION 2 ===
[SECTION_TITLE] Community Sports Centre
[AUDIO] /audio/vol9/test1.mp4

--- Questions 11–15 ---
Choose the correct letter, A, B or C.

11. When was the fitness centre originally opened?
A. 1995
B. 2005
C. 2015
* B. 2005

12. What is new about the swimming pool?
A. Heated water
B. An Olympic diving board
C. Extended opening hours
* A. Heated water

13. The annual membership fee includes:
A. Free personal trainer sessions
B. Access to all fitness classes
C. Discounts in the sports shop
* B. Access to all fitness classes

14. How can members book squash courts?
A. Only in person
B. Via the mobile app
C. By phone call
* B. Via the mobile app

15. What safety rule must all gym users follow?
A. Wear clean indoor trainers
B. Bring their own towels
C. Complete a medical test
* A. Wear clean indoor trainers

--- Questions 16–20 ---
Complete the sentences below.
Write NO MORE THAN TWO WORDS for each answer.

16. Lockers require a {{16}} to operate.
* A. coin
17. The cafe offers a selection of healthy {{17}} and smoothies.
* A. snacks
18. Children under the age of {{18}} must be supervised at all times.
* A. 12
19. Members receive a free {{19}} assessment every six months.
* A. fitness
20. The outdoor tennis courts are closed during {{20}} weather.
* A. rainy

=== SECTION 3 ===
[SECTION_TITLE] University Research Project on Renewable Energy
[AUDIO] /audio/vol9/test1.mp4

--- Questions 21–25 ---
Choose the correct letter, A, B or C.

21. What surprised Jack about the wind turbine data?
A. How much energy was generated
B. How quickly the components degraded
C. How popular the project was locally
* A. How much energy was generated

22. Emily suggests that their presentation should focus primarily on:
A. The initial financial investment
B. Environmental advantages
C. Future policy recommendations
* B. Environmental advantages

23. Why did they decide not to include solar power comparisons?
A. The data was unreliable
B. It was outside the research scope
C. Another group was already studying it
* C. Another group was already studying it

24. What problem did they encounter with the software simulator?
A. It was too complex to configure
B. Frequent system crashes
C. It gave inaccurate projections
* B. Frequent system crashes

25. The tutor recommended that they:
A. Interview local residents
B. Re-check their statistical calculations
C. Shorten their visual slides
* B. Re-check their statistical calculations

--- Questions 26–30 ---
Where can each type of data be found in the report?
Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 26–30.

[OPTIONS]
A. Section 1 (Introduction)
B. Section 2 (Literature Review)
C. Section 3 (Methodology)
D. Section 4 (Data Analysis)
E. Section 5 (Discussion)
F. Section 6 (Conclusion)
G. Appendix

26. Historical background on wind farms
* B. Section 2 (Literature Review)
27. Raw hourly electricity output figures
* G. Appendix
28. Mathematical formulas used for modeling
* C. Section 3 (Methodology)
29. Limitations of the current study
* E. Section 5 (Discussion)
30. Actionable proposals for local governments
* F. Section 6 (Conclusion)

=== SECTION 4 ===
[SECTION_TITLE] Academic Lecture: Ancient Irrigation Systems
[AUDIO] /audio/vol9/test1.mp4

--- Questions 31–40 ---
Complete the lecture notes below.
Write NO MORE THAN TWO WORDS for each answer.

Ancient Water Management
Early civilisations relied heavily on rivers for {{31}} and agriculture.
* A. survival
In Mesopotamia, farmers dug a network of {{32}} to divert river water.
* A. canals
Silt buildup was a major challenge requiring regular {{33}} work.
* A. maintenance
The Shaduf was an ancient lever device invented to lift water into {{34}} fields.
* A. terraced
In Egypt, the annual flooding of the Nile provided fertile {{35}} for crops.
* A. soil
Ancient Persian engineers invented underground aqueducts known as {{36}}.
* A. qanats
These tunnels prevented water loss through {{37}} in arid climates.
* A. evaporation
Gravity was utilized to transport water across long {{38}} underground.
* A. distances
The Romans perfected the arch structure to build towering {{39}} above valleys.
* A. aqueducts
Modern engineers continue to study these ancient designs to improve water {{40}} today.
* A. sustainability
`;

/**
 * Official IELTS Writing Template (Task 1 + Task 2)
 */
export const SAMPLE_WRITING_TXT_TEMPLATE = `[TITLE] Cambridge 19 - Practice Test 1 Writing
[COLLECTION] Cambridge 19
[TIME] 60

=== TASK 1 ===
[TITLE] Academic Task 1: Renewable Electricity Generation
[CHART_TYPE] bar
[PROMPT]
The chart below shows the percentage of electricity generated from renewable sources in four European countries between 2010 and 2020.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.
Write at least 150 words.

[SAMPLE_ANSWER]
The bar chart compares the proportion of renewable electricity generation in Germany, Spain, the United Kingdom, and Norway across a ten-year period from 2010 to 2020.

Overall, all four European nations experienced an upward trajectory in green electricity production, with Norway maintaining a dominant leadership position throughout the decade. Conversely, the United Kingdom recorded the most accelerated rate of expansion.

Starting with Norway, renewable generation accounted for roughly 85% of its total output in 2010, steadily increasing to reach nearly 95% by 2020. In contrast, Germany and Spain exhibited comparable growth trends; Germany progressed from approximately 18% in 2010 to just over 40% in 2020, while Spain climbed from 22% to roughly 38% over the same timeline.

Finally, the United Kingdom began with the lowest baseline at approximately 7% in 2010. However, spurred by substantial offshore wind investments, its share expanded dramatically to exceed 35% by the end of the period, thereby approaching parity with Spain.

=== TASK 2 ===
[TITLE] Academic Task 2: Artificial Intelligence and Employment
[PROMPT]
Some people believe that artificial intelligence and automation will eliminate most conventional jobs, resulting in widespread unemployment. Others contend that technology creates new career opportunities and elevates human productivity.

Discuss both views and give your own personal opinion.
Give reasons for your answer and include relevant examples from your knowledge or experience.
Write at least 250 words.

[SAMPLE_ANSWER]
The meteoric advancement of artificial intelligence (AI) and automated systems has ignited fierce debate concerning the future trajectory of the global workforce. While skeptics argue that automation poses an existential threat to employment, proponents maintain that it will stimulate innovation and generate higher-value occupations. In my estimation, although short-term workforce displacement is unavoidable, AI will ultimately foster new economic sectors and redefine productivity.

On the one hand, apprehensions regarding job obsolescence are substantiated by historical precedents and contemporary trends. Routine, rule-based occupations across manufacturing, logistics, and data entry are increasingly outsourced to algorithmic systems. For instance, automated sorting centers and self-service kiosks have already diminished the demand for manual warehousing staff and retail cashiers. Without proactive reskilling programs, displaced workers face considerable hurdles in transitioning to emerging technological niches.

On the other hand, technological revolutions have consistently functioned as catalysts for employment creation. While obsolete roles vanish, novel domains requiring creative problem-solving, emotional intelligence, and complex decision-making emerge. The proliferation of AI has generated unprecedented demand for machine learning engineers, data ethicists, cybersecurity specialists, and human-AI interaction designers. Furthermore, automation liberates human professionals from repetitive tasks, enabling them to focus on strategic thinking and innovation.

In conclusion, while the transition to an automated society presents profound socio-economic challenges that necessitate governmental intervention and lifelong learning initiatives, I believe that artificial intelligence will ultimately elevate human prosperity rather than extinguish the labor market.
`;

/**
 * Full syntax specification covering IELTS Writing TXT Format
 */
export const FULL_WRITING_PATTERN_SPEC = `================================================================================
IELTS WRITING TXT SPECIFICATION GUIDE (TASK 1 & TASK 2)
================================================================================
Structure your IELTS Writing test with standard tags to enable instant parsing,
word-count targets, visual chart configuration, and Band 8.5+ model essay storage.

I. HEADER TAGS:
--------------------------------------------------------------------------------
[TITLE] <Exam Name - e.g., Cambridge 19 - Test 1 Writing>
[COLLECTION] <Collection Name - e.g., Cambridge 19, My Tests>
[TIME] 60

II. TASK 1 FORMAT (VISUAL DATA REPORT - 150 WORDS / 20 MINS):
--------------------------------------------------------------------------------
=== TASK 1 ===
[TITLE] <Task 1 Subtitle - e.g., Task 1: European Energy Production>
[CHART_TYPE] <bar | line | pie | table | map | process | none>
[IMAGE] </images/filename.png or https://image-url (optional)>
[PROMPT]
<Full Task 1 prompt and prompt instructions...>

[SAMPLE_ANSWER]
<Band 8.5+ model answer for Task 1...>

III. TASK 2 FORMAT (DISCURSIVE ESSAY - 250 WORDS / 40 MINS):
--------------------------------------------------------------------------------
=== TASK 2 ===
[TITLE] <Task 2 Subtitle - e.g., Task 2: Artificial Intelligence>
[PROMPT]
<Full Task 2 prompt questions and instructions...>

[SAMPLE_ANSWER]
<Band 8.5+ model essay for Task 2...>
`;

/**
 * Official IELTS Speaking Template (Parts 1, 2, 3)
 */
export const SAMPLE_SPEAKING_TXT_TEMPLATE = `[TITLE] Cambridge 19 - Practice Test 1 Speaking
[COLLECTION] Cambridge 19
[DESC] Comprehensive Speaking Practice Test with Part 1 Interview, Part 2 Cue Card & Timer, and Part 3 Two-Way Discussion.

=== PART 1 ===
[TOPIC] Daily Routine & Time Management
Q: What does your typical morning routine look like?
A: On weekdays, I generally wake up around 6:30 AM, drink a warm cup of green tea, and outline my key priorities for the day before heading out to work.

Q: Do you prefer having a structured daily schedule or being spontaneous?
A: I tend to prefer a structured regimen because it keeps me organized and productive, although I always leave some flexibility on weekends to recharge and socialize.

Q: How do you manage your time when you have multiple competing deadlines?
A: I prioritize tasks using an urgent-versus-important matrix. Breaking large tasks into smaller, manageable chunks prevents me from feeling overwhelmed.

=== PART 2 ===
[TOPIC] Technology in Everyday Life
[CUE_CARD] Describe a piece of technology you find particularly useful in your daily routine.
[BULLETS]
- What the technology is
- How often and when you use it
- What you use it for
- Explain why it is so essential to your everyday life
[SAMPLE_ANSWER]
I would like to talk about my noise-cancelling wireless headphones, which have essentially become an indispensable part of my day-to-day life.

I purchased them roughly eighteen months ago, and I use them on a daily basis—especially during my morning commute on crowded public transit, and while working in busy shared offices.

Their primary utility is dual-faceted: first, they deliver crystal-clear audio fidelity for listening to podcasts, lectures, and classical music. More crucially, the active noise cancellation creates an instantaneous bubble of tranquility, eliminating background distractions and ambient chatter.

This device is essential to me because it allows me to maintain deep concentration in noisy environments, which significantly boosts my academic and professional productivity.

=== PART 3 ===
[TOPIC] Impact of Modern Technology on Society
Q: How has digital technology altered the way people communicate with family and friends?
A: It has undeniably bridged geographical chasms, enabling real-time video calls and continuous messaging. On the flip side, some argue that digital exchanges lack the emotional intimacy and non-verbal nuances of face-to-face interaction.

Q: Do you believe future generations will rely too heavily on automated devices?
A: There is certainly a risk of cognitive complacency if people depend on algorithms for basic calculations or critical judgment. However, if regulated responsibly, automation frees humans to cultivate creativity and higher-order skills.

Q: What role does technology play in contemporary classroom education?
A: It transforms conventional passive learning into an interactive multimedia experience. Students can access global academic databases and simulate complex laboratory experiments directly from their screens.
`;

/**
 * Full syntax specification covering IELTS Speaking TXT Format
 */
export const FULL_SPEAKING_PATTERN_SPEC = `================================================================================
IELTS SPEAKING TXT SPECIFICATION GUIDE (PARTS 1, 2 & 3)
================================================================================
Structure your IELTS Speaking test with clear sections for interview questions,
cue cards with bullet points and prep timers, and abstract Part 3 discussions.

I. HEADER TAGS:
--------------------------------------------------------------------------------
[TITLE] <Exam Name - e.g., Cambridge 19 - Test 1 Speaking>
[COLLECTION] <Collection Name - e.g., Cambridge 19, My Tests>
[DESC] <Short overview of topics covered in this test>

II. PART 1 (INTERVIEW QUESTIONS - 4-5 MINS):
--------------------------------------------------------------------------------
=== PART 1 ===
[TOPIC] <Part 1 Topic Name - e.g., Hometown, Hobbies, Work>
Q: <Question text>
A: <Band 8.0+ Model Answer>
Q: <Question text>
A: <Band 8.0+ Model Answer>

III. PART 2 (INDIVIDUAL LONG TURN / CUE CARD - 3-4 MINS):
--------------------------------------------------------------------------------
=== PART 2 ===
[TOPIC] <Cue Card Topic>
[CUE_CARD] <Describe a person / place / object / event...>
[BULLETS]
- <Bullet point 1: You should say: what it is>
- <Bullet point 2: where it happened>
- <Bullet point 3: who you were with>
- <Bullet point 4: and explain how you felt about it>
[SAMPLE_ANSWER]
<Band 8.0+ Model Speech (1-2 minutes spoken content)...>

IV. PART 3 (TWO-WAY DISCUSSION - 4-5 MINS):
--------------------------------------------------------------------------------
=== PART 3 ===
[TOPIC] <In-depth Discussion Topic>
Q: <Abstract discussion question>
A: <Band 8.0+ Model Answer>
Q: <Abstract discussion question>
A: <Band 8.0+ Model Answer>
`;

/**
 * Parse IELTS Writing raw text into WritingExam structure
 */
export function parseWritingText(rawText: string): { exam: WritingExam; warning?: string } {
  const sanitized = (rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ');

  const lines = sanitized.split(/\r?\n/).map((l) => l.trim());

  let title = 'Custom IELTS Writing Test';
  let collection = 'My Tests';
  let durationMinutes = 60;

  let currentTask: 1 | 2 | null = null;
  let currentMode: 'prompt' | 'sample' | 'none' = 'none';

  let task1Title = 'Task 1: Academic Report';
  const task1PromptLines: string[] = [];
  const task1SampleLines: string[] = [];
  let task1ChartType: any = 'bar';
  let task1ImageUrl = '';

  let task2Title = 'Task 2: Discursive Essay';
  const task2PromptLines: string[] = [];
  const task2SampleLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith('[TITLE]')) {
      const val = line.replace('[TITLE]', '').trim();
      if (currentTask === 1) task1Title = val;
      else if (currentTask === 2) task2Title = val;
      else title = val;
      continue;
    }

    if (line.startsWith('[COLLECTION]')) {
      collection = line.replace('[COLLECTION]', '').trim();
      continue;
    }

    if (line.startsWith('[TIME]')) {
      const t = parseInt(line.replace('[TIME]', '').trim(), 10);
      if (!isNaN(t) && t > 0) durationMinutes = t;
      continue;
    }

    if (/^===\s*TASK\s*1\s*===/i.test(line)) {
      currentTask = 1;
      currentMode = 'none';
      continue;
    }

    if (/^===\s*TASK\s*2\s*===/i.test(line)) {
      currentTask = 2;
      currentMode = 'none';
      continue;
    }

    if (line.startsWith('[CHART_TYPE]')) {
      const ct = line.replace('[CHART_TYPE]', '').trim().toLowerCase();
      if (['bar', 'line', 'pie', 'table', 'map', 'process', 'none'].includes(ct)) {
        task1ChartType = ct;
      }
      continue;
    }

    if (line.startsWith('[IMAGE]')) {
      task1ImageUrl = line.replace('[IMAGE]', '').trim();
      continue;
    }

    if (line.startsWith('[PROMPT]')) {
      currentMode = 'prompt';
      continue;
    }

    if (line.startsWith('[SAMPLE_ANSWER]')) {
      currentMode = 'sample';
      continue;
    }

    if (currentMode === 'prompt') {
      if (currentTask === 1) task1PromptLines.push(line);
      else if (currentTask === 2) task2PromptLines.push(line);
    } else if (currentMode === 'sample') {
      if (currentTask === 1) task1SampleLines.push(line);
      else if (currentTask === 2) task2SampleLines.push(line);
    }
  }

  const id = 'writing_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const exam: WritingExam = {
    id,
    title: title || 'Custom IELTS Writing Test',
    collection: collection || 'My Tests',
    durationMinutes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    task1: {
      id: `${id}_task1`,
      taskNumber: 1,
      title: task1Title,
      recommendedMinutes: 20,
      prompt: task1PromptLines.join('\n').trim() || 'Write a report summarizing the information.',
      minWords: 150,
      chartType: task1ChartType,
      imageUrl: task1ImageUrl || undefined,
      sampleAnswer: task1SampleLines.join('\n').trim() || undefined,
    },
    task2: {
      id: `${id}_task2`,
      taskNumber: 2,
      title: task2Title,
      recommendedMinutes: 40,
      prompt: task2PromptLines.join('\n').trim() || 'Discuss both views and give your opinion.',
      minWords: 250,
      chartType: 'none',
      sampleAnswer: task2SampleLines.join('\n').trim() || undefined,
    },
  };

  return { exam };
}

/**
 * Parse IELTS Speaking raw text into SpeakingExam structure
 */
export interface SpeakingParseError {
  line: number;
  message: string;
}

export type SpeakingParseResult =
  | { exam: SpeakingExam; errors: [] }
  | { exam?: never; errors: SpeakingParseError[] };

export function parseSpeakingText(rawText: string): SpeakingParseResult {
  const sanitized = (rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ');

  const lines = sanitized.split(/\r?\n/).map((line) => line.trim());
  const errors: SpeakingParseError[] = [];
  const addError = (line: number, message: string) => errors.push({ line, message });

  let title = '';
  let collection = '';
  let description = '';
  const headerLines = new Map<string, number>();
  const partLines = new Map<1 | 2 | 3, number>();
  const topics = new Map<1 | 2 | 3, string>();
  let currentPart: 1 | 2 | 3 | null = null;
  let currentMode: 'bullets' | 'sample' | 'none' = 'none';

  const part1Questions: SpeakingQuestion[] = [];
  let part2CueCard = '';
  const part2Bullets: string[] = [];
  const part2SampleLines: string[] = [];
  const part3Questions: SpeakingQuestion[] = [];
  const id = 'speaking_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  let pendingQuestion: { part: 1 | 3; question: string; line: number; answerLines: string[] | null } | null = null;

  const finishPendingQuestion = (line: number) => {
    if (!pendingQuestion) return;
    const answer = pendingQuestion.answerLines?.join('\n').trim() ?? '';
    if (!answer) {
      addError(pendingQuestion.line, `Part ${pendingQuestion.part} question is missing an A: model answer.`);
    } else {
      const target = pendingQuestion.part === 1 ? part1Questions : part3Questions;
      target.push({
        id: `${id}_p${pendingQuestion.part}_${target.length + 1}`,
        part: pendingQuestion.part,
        topic: topics.get(pendingQuestion.part) || '',
        questionText: pendingQuestion.question,
        sampleAnswer: answer,
      });
    }
    pendingQuestion = null;
    void line;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNumber = i + 1;

    const partMatch = line.match(/^===\s*PART\s*([123])\s*===$/i);
    if (partMatch) {
      finishPendingQuestion(lineNumber);
      const part = Number(partMatch[1]!) as 1 | 2 | 3;
      if (partLines.has(part)) {
        addError(lineNumber, `PART ${part} is declared more than once.`);
      } else {
        partLines.set(part, lineNumber);
      }
      currentPart = part;
      currentMode = 'none';
      continue;
    }

    const header = line.match(/^\[(TITLE|COLLECTION|DESC)\](.*)$/i);
    if (header) {
      finishPendingQuestion(lineNumber);
      const tag = header[1]!.toUpperCase();
      const value = (header[2] || '').trim();
      if (currentPart) addError(lineNumber, `[${tag}] must appear before PART 1.`);
      if (headerLines.has(tag)) addError(lineNumber, `[${tag}] is declared more than once.`);
      headerLines.set(tag, lineNumber);
      if (!value) addError(lineNumber, `[${tag}] cannot be empty.`);
      if (tag === 'TITLE') title = value;
      if (tag === 'COLLECTION') collection = value;
      if (tag === 'DESC') description = value;
      continue;
    }

    if (!line) {
      if (pendingQuestion?.answerLines) pendingQuestion.answerLines.push('');
      else if (currentPart === 2 && currentMode === 'sample') part2SampleLines.push('');
      continue;
    }

    if (!currentPart) {
      addError(lineNumber, 'Content must appear after the required PART heading.');
      continue;
    }

    if (line.startsWith('[TOPIC]')) {
      finishPendingQuestion(lineNumber);
      const topic = line.replace('[TOPIC]', '').trim();
      if (topics.has(currentPart)) addError(lineNumber, `PART ${currentPart} has more than one [TOPIC] tag.`);
      if (!topic) addError(lineNumber, `[TOPIC] in PART ${currentPart} cannot be empty.`);
      topics.set(currentPart, topic);
      currentMode = 'none';
      continue;
    }

    if (currentPart === 1 || currentPart === 3) {
      if (/^(?:Q:|\d+[.)])/i.test(line)) {
        finishPendingQuestion(lineNumber);
        const question = line.replace(/^(?:Q:|\d+[.)])/i, '').trim();
        if (!question) addError(lineNumber, 'Question text cannot be empty.');
        pendingQuestion = { part: currentPart, question, line: lineNumber, answerLines: null };
      } else if (/^A:/i.test(line)) {
        if (!pendingQuestion) {
          addError(lineNumber, 'A: must directly follow a Part 1 or Part 3 question.');
        } else if (pendingQuestion.answerLines) {
          addError(lineNumber, 'Each question may have only one A: model answer marker.');
        } else {
          const answer = line.replace(/^A:/i, '').trim();
          if (!answer) addError(lineNumber, 'Model answer text cannot be empty.');
          pendingQuestion.answerLines = answer ? [answer] : [];
        }
      } else if (pendingQuestion?.answerLines) {
        pendingQuestion.answerLines.push(line);
      } else {
        addError(lineNumber, 'Expected Q: followed by A: in this section.');
      }
      continue;
    }

    // PART 2
    if (line.startsWith('[CUE_CARD]')) {
      const cueCard = line.replace('[CUE_CARD]', '').trim();
      if (part2CueCard) addError(lineNumber, 'PART 2 has more than one [CUE_CARD] tag.');
      if (!cueCard) addError(lineNumber, '[CUE_CARD] cannot be empty.');
      part2CueCard = cueCard;
      currentMode = 'none';
    } else if (line === '[BULLETS]') {
      if (currentMode === 'bullets' || part2Bullets.length > 0) addError(lineNumber, 'PART 2 has more than one [BULLETS] tag.');
      currentMode = 'bullets';
    } else if (line === '[SAMPLE_ANSWER]') {
      if (currentMode === 'sample' || part2SampleLines.length > 0) addError(lineNumber, 'PART 2 has more than one [SAMPLE_ANSWER] tag.');
      currentMode = 'sample';
    } else if (currentMode === 'bullets') {
      if (/^[-*]\s+/.test(line)) {
        part2Bullets.push(line.replace(/^[-*]\s+/, '').trim());
      } else {
        addError(lineNumber, 'Each entry after [BULLETS] must start with - or *.');
      }
    } else if (currentMode === 'sample') {
      part2SampleLines.push(line);
    } else {
      addError(lineNumber, 'Expected [CUE_CARD], [BULLETS], or [SAMPLE_ANSWER] in PART 2.');
    }
  }

  finishPendingQuestion(lines.length + 1);

  for (const tag of ['TITLE', 'COLLECTION', 'DESC']) {
    if (!headerLines.has(tag)) addError(1, `Missing required [${tag}] header.`);
  }
  for (const part of [1, 2, 3] as const) {
    if (!partLines.has(part)) addError(1, `Missing required === PART ${part} === section.`);
    if (!topics.get(part)) addError(partLines.get(part) ?? 1, `PART ${part} requires a non-empty [TOPIC] tag.`);
  }
  if (part1Questions.length === 0) addError(partLines.get(1) ?? 1, 'PART 1 requires at least one complete Q: / A: pair.');
  if (!part2CueCard) addError(partLines.get(2) ?? 1, 'PART 2 requires a non-empty [CUE_CARD].');
  if (part2Bullets.length !== 4) addError(partLines.get(2) ?? 1, `PART 2 requires exactly 4 cue-card bullets; found ${part2Bullets.length}.`);
  if (!part2SampleLines.join('\n').trim()) addError(partLines.get(2) ?? 1, 'PART 2 requires a non-empty [SAMPLE_ANSWER].');
  if (part3Questions.length === 0) addError(partLines.get(3) ?? 1, 'PART 3 requires at least one complete Q: / A: pair.');

  if (errors.length > 0) return { errors };

  const exam: SpeakingExam = {
    id,
    title,
    collection,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    part1Questions,
    part2Question: {
      id: `${id}_p2_1`,
      part: 2,
      topic: topics.get(2)!,
      questionText: part2CueCard,
      cueCardBullets: part2Bullets,
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
      sampleAnswer: part2SampleLines.join('\n').trim(),
    },
    part3Questions,
  };

  return { exam, errors: [] };
}

