import type { SpeakingExam } from '../types/speaking';

export const sampleSpeakingExams: SpeakingExam[] = [
  {
    id: 'speaking_test_2',
    title: 'IELTS Speaking Test 2: Technology, Artificial Intelligence & Future Careers',
    collection: 'Cambridge 18',
    description: 'Digital technology trends, Artificial Intelligence tools, and their impact on future employment.',
    createdAt: Date.now() - 500000,
    updatedAt: Date.now() - 500000,
    part1Questions: [
      {
        id: 'spk2_1_q1',
        part: 1,
        topic: 'Computers & Technology',
        questionText: 'How often do you use computers in your daily life?',
        sampleAnswer:
          'Virtually non-stop throughout my waking hours! As an IT enthusiast, my computer serves as both my primary workstation and my gateway to information and entertainment. From coding algorithms and drafting reports to video streaming, it is an indispensable tool in my everyday existence.',
        keyVocabulary: [
          { word: 'virtually non-stop', meaning: 'Almost continuously without interruption' },
          { word: 'indispensable tool', meaning: 'An essential instrument one cannot do without' },
        ],
      },
    ],
    part2Question: {
      id: 'spk2_2_q1',
      part: 2,
      topic: 'A Piece of Electronic Equipment',
      questionText: 'Describe an electronic device or technology tool that you find extremely useful.',
      cueCardBullets: [
        'What the device or tool is',
        'How often and where you use it',
        'What specific features make it special',
        'And explain how it enhances your productivity or daily convenience',
      ],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
      sampleAnswer: `I would like to talk about an artificial intelligence coding companion and research assistant that has completely revolutionized my daily workflow: Google Antigravity.

I utilize this environment virtually every single day, whether I am building web applications, debugging complex algorithms, or reviewing academic papers. It acts as an autonomous pair programmer right within my development workspace.

What sets this tool apart from generic conversational bots is its profound environmental awareness. It doesn't merely generate isolated code snippets; it navigates through entire repositories, executes shell commands, runs test suites, and verifies visual user interfaces end-to-end. Furthermore, its ability to formulate proactive execution plans before making critical architectural modifications ensures flawless precision.

In terms of personal impact, this tool has elevated my productivity to unprecedented heights. Tasks that previously consumed days of manual labor—such as configuring boilerplate setups or migrating legacy workflows—can now be orchestrated within minutes. It feels like having a senior engineer constantly collaborating at my side.`,
      keyVocabulary: [
        { word: 'revolutionary workflow', meaning: 'A transformative way of organizing daily work' },
        { word: 'environmental awareness', meaning: 'Ability to understand the surrounding project context' },
        { word: 'unprecedented heights', meaning: 'Levels of performance never reached before' },
      ],
    },
    part3Questions: [
      {
        id: 'spk2_3_q1',
        part: 3,
        topic: 'AI and Job Market',
        questionText: 'Do you believe artificial intelligence will replace human workers across most industries?',
        sampleAnswer:
          'In my assessment, AI will not necessarily replace human workers outright, but rather individuals who adeptly harness AI will supersede those who do not. Routine, repetitive tasks will unquestionably become automated, which might cause short-term frictional unemployment. Nevertheless, higher-order skills such as emotional intelligence, ethical discernment, creative ingenuity, and strategic decision-making will remain profoundly human domains.',
        keyVocabulary: [
          { word: 'supersede', meaning: 'Take the place of or outperform an older approach' },
          { word: 'frictional unemployment', meaning: 'Temporary job transitions as industries evolve' },
          { word: 'ethical discernment', meaning: 'Sound moral judgment in complex situations' },
        ],
      },
    ],
  },
];

const SPEAKING_STORAGE_KEY = 'ielts_speaking_exams_custom';

export function getAllSpeakingExams(): SpeakingExam[] {
  try {
    const raw = localStorage.getItem(SPEAKING_STORAGE_KEY);
    const custom: SpeakingExam[] = raw ? JSON.parse(raw) : [];
    const deletedRaw = localStorage.getItem('ielts_speaking_exams_deleted');
    const deletedSet: Set<string> = new Set(deletedRaw ? JSON.parse(deletedRaw) : []);

    const map = new Map<string, SpeakingExam>();
    for (const ex of sampleSpeakingExams) {
      if (!deletedSet.has(ex.id)) {
        map.set(ex.id, ex);
      }
    }
    for (const ex of custom) {
      if (!deletedSet.has(ex.id)) {
        map.set(ex.id, ex);
      }
    }
    return Array.from(map.values());
  } catch {
    return sampleSpeakingExams;
  }
}

export function saveSpeakingExam(exam: SpeakingExam): void {
  try {
    const deletedRaw = localStorage.getItem('ielts_speaking_exams_deleted');
    if (deletedRaw) {
      const deletedSet: Set<string> = new Set(JSON.parse(deletedRaw));
      if (deletedSet.has(exam.id)) {
        deletedSet.delete(exam.id);
        localStorage.setItem('ielts_speaking_exams_deleted', JSON.stringify(Array.from(deletedSet)));
      }
    }
    const raw = localStorage.getItem(SPEAKING_STORAGE_KEY);
    const custom: SpeakingExam[] = raw ? JSON.parse(raw) : [];
    const idx = custom.findIndex((e) => e.id === exam.id);
    if (idx >= 0) {
      custom[idx] = exam;
    } else {
      custom.push(exam);
    }
    localStorage.setItem(SPEAKING_STORAGE_KEY, JSON.stringify(custom));
  } catch (err) {
    console.error('Failed to save speaking exam', err);
  }
}

export function deleteSpeakingExam(id: string): boolean {
  try {
    const deletedRaw = localStorage.getItem('ielts_speaking_exams_deleted');
    const deletedSet: Set<string> = new Set(deletedRaw ? JSON.parse(deletedRaw) : []);
    deletedSet.add(id);
    localStorage.setItem('ielts_speaking_exams_deleted', JSON.stringify(Array.from(deletedSet)));

    const raw = localStorage.getItem(SPEAKING_STORAGE_KEY);
    if (raw) {
      const custom: SpeakingExam[] = JSON.parse(raw);
      const filtered = custom.filter((e) => e.id !== id);
      localStorage.setItem(SPEAKING_STORAGE_KEY, JSON.stringify(filtered));
    }
    return true;
  } catch (err) {
    console.error('Failed to delete speaking exam', err);
    return false;
  }
}
