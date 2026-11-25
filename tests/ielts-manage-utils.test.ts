import {
  parseIeltsLocation,
  buildIeltsHomePath,
} from '../apps/next/src/modules/ielts/utils/ieltsRoutes';
import {
  detectSkillFromText,
  parseIELTSText,
  parseSpeakingText,
  parseUnifiedSmartText,
  UNIFIED_SAMPLE_TEMPLATE,
} from '../apps/next/src/modules/ielts/utils/textParser';
import { extractMediaEmbedInfo } from '../apps/next/src/modules/ielts/utils/mediaUploader';
import {
  createCollection,
  renameCollection,
  ensureCollectionExists,
  getAllCollections,
  importTestsBundleFromJSON,
} from '../apps/next/src/modules/ielts/utils/storage';
import {
  sortUnifiedRows,
  resolveCollectionOption,
  computeTestHealth,
  type UnifiedTestRow,
} from '../apps/next/src/modules/ielts/components/admin/manage/ManageHelpers';

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  return store;
}

describe('ieltsRoutes sub-URL parsing & building', () => {
  test('parses home sub-URLs for collections, detail, test, history, and manage', () => {
    const collections = parseIeltsLocation('/ielts/collections');
    expect(collections.view).toBe('home');
    if (collections.view === 'home') {
      expect(buildIeltsHomePath(collections.home)).toBe('/ielts/collections');
    }

    const detail = parseIeltsLocation('/ielts/collections/Vol%201%20Reading', '?skill=reading');
    expect(detail.view).toBe('home');
    if (detail.view === 'home') {
      expect(buildIeltsHomePath(detail.home)).toBe('/ielts/collections/Vol%201%20Reading?skill=reading');
    }

    const detailOverview = parseIeltsLocation('/ielts/test/listening/cam-19-t1');
    expect(detailOverview.view).toBe('home');
    if (detailOverview.view === 'home') {
      expect(buildIeltsHomePath(detailOverview.home)).toBe('/ielts/test/listening/cam-19-t1');
    }

    const history = parseIeltsLocation('/ielts/history');
    expect(history.view).toBe('home');
    if (history.view === 'home') {
      expect(buildIeltsHomePath(history.home)).toBe('/ielts/history');
    }

    const manageTests = parseIeltsLocation('/ielts/manage/tests', '?action=smart_import');
    expect(manageTests.view).toBe('home');
    if (manageTests.view === 'home') {
      expect(buildIeltsHomePath(manageTests.home)).toContain('/ielts/manage/tests');
    }

    const manageCols = parseIeltsLocation('/ielts/manage/collections');
    expect(manageCols.view).toBe('home');
    if (manageCols.view === 'home') {
      expect(buildIeltsHomePath(manageCols.home)).toBe('/ielts/manage/collections');
    }
  });

  test('parses exam room sub-URLs accurately', () => {
    const reading = parseIeltsLocation('/ielts/reading/test-123/part/2');
    expect(reading).toEqual({
      view: 'exam',
      skill: 'reading',
      examId: 'test-123',
      partNumber: 2,
    });

    const listening = parseIeltsLocation('/ielts/listening/audio-9/part/4');
    expect(listening).toEqual({
      view: 'exam',
      skill: 'listening',
      examId: 'audio-9',
      partNumber: 4,
    });

    const writing = parseIeltsLocation('/ielts/writing/w-1');
    expect(writing).toEqual({
      view: 'writing',
      examId: 'w-1',
    });

    const speaking = parseIeltsLocation('/ielts/speaking/s-1');
    expect(speaking).toEqual({
      view: 'speaking',
      examId: 's-1',
    });
  });
});

describe('textParser skill auto-detection and [COLLECTION]/[IMAGE]/[VIDEO] parsing', () => {
  test('detectSkillFromText distinguishes reading, listening, writing, and speaking', () => {
    expect(
      detectSkillFromText('[TITLE] Cam 20 Test 1\n=== SECTION 1 ===\n[AUDIO] /uploads/a.mp3\nQ1. Name: ___')
        .skill
    ).toBe('listening');

    expect(
      detectSkillFromText('[TITLE] Reading 1\n=== PASSAGE 1 ===\nParagraph A...\nTRUE / FALSE / NOT GIVEN')
        .skill
    ).toBe('reading');

    expect(
      detectSkillFromText('[TITLE] W1\n=== TASK 1 ===\n[PROMPT] Chart shows...\n=== TASK 2 ===\n[PROMPT] Discuss both views.')
        .skill
    ).toBe('writing');

    expect(
      detectSkillFromText('[TITLE] S1\n=== PART 1 ===\n[TOPIC] Home\nQ: Where do you live?\n=== PART 2 ===\n[CUE_CARD] Describe...')
        .skill
    ).toBe('speaking');
  });

  test('parseIELTSText extracts [COLLECTION], [IMAGE], [VIDEO], and infers Listening from === SECTION ===/[AUDIO]', () => {
    const raw = [
      '[TITLE] Cam 19 Listening Test 1',
      '[COLLECTION] Custom Vol 2',
      '=== SECTION 1 ===',
      '[AUDIO] /uploads/audio/s1.mp3',
      '[IMAGE] /uploads/pic/map.png',
      '[VIDEO] https://youtu.be/dQw4w9WgXcQ',
      '1. Visitor name: ________',
      '=== ANSWERS ===',
      '1. Alice',
    ].join('\n');

    const { exam } = parseIELTSText(raw);
    expect(exam.collection).toBe('Custom Vol 2');
    expect(exam.category).toBe('IELTS Listening');
    expect(exam.durationMinutes).toBe(30);
    expect(exam.parts).toHaveLength(1);
    expect(exam.parts[0]?.audioUrl).toBe('/uploads/audio/s1.mp3');
    expect(exam.parts[0]?.imageUrl).toBe('/uploads/pic/map.png');
    expect(exam.parts[0]?.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
  });

  test('parseSpeakingText extracts Part 2 [IMAGE] and [VIDEO]', () => {
    const raw = [
      '[TITLE] Speaking Mock 1',
      '[COLLECTION] My Speaking',
      '[DESC] Travel topic',
      '=== PART 1 ===',
      '[TOPIC] Hometown',
      'Q: Where is your hometown?',
      'A: It is a coastal city.',
      '=== PART 2 ===',
      '[TOPIC] Travel',
      '[CUE_CARD] Describe a memorable trip.',
      '[IMAGE] /uploads/pic/trip.jpg',
      '[VIDEO] /uploads/video/trip.mp4',
      '[BULLETS]',
      '- Where you went',
      '- Who you went with',
      '- What you did',
      '- Why it was memorable',
      '[SAMPLE_ANSWER]',
      'Last summer I visited Da Nang.',
      '=== PART 3 ===',
      '[TOPIC] Tourism',
      'Q: How does tourism help local economies?',
      'A: It creates jobs and infrastructure.',
    ].join('\n');

    const parsed = parseSpeakingText(raw);
    expect(parsed.exam).toBeDefined();
    expect(parsed.exam!.title).toBe('Speaking Mock 1');
    expect(parsed.exam!.collection).toBe('My Speaking');
    const p2 = parsed.exam!.part2Question;
    expect(p2.imageUrl).toBe('/uploads/pic/trip.jpg');
    expect(p2.videoUrl).toBe('/uploads/video/trip.mp4');
  });
});

describe('mediaUploader extractMediaEmbedInfo', () => {
  test('classifies YouTube links, MP4 videos, audio files, and images safely', () => {
    const yt = extractMediaEmbedInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(yt?.kind).toBe('youtube');
    expect(yt?.embedUrl).toContain('youtube.com/embed/dQw4w9WgXcQ');

    const ytShort = extractMediaEmbedInfo('https://youtu.be/abc12345678');
    expect(ytShort?.kind).toBe('youtube');
    expect(ytShort?.embedUrl).toContain('youtube.com/embed/abc12345678');

    expect(extractMediaEmbedInfo('/uploads/video/clip.mp4')?.kind).toBe('video');
    expect(extractMediaEmbedInfo('/uploads/audio/part1.mp3')?.kind).toBe('audio');
    expect(extractMediaEmbedInfo('/uploads/pic/chart.png')?.kind).toBe('image');
    expect(extractMediaEmbedInfo('javascript:alert(1)')).toBeNull();
  });
});

describe('storage collections & bundle import/export', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  test('enforces case-insensitive duplicate protection and preserves custom Vol collections', () => {
    createCollection('Vol 99 Custom', 'Custom reading set');
    const cols = getAllCollections();
    expect(cols.some((c) => c.name === 'Vol 99 Custom')).toBe(true);

    expect(() => createCollection('vol 99 custom')).toThrow();

    createCollection('Alpha Set');
    expect(() => renameCollection('Alpha Set', 'VOL 99 CUSTOM')).toThrow();

    const ensuredExisting = ensureCollectionExists('vol 99 custom');
    expect(ensuredExisting.created).toBe(false);
    expect(ensuredExisting.collection.name).toBe('Vol 99 Custom');

    const ensuredNew = ensureCollectionExists('Beta Set');
    expect(ensuredNew.created).toBe(true);
    expect(ensuredNew.collection.name).toBe('Beta Set');
  });

  test('importTestsBundleFromJSON imports single objects, arrays, and versioned bundles', () => {
    const bundleJson = JSON.stringify({
      version: 1,
      exportedAt: '2026-11-24T00:00:00.000Z',
      tests: [
        {
          id: 'r-1',
          title: 'Bundle Reading',
          category: 'IELTS Reading',
          durationMinutes: 60,
          totalQuestions: 1,
          parts: [],
        },
        {
          id: 'w-1',
          title: 'Bundle Writing',
          collection: 'Academic Pack',
          task1: { title: 'Task 1', prompt: 'Chart', timeMinutes: 20, minWords: 150 },
          task2: { title: 'Task 2', prompt: 'Essay', timeMinutes: 40, minWords: 250 },
        },
      ],
    });

    const res = importTestsBundleFromJSON(bundleJson, 'Imported Default');
    expect(res.exams).toHaveLength(1);
    expect(res.exams[0]?.collection).toBe('Imported Default');
    expect(res.writingExams).toHaveLength(1);
    expect(res.writingExams[0]?.collection).toBe('Academic Pack');
    expect(res.speakingExams).toHaveLength(0);

    expect(() => importTestsBundleFromJSON(JSON.stringify({ bad: true }))).toThrow();
  });
});

describe('ManageHelpers sorting, collection matching, and health checks', () => {
  test('sortUnifiedRows uses natural numeric collation', () => {
    const makeRow = (id: string, title: string, qCount: number): UnifiedTestRow => ({
      key: `Reading:${id}`,
      id,
      title,
      skill: 'Reading',
      collection: 'Vol 2',
      meta: '1 part',
      questionCount: qCount,
      updatedAt: 1700000000000,
      isBuiltin: false,
      healthWarnings: [],
    });

    const rows = [
      makeRow('1', 'Test 10', 40),
      makeRow('2', 'Test 2', 20),
      makeRow('3', 'Test 1', 10),
    ];

    const sortedTitles = sortUnifiedRows(rows, 'title', 'asc').map((r) => r.title);
    expect(sortedTitles).toEqual(['Test 1', 'Test 2', 'Test 10']);

    const sortedByQ = sortUnifiedRows(rows, 'questions', 'desc').map((r) => r.questionCount);
    expect(sortedByQ).toEqual([40, 20, 10]);
  });

  test('resolveCollectionOption resolves case-insensitively', () => {
    const cols = [
      { id: '1', name: 'Cam 19' },
      { id: '2', name: 'My Tests' },
    ];
    expect(resolveCollectionOption('cam 19', cols)).toBe('Cam 19');
    expect(resolveCollectionOption('New Pack', cols)).toBe('New Pack');
  });

  test('computeTestHealth flags empty questions, missing answers, and listening without audio', () => {
    const emptyIssues = computeTestHealth({
      skill: 'Reading',
      questionCount: 0,
      rawExam: {
        id: 'r-empty',
        title: 'Empty Reading',
        category: 'IELTS Reading',
        durationMinutes: 60,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        parts: [],
      },
    });
    expect(emptyIssues.length).toBeGreaterThan(0);

    const listeningIssues = computeTestHealth({
      skill: 'Listening',
      questionCount: 1,
      rawExam: {
        id: 'l-1',
        title: 'Listening 1',
        category: 'IELTS Listening',
        durationMinutes: 30,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        parts: [
          {
            id: 'p-1',
            partNumber: 1,
            title: 'Section 1',
            passage: '',
            questionGroups: [
              {
                id: 'g-1',
                title: 'Questions 1-1',
                instructions: 'Complete',
                questions: [
                  {
                    id: 'q-1',
                    orderNumber: 1,
                    type: 'FILL_IN_BLANK',
                    prompt: 'Name:',
                    correctAnswer: '',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(listeningIssues.some((msg) => /audio/i.test(msg))).toBe(true);
    expect(listeningIssues.some((msg) => /answer/i.test(msg))).toBe(true);
  });
});

describe('parseUnifiedSmartText (multi-test & media slot detection)', () => {
  test('parses UNIFIED_SAMPLE_TEMPLATE into Reading, Listening, Writing with inherited collection and media slots', () => {
    const res = parseUnifiedSmartText(UNIFIED_SAMPLE_TEMPLATE);
    expect(res.errors).toEqual([]);
    expect(res.hasExplicitCollection).toBe(true);
    expect(res.collection).toBe('Cambridge IELTS 20 - Test 1');
    expect(res.tests).toHaveLength(3);

    expect(res.tests[0]?.skill).toBe('reading');
    expect(res.tests[1]?.skill).toBe('listening');
    expect(res.tests[2]?.skill).toBe('writing');

    // Listening should expose 2 required audio slots + Section 2 map image slot; Writing exposes Task 1 image slot
    const audioSlots = res.mediaSlots.filter((s) => s.kind === 'audio');
    expect(audioSlots).toHaveLength(2);
    expect(audioSlots.every((s) => s.required && !s.currentUrl)).toBe(true);

    const imageSlots = res.mediaSlots.filter((s) => s.kind === 'image');
    expect(imageSlots.length).toBeGreaterThanOrEqual(2);
    expect(imageSlots.some((s) => s.hint?.includes('Map of the museum ground floor'))).toBe(true);
    expect(imageSlots.some((s) => s.hint?.includes('Bar chart comparing renewable energy'))).toBe(true);

    // Placeholder descriptions must NOT leak into actual URL fields
    const listeningTest = res.tests[1]!;
    if (listeningTest.skill === 'listening') {
      expect(listeningTest.exam.parts[0]?.audioUrl).toBe('');
      expect(listeningTest.exam.parts[1]?.imageUrl).toBeFalsy();
    }
    const writingTest = res.tests[2]!;
    if (writingTest.skill === 'writing') {
      expect(writingTest.exam.task1.imageUrl).toBeUndefined();
    }
  });

  test('supports single test without [TEST] or [SKILL] tags and Speaking without [DESC]', () => {
    const singleSpeaking = [
      '[COLLECTION] Vol 99',
      '[TITLE] Quick Speaking',
      '[PART 1]',
      '[TOPIC] Work',
      'Q: What do you do?',
      'A: I am a software engineer.',
      '[PART 2]',
      '[TOPIC] Gadget',
      '[CUE_CARD] Describe a useful device.',
      '[IMAGE: Photo of a smartphone]',
      '[BULLETS]',
      '- What it is',
      '- When you bought it',
      '- How often you use it',
      '- Why it is useful',
      '[SAMPLE_ANSWER]',
      'My smartphone is indispensable.',
      '[PART 3]',
      '[TOPIC] Tech',
      'Q: How has tech changed work?',
      'A: Remote work is now common.',
    ].join('\n');

    const res = parseUnifiedSmartText(singleSpeaking);
    expect(res.errors).toEqual([]);
    expect(res.collection).toBe('Vol 99');
    expect(res.tests).toHaveLength(1);
    expect(res.tests[0]?.skill).toBe('speaking');
    expect(res.tests[0]?.errors).toEqual([]);
    expect(res.mediaSlots.some((s) => s.kind === 'image' && s.hint === 'Photo of a smartphone')).toBe(
      true
    );
  });
});
