/**
 * scripts/verify_exams.mjs
 * ========================
 * Automated programmatic verification script for Cambridge 15–21 practice tests.
 * Validates:
 * 1. File presence and valid JSON syntax for imported_exams.json and imported_listening_exams.json.
 * 2. Complete Cambridge 15–21 coverage (28 Reading tests, 28 Listening tests, 56 tests total).
 * 3. Schema conformity against Exam type in src/types/exam.ts.
 * 4. Completeness: exactly 40 questions (orderNumber 1..40 sequentially) per test, valid types, answers, explanations.
 * 5. Audio URLs: all Listening parts must contain valid http/https audio streaming URLs.
 * 6. Storage & Collections: defaultCollections must have Cambridge 15–21 and 0 legacy Vol 1–10 collections.
 * 7. Zero residual Vol 1–10 exams in imported data or sampleExam.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VALID_QUESTION_TYPES = new Set([
  'TRUE_FALSE_NOT_GIVEN',
  'YES_NO_NOT_GIVEN',
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTI',
  'FILL_IN_BLANK',
  'MATCHING'
]);

const REQUIRED_EDITIONS = [15, 16, 17, 18, 19, 20, 21];

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const errors = [];

function assert(condition, message, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
  } else {
    failedChecks++;
    errors.push({ message, details });
    console.error(`  ❌ [FAIL] ${message} ${details ? `(${details})` : ''}`);
  }
}

console.log('='.repeat(70));
console.log('PROGRAMMATIC VERIFICATION: Cambridge 15–21 Exams & Collections');
console.log('='.repeat(70));

// ─────────────────────────────────────────────────────────────────────────────
// 1. File Presence & JSON Syntax Validation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1/5] Validating Data File Presence & JSON Syntax...');

const readingPath = path.join(projectRoot, 'apps', 'next', 'src', 'modules', 'ielts', 'data', 'imported_exams.json');
const listeningPath = path.join(projectRoot, 'apps', 'next', 'src', 'modules', 'ielts', 'data', 'imported_listening_exams.json');

assert(fs.existsSync(readingPath), 'Reading exams data file exists', readingPath);
assert(fs.existsSync(listeningPath), 'Listening exams data file exists', listeningPath);

let readingExams = [];
let listeningExams = [];

try {
  const rawReading = fs.readFileSync(readingPath, 'utf8');
  readingExams = JSON.parse(rawReading);
  assert(Array.isArray(readingExams), 'Reading exams parsed as JSON array', `Count: ${readingExams.length}`);
} catch (e) {
  assert(false, 'Reading exams file contains valid JSON', e.message);
}

try {
  const rawListening = fs.readFileSync(listeningPath, 'utf8');
  listeningExams = JSON.parse(rawListening);
  assert(Array.isArray(listeningExams), 'Listening exams parsed as JSON array', `Count: ${listeningExams.length}`);
} catch (e) {
  assert(false, 'Listening exams file contains valid JSON', e.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cambridge 15–21 Edition Coverage & Zero Legacy Vols
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2/5] Validating Cambridge 15–21 Coverage & Zero Vol 1–10 Tests...');

assert(readingExams.length === 28, 'Exactly 28 Reading exams present', `Found: ${readingExams.length}`);
assert(listeningExams.length === 28, 'Exactly 28 Listening exams present', `Found: ${listeningExams.length}`);

for (const ed of REQUIRED_EDITIONS) {
  const edStr = `Cambridge ${ed}`;
  const rCount = readingExams.filter(e => e.collection === edStr).length;
  const lCount = listeningExams.filter(e => e.collection === edStr).length;

  assert(rCount === 4, `Reading has exactly 4 tests for ${edStr}`, `Found: ${rCount}`);
  assert(lCount === 4, `Listening has exactly 4 tests for ${edStr}`, `Found: ${lCount}`);
}

const legacyVolReading = readingExams.filter(e => /vol\s*\d+/i.test(e.title) || /vol\s*\d+/i.test(e.collection || ''));
const legacyVolListening = listeningExams.filter(e => /vol\s*\d+/i.test(e.title) || /vol\s*\d+/i.test(e.collection || ''));

assert(legacyVolReading.length === 0, 'Zero residual Vol 1–10 tests in Reading data', `Found: ${legacyVolReading.length}`);
assert(legacyVolListening.length === 0, 'Zero residual Vol 1–10 tests in Listening data', `Found: ${legacyVolListening.length}`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Schema & Completeness: Reading Exams (3 parts, 40 questions, answers, explanations)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3/5] Validating Reading Exams Schema, Completeness & Question Integrity...');

let totalReadingQuestions = 0;

for (const exam of readingExams) {
  const context = `Reading Exam "${exam.id}"`;

  assert(exam.id && typeof exam.id === 'string', `${context}: valid string id`);
  assert(exam.title && typeof exam.title === 'string', `${context}: valid title`);
  assert(exam.durationMinutes === 60, `${context}: durationMinutes is 60`);
  assert(exam.category === 'IELTS Academic Reading', `${context}: category is 'IELTS Academic Reading'`);
  assert(exam.isBuiltin === true, `${context}: isBuiltin is true`);
  assert(Array.isArray(exam.parts) && exam.parts.length === 3, `${context}: exactly 3 parts present`);

  const allQuestions = [];

  for (let pIdx = 0; pIdx < (exam.parts || []).length; pIdx++) {
    const part = exam.parts[pIdx];
    const pNum = pIdx + 1;
    const pContext = `${context} Part ${pNum}`;

    assert(part.partNumber === pNum, `${pContext}: partNumber is ${pNum}`);
    assert(part.title && typeof part.title === 'string', `${pContext}: non-empty title`);
    assert(part.passage && typeof part.passage === 'string' && part.passage.length > 50, `${pContext}: passage text present (>50 chars)`);
    assert(Array.isArray(part.questionGroups) && part.questionGroups.length > 0, `${pContext}: has question groups`);

    for (const qg of (part.questionGroups || [])) {
      assert(qg.id && typeof qg.id === 'string', `${pContext} QG ${qg.id}: valid id`);
      assert(qg.instructions && typeof qg.instructions === 'string', `${pContext} QG ${qg.id}: valid instructions`);
      assert(Array.isArray(qg.questions) && qg.questions.length > 0, `${pContext} QG ${qg.id}: questions array non-empty`);

      // Verify sharedContent placeholders have zero duplicates
      if (qg.sharedContent) {
        const tokens = (qg.sharedContent.match(/\{\{\s*(\d+)\s*\}\}/g) || []).map(t => t.replace(/\D/g, ''));
        const tokenCounts = {};
        for (const t of tokens) {
          tokenCounts[t] = (tokenCounts[t] || 0) + 1;
        }
        const dupes = Object.entries(tokenCounts).filter(([_, c]) => c > 1);
        assert(dupes.length === 0, `${pContext} QG ${qg.id}: zero duplicate placeholders in sharedContent`, `Duplicates: ${dupes.map(([k, c]) => `{{${k}}} (x${c})`).join(', ')}`);
      }

      for (const q of (qg.questions || [])) {
        allQuestions.push(q);
        assert(VALID_QUESTION_TYPES.has(q.type), `${context} Q${q.orderNumber}: valid type "${q.type}"`);
        assert(q.prompt && typeof q.prompt === 'string' && q.prompt.trim().length > 0, `${context} Q${q.orderNumber}: non-empty prompt`);
        assert(q.correctAnswer !== undefined && q.correctAnswer !== '' && q.correctAnswer !== null && q.correctAnswer !== 'Not Found', `${context} Q${q.orderNumber}: valid correctAnswer (not 'Not Found')`);
        assert(q.explanation && typeof q.explanation === 'string' && q.explanation.trim().length > 0 && !q.explanation.includes("'Not Found'"), `${context} Q${q.orderNumber}: genuine explanation (no 'Not Found')`);

        const normAns = String(q.correctAnswer || '').trim().toUpperCase();
        assert(normAns !== 'N0', `${context} Q${q.orderNumber}: answer must not contain 'N0' typo`);
        assert(normAns !== 'NOTGIVEN', `${context} Q${q.orderNumber}: answer must not contain 'NOTGIVEN' typo`);

        if (q.type === 'FILL_IN_BLANK') {
          assert(!q.options || q.options.length === 0, `${context} Q${q.orderNumber}: FILL_IN_BLANK must not have options`);
        } else if (q.type === 'MULTIPLE_CHOICE_SINGLE') {
          const optIds = (q.options || []).map(o => o.id);
          assert(optIds.includes(String(q.correctAnswer).trim()), `${context} Q${q.orderNumber}: MC answer '${q.correctAnswer}' must be in options [${optIds.join(', ')}]`);
        } else if (q.type === 'MULTIPLE_CHOICE_MULTI') {
          const optIds = (q.options || []).map(o => o.id);
          const ansArray = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
          for (const a of ansArray) {
            assert(optIds.includes(String(a).trim()), `${context} Q${q.orderNumber}: MC Multi answer '${a}' must be in options [${optIds.join(', ')}]`);
          }
        } else if (q.type === 'MATCHING') {
          const optIds = (q.options || []).map(o => o.id.toLowerCase());
          const wbIds = (qg.wordBank || []).map(o => o.id.toLowerCase());
          const allIds = new Set([...optIds, ...wbIds]);
          const aNorm = String(q.correctAnswer).trim().toLowerCase();
          assert(allIds.has(aNorm), `${context} Q${q.orderNumber}: MATCHING answer '${q.correctAnswer}' must be in options or wordBank [${[...allIds].join(', ')}]`);
        }

        // Question type semantic assertions
        if (normAns === 'TRUE' || normAns === 'FALSE') {
          assert(q.type === 'TRUE_FALSE_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is ${normAns} so type must be TRUE_FALSE_NOT_GIVEN`, `Found: ${q.type}`);
          assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'TRUE') && q.options.some(o => o.id === 'FALSE') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for TRUE_FALSE_NOT_GIVEN`);
        } else if (normAns === 'YES' || normAns === 'NO') {
          assert(q.type === 'YES_NO_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is ${normAns} so type must be YES_NO_NOT_GIVEN`, `Found: ${q.type}`);
          assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'YES') && q.options.some(o => o.id === 'NO') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for YES_NO_NOT_GIVEN`);
        } else if (normAns === 'NOT GIVEN') {
          const groupAnswers = (qg.questions || []).map(x => String(x.correctAnswer || '').trim().toUpperCase());
          const hasSiblingYn = groupAnswers.some(a => a === 'YES' || a === 'NO');
          const hasSiblingTf = groupAnswers.some(a => a === 'TRUE' || a === 'FALSE');
          const isYnGroup = hasSiblingYn || (!hasSiblingTf && /\bYES\b/.test(qg.instructions.toUpperCase()));

          if (isYnGroup) {
            assert(q.type === 'YES_NO_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is NOT GIVEN in YES/NO group so type must be YES_NO_NOT_GIVEN`, `Found: ${q.type}`);
            assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'YES') && q.options.some(o => o.id === 'NO') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for YES_NO_NOT_GIVEN`);
          } else {
            assert(q.type === 'TRUE_FALSE_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is NOT GIVEN in TRUE/FALSE group so type must be TRUE_FALSE_NOT_GIVEN`, `Found: ${q.type}`);
            assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'TRUE') && q.options.some(o => o.id === 'FALSE') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for TRUE_FALSE_NOT_GIVEN`);
          }
        }

        // Prompt quality assertion: generic prompt prohibited unless sharedContent has placeholder
        if (/^Question\s+\d+$/i.test(q.prompt.trim())) {
          const hasScPlaceholder = Boolean(qg.sharedContent && qg.sharedContent.includes(`{{${q.orderNumber}}}`));
          assert(hasScPlaceholder, `${context} Q${q.orderNumber}: generic prompt is not allowed without sharedContent placeholder`);
        }

        if (q.type === 'MATCHING') {
          assert(Array.isArray(q.options) && q.options.length >= 2, `${context} Q${q.orderNumber}: MATCHING type must have at least 2 options`, `Found: ${q.options ? q.options.length : 0}`);
        } else if (['MULTIPLE_CHOICE_SINGLE', 'MULTIPLE_CHOICE_MULTI'].includes(q.type)) {
          assert(Array.isArray(q.options) && q.options.length >= 2, `${context} Q${q.orderNumber}: MC question must have at least 2 options`, `Found: ${q.options ? q.options.length : 0}`);
        }
      }
    }
  }

  totalReadingQuestions += allQuestions.length;
  assert(allQuestions.length === 40, `${context}: exactly 40 questions present`, `Found: ${allQuestions.length}`);

  const orderNumbers = allQuestions.map(q => q.orderNumber).sort((a, b) => a - b);
  const expectedOrders = Array.from({ length: 40 }, (_, i) => i + 1);
  const ordersMatch = JSON.stringify(orderNumbers) === JSON.stringify(expectedOrders);
  assert(ordersMatch, `${context}: orderNumbers are strictly sequential 1..40`, `Mismatch: ${orderNumbers.slice(0, 5)}...`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Schema & Completeness: Listening Exams (4 parts, 40 questions, direct audio, transcripts)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4/5] Validating Listening Exams Schema, Audio URLs & Transcripts...');

let totalListeningQuestions = 0;
let totalAudioUrlsVerified = 0;

for (const exam of listeningExams) {
  const context = `Listening Exam "${exam.id}"`;
  const edMatch = exam.id.match(/cambridge_(\d+)_/i);
  const currentEd = edMatch ? parseInt(edMatch[1], 10) : null;

  assert(exam.id && typeof exam.id === 'string', `${context}: valid string id`);
  assert(exam.title && typeof exam.title === 'string', `${context}: valid title`);
  assert(exam.durationMinutes === 30, `${context}: durationMinutes is 30`);
  assert(exam.category === 'IELTS Listening', `${context}: category is 'IELTS Listening'`);
  assert(exam.isBuiltin === true, `${context}: isBuiltin is true`);
  assert(Array.isArray(exam.parts) && exam.parts.length === 4, `${context}: exactly 4 parts present`);

  const allQuestions = [];

  for (let pIdx = 0; pIdx < (exam.parts || []).length; pIdx++) {
    const part = exam.parts[pIdx];
    const pNum = pIdx + 1;
    const pContext = `${context} Part ${pNum}`;

    assert(part.partNumber === pNum, `${pContext}: partNumber is ${pNum}`);
    assert(part.title && typeof part.title === 'string', `${pContext}: non-empty title`);
    assert(part.passage && typeof part.passage === 'string' && part.passage.length > 30, `${pContext}: transcript/context present (>30 chars)`);
    assert(part.audioUrl && typeof part.audioUrl === 'string' && part.audioUrl.startsWith('http'), `${pContext}: valid http/https audioUrl`, part.audioUrl);
    if (part.audioUrl && part.audioUrl.startsWith('http')) {
      totalAudioUrlsVerified++;
    }

    // Audioscript edition cross-contamination assertion
    if (currentEd) {
      for (let otherEd = 1; otherEd <= 25; otherEd++) {
        if (otherEd !== currentEd) {
          const hasCrossEd = part.passage.toLowerCase().includes(`cambridge ${otherEd}`) || part.passage.toLowerCase().includes(`cambridge ielts ${otherEd}`);
          assert(!hasCrossEd, `${pContext}: transcript must not contain references to Cambridge ${otherEd}`);
        }
      }
      if (currentEd === 15) {
        assert(!part.passage.includes('CRIME REPORT FORM'), `${pContext}: Cam 15 must not contain Cambridge 14 Crime Report Form`);
      }
    }

    assert(Array.isArray(part.questionGroups) && part.questionGroups.length > 0, `${pContext}: has question groups`);

    for (const qg of (part.questionGroups || [])) {
      assert(qg.id && typeof qg.id === 'string', `${pContext} QG ${qg.id}: valid id`);
      assert(qg.instructions && typeof qg.instructions === 'string', `${pContext} QG ${qg.id}: valid instructions`);
      assert(Array.isArray(qg.questions) && qg.questions.length > 0, `${pContext} QG ${qg.id}: questions array non-empty`);

      // Verify sharedContent placeholders have zero duplicates
      if (qg.sharedContent) {
        const tokens = (qg.sharedContent.match(/\{\{\s*(\d+)\s*\}\}/g) || []).map(t => t.replace(/\D/g, ''));
        const tokenCounts = {};
        for (const t of tokens) {
          tokenCounts[t] = (tokenCounts[t] || 0) + 1;
        }
        const dupes = Object.entries(tokenCounts).filter(([_, c]) => c > 1);
        assert(dupes.length === 0, `${pContext} QG ${qg.id}: zero duplicate placeholders in sharedContent`, `Duplicates: ${dupes.map(([k, c]) => `{{${k}}} (x${c})`).join(', ')}`);
      }

      for (const q of (qg.questions || [])) {
        allQuestions.push(q);
        assert(VALID_QUESTION_TYPES.has(q.type), `${context} Q${q.orderNumber}: valid type "${q.type}"`);
        assert(q.prompt && typeof q.prompt === 'string' && q.prompt.trim().length > 0, `${context} Q${q.orderNumber}: non-empty prompt`);
        assert(q.correctAnswer !== undefined && q.correctAnswer !== '' && q.correctAnswer !== null && q.correctAnswer !== 'Not Found', `${context} Q${q.orderNumber}: valid correctAnswer (not 'Not Found')`);
        assert(q.explanation && typeof q.explanation === 'string' && q.explanation.trim().length > 0 && !q.explanation.includes("'Not Found'"), `${context} Q${q.orderNumber}: genuine explanation (no 'Not Found')`);

        const normAns = String(q.correctAnswer || '').trim().toUpperCase();
        assert(normAns !== 'N0', `${context} Q${q.orderNumber}: answer must not contain 'N0' typo`);
        assert(normAns !== 'NOTGIVEN', `${context} Q${q.orderNumber}: answer must not contain 'NOTGIVEN' typo`);

        if (q.type === 'FILL_IN_BLANK') {
          assert(!q.options || q.options.length === 0, `${context} Q${q.orderNumber}: FILL_IN_BLANK must not have options`);
        } else if (q.type === 'MULTIPLE_CHOICE_SINGLE') {
          const optIds = (q.options || []).map(o => o.id);
          assert(optIds.includes(String(q.correctAnswer).trim()), `${context} Q${q.orderNumber}: MC answer '${q.correctAnswer}' must be in options [${optIds.join(', ')}]`);
        } else if (q.type === 'MULTIPLE_CHOICE_MULTI') {
          const optIds = (q.options || []).map(o => o.id);
          const ansArray = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
          for (const a of ansArray) {
            assert(optIds.includes(String(a).trim()), `${context} Q${q.orderNumber}: MC Multi answer '${a}' must be in options [${optIds.join(', ')}]`);
          }
        } else if (q.type === 'MATCHING') {
          const optIds = (q.options || []).map(o => o.id.toLowerCase());
          const wbIds = (qg.wordBank || []).map(o => o.id.toLowerCase());
          const allIds = new Set([...optIds, ...wbIds]);
          const aNorm = String(q.correctAnswer).trim().toLowerCase();
          assert(allIds.has(aNorm), `${context} Q${q.orderNumber}: MATCHING answer '${q.correctAnswer}' must be in options or wordBank [${[...allIds].join(', ')}]`);
        }

        // Question type semantic assertions
        if (normAns === 'TRUE' || normAns === 'FALSE') {
          assert(q.type === 'TRUE_FALSE_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is ${normAns} so type must be TRUE_FALSE_NOT_GIVEN`, `Found: ${q.type}`);
          assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'TRUE') && q.options.some(o => o.id === 'FALSE') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for TRUE_FALSE_NOT_GIVEN`);
        } else if (normAns === 'YES' || normAns === 'NO') {
          assert(q.type === 'YES_NO_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is ${normAns} so type must be YES_NO_NOT_GIVEN`, `Found: ${q.type}`);
          assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'YES') && q.options.some(o => o.id === 'NO') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for YES_NO_NOT_GIVEN`);
        } else if (normAns === 'NOT GIVEN') {
          const groupAnswers = (qg.questions || []).map(x => String(x.correctAnswer || '').trim().toUpperCase());
          const hasSiblingYn = groupAnswers.some(a => a === 'YES' || a === 'NO');
          const hasSiblingTf = groupAnswers.some(a => a === 'TRUE' || a === 'FALSE');
          const isYnGroup = hasSiblingYn || (!hasSiblingTf && /\bYES\b/.test(qg.instructions.toUpperCase()));

          if (isYnGroup) {
            assert(q.type === 'YES_NO_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is NOT GIVEN in YES/NO group so type must be YES_NO_NOT_GIVEN`, `Found: ${q.type}`);
            assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'YES') && q.options.some(o => o.id === 'NO') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for YES_NO_NOT_GIVEN`);
          } else {
            assert(q.type === 'TRUE_FALSE_NOT_GIVEN', `${context} Q${q.orderNumber}: answer is NOT GIVEN in TRUE/FALSE group so type must be TRUE_FALSE_NOT_GIVEN`, `Found: ${q.type}`);
            assert(Array.isArray(q.options) && q.options.length === 3 && q.options.some(o => o.id === 'TRUE') && q.options.some(o => o.id === 'FALSE') && q.options.some(o => o.id === 'NOT GIVEN'), `${context} Q${q.orderNumber}: valid standard options for TRUE_FALSE_NOT_GIVEN`);
          }
        }

        // Prompt quality assertion: generic prompt prohibited unless sharedContent has placeholder
        if (/^Question\s+\d+$/i.test(q.prompt.trim())) {
          const hasScPlaceholder = Boolean(qg.sharedContent && qg.sharedContent.includes(`{{${q.orderNumber}}}`));
          assert(hasScPlaceholder, `${context} Q${q.orderNumber}: generic prompt is not allowed without sharedContent placeholder`);
        }

        // Fill-in-the-blank questions in Listening MUST have sharedContent containing {{orderNumber}}
        if (q.type === 'FILL_IN_BLANK') {
          assert(qg.sharedContent && qg.sharedContent.includes(`{{${q.orderNumber}}}`), `${context} Q${q.orderNumber}: Listening FILL_IN_BLANK must have sharedContent containing {{${q.orderNumber}}}`);
        }

        if (q.type === 'MATCHING') {
          assert(Array.isArray(q.options) && q.options.length >= 2, `${context} Q${q.orderNumber}: MATCHING type must have at least 2 options`, `Found: ${q.options ? q.options.length : 0}`);
        } else if (['MULTIPLE_CHOICE_SINGLE', 'MULTIPLE_CHOICE_MULTI'].includes(q.type)) {
          assert(Array.isArray(q.options) && q.options.length >= 2, `${context} Q${q.orderNumber}: MC question must have at least 2 options`, `Found: ${q.options ? q.options.length : 0}`);
        }
      }
    }
  }

  totalListeningQuestions += allQuestions.length;
  assert(allQuestions.length === 40, `${context}: exactly 40 questions present`, `Found: ${allQuestions.length}`);

  const orderNumbers = allQuestions.map(q => q.orderNumber).sort((a, b) => a - b);
  const expectedOrders = Array.from({ length: 40 }, (_, i) => i + 1);
  const ordersMatch = JSON.stringify(orderNumbers) === JSON.stringify(expectedOrders);
  assert(ordersMatch, `${context}: orderNumbers are strictly sequential 1..40`, `Mismatch: ${orderNumbers.slice(0, 5)}...`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Storage & Collection Configuration Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5/5] Validating Storage Collections & Vol Purge...');

const storagePath = path.join(projectRoot, 'apps', 'next', 'src', 'modules', 'ielts', 'utils', 'storage.ts');
assert(fs.existsSync(storagePath), 'apps/next/src/modules/ielts/utils/storage.ts exists');
const storageContent = fs.readFileSync(storagePath, 'utf8');

for (const ed of REQUIRED_EDITIONS) {
  assert(storageContent.includes(`id: 'col_cam_${ed}'`), `storage.ts defines col_cam_${ed}`);
  assert(storageContent.includes(`name: 'Cambridge ${ed}'`), `storage.ts defines Cambridge ${ed} name`);
}

for (let v = 1; v <= 10; v++) {
  assert(!storageContent.includes(`col_vol_${v}`), `storage.ts does NOT contain legacy default col_vol_${v}`);
}

assert(!storageContent.includes("return 'Vol 9'"), "storage.ts does NOT contain hardcoded 'Vol 9' return");

const sampleExamPath = path.join(projectRoot, 'apps', 'next', 'src', 'modules', 'ielts', 'data', 'sampleExam.ts');
assert(fs.existsSync(sampleExamPath), 'apps/next/src/modules/ielts/data/sampleExam.ts exists');
const sampleExamContent = fs.readFileSync(sampleExamPath, 'utf8');
assert(!sampleExamContent.includes('vol-9-test-1-reading'), 'sampleExam.ts does NOT contain vol-9-test-1-reading');
assert(!sampleExamContent.includes('VOL 9 TEST 1 READING'), 'sampleExam.ts does NOT contain VOL 9 TEST 1 READING');

// ─────────────────────────────────────────────────────────────────────────────
// Verification Summary Scoreboard
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log('PROGRAMMATIC VERIFICATION SCOREBOARD');
console.log('='.repeat(70));
console.log(`  Total Checks Executed:      ${totalChecks}`);
console.log(`  Checks Passed:              ${passedChecks}`);
console.log(`  Checks Failed:              ${failedChecks}`);
console.log(`  Reading Exams Verified:     ${readingExams.length} (${totalReadingQuestions} questions)`);
console.log(`  Listening Exams Verified:   ${listeningExams.length} (${totalListeningQuestions} questions)`);
console.log(`  Audio Sources Verified:     ${totalAudioUrlsVerified} / ${listeningExams.length * 4}`);
console.log(`  Total Questions Audited:    ${totalReadingQuestions + totalListeningQuestions}`);
console.log('='.repeat(70));

if (failedChecks > 0) {
  console.error(`\n❌ VERIFICATION FAILED with ${failedChecks} errors.`);
  process.exit(1);
} else {
  console.log('\n✅ ALL VERIFICATION CHECKS PASSED PERFECTLY (0 ERRORS).\n');
  process.exit(0);
}
