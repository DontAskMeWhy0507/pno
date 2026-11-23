import type { SpeakingExam } from '../types/speaking';

export const sampleSpeakingExams: SpeakingExam[] = [
  {
    id: 'speaking_test_1',
    title: 'IELTS Speaking Test 1: Hometown, Book & Reading Culture',
    collection: 'IELTS Forecast 2024-2026',
    description: 'High-frequency Part 1 hometown questions, Part 2 favorite book Cue Card, and Part 3 reading culture discussion.',
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now() - 1000000,
    part1Questions: [
      {
        id: 'spk_1_q1',
        part: 1,
        topic: 'Hometown',
        questionText: 'Where is your hometown, and what do you like most about it?',
        sampleAnswer:
          'I hail from Da Nang, a coastal city in central Vietnam. What captivates me most is the breathtaking harmony between mountains and the ocean, complemented by an exceptionally clean and laid-back urban atmosphere. Unlike bustling megacities, people in my hometown are genuinely cordial, and the seafood is unparalleled.',
        keyVocabulary: [
          { word: 'hail from', meaning: 'Originate or come from a particular place', phonetic: '/heɪl frəm/' },
          { word: 'breathtaking harmony', meaning: 'Stunning and peaceful balance of nature', phonetic: '/ˈbreθteɪkɪŋ ˈhɑːməni/' },
          { word: 'laid-back atmosphere', meaning: 'Relaxed, calm, and unhurried environment', phonetic: '/ˌleɪd ˈbæk ˈætməsfɪər/' },
          { word: 'unparalleled', meaning: 'Unmatched; having no equal in quality', phonetic: '/ʌnˈpærəleld/' },
        ],
      },
      {
        id: 'spk_1_q2',
        part: 1,
        topic: 'Hometown Changes',
        questionText: 'Has your hometown changed much since you were a child?',
        sampleAnswer:
          'Substantially, I would say. Over the past decade, my city has experienced rapid modernization, with iconic architectural landmarks like the Dragon Bridge emerging alongside state-of-the-art infrastructure. While it has undoubtedly become a premier tourist destination, it has managed to preserve its serene coastal charm without succumbing to severe traffic congestion.',
        keyVocabulary: [
          { word: 'rapid modernization', meaning: 'Fast-paced urban and technological development' },
          { word: 'architectural landmarks', meaning: 'Iconic buildings or structures defining a city' },
          { word: 'succumbing to', meaning: 'Giving in to or falling victim to (e.g. congestion)' },
        ],
      },
      {
        id: 'spk_1_q3',
        part: 1,
        topic: 'Reading Habits',
        questionText: 'Do you prefer reading physical books or e-books?',
        sampleAnswer:
          'To be completely honest, I lean toward paperbacks. There is an irreplaceable tactile sensation in flipping physical pages and the pleasant aroma of fresh print. That being said, I occasionally resort to e-readers when commuting due to their sheer portability and built-in dictionary lookups.',
        keyVocabulary: [
          { word: 'tactile sensation', meaning: 'Physical feeling experienced through touch' },
          { word: 'sheer portability', meaning: 'Extreme convenience of carrying anywhere' },
          { word: 'lean toward', meaning: 'Prefer or favor one option over another' },
        ],
      },
    ],
    part2Question: {
      id: 'spk_2_q1',
      part: 2,
      topic: 'An Interesting Book',
      questionText: 'Describe an interesting book you have recently read.',
      cueCardBullets: [
        'What the book was and who wrote it',
        'When and why you decided to read it',
        'What the main storyline or concept was',
        'And explain why you found it particularly interesting or impactful',
      ],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
      tips: [
        'Use the 1-minute preparation time to jot down core keywords rather than full sentences.',
        'Mix narrative past tenses (Past Simple, Past Continuous, Past Perfect) when explaining how you found the book.',
        'Incorporate natural idiomatic expressions and varied intonation for an engaging delivery.',
      ],
      sampleAnswer: `I would like to share my thoughts on a profoundly thought-provoking non-fiction book that I finished just a couple of months ago, entitled "Atomic Habits" by James Clear. 

I initially stumbled upon this masterpiece through a recommendation by a close university colleague who claimed it revolutionized his daily productivity. At that time, I was wrestling with procrastination and struggling to maintain consistent study routines, so I decided to delve into it with the hope of instigating positive personal change.

The core philosophy of the book revolves around the transformative power of marginal gains—the notion that tiny, 1% improvements compounded over time culminate in monumental life achievements. Clear introduces a comprehensive four-step framework: making good habits obvious, attractive, easy, and satisfying, while applying the inverse principles to dismantle destructive habits.

What captivated me most was Clear's scientific yet accessible narrative. Rather than relying on empty motivational platitudes, he grounds his concepts in behavioral psychology and neuroscience. Reading the book genuinely shifted my mindset from fixating on abstract goals to designing durable daily systems. It was an eye-opening revelation that has tangibly improved my daily focus and disciplined routine.`,
      keyVocabulary: [
        { word: 'thought-provoking', meaning: 'Stimulating deep reflection and serious thought' },
        { word: 'stumbled upon', meaning: 'Discovered by chance or unexpectedly' },
        { word: 'marginal gains', meaning: 'Small incremental improvements that add up' },
        { word: 'culminate in monumental achievements', meaning: 'Lead ultimately to major accomplishments' },
        { word: 'motivational platitudes', meaning: 'Overused, cliché advice lacking depth' },
        { word: 'eye-opening revelation', meaning: 'A surprising insight that changes one’s perspective' },
      ],
    },
    part3Questions: [
      {
        id: 'spk_3_q1',
        part: 3,
        topic: 'Reading Culture & Digital Age',
        questionText: 'Why do you think young people seem to read fewer books nowadays compared to the past?',
        sampleAnswer:
          'Primarily, it boils down to the overwhelming influx of bite-sized digital entertainment. Platforms like TikTok, Instagram Reels, and YouTube offer instant dopamine hits in mere seconds, which drastically diminishes our attention spans. Consequently, diving into a 400-page book requires deliberate cognitive effort and sustained concentration that many youngsters find challenging to maintain amidst ubiquitous smartphone notifications.',
        keyVocabulary: [
          { word: 'boils down to', meaning: 'Has as its main or fundamental cause' },
          { word: 'instant dopamine hits', meaning: 'Immediate bursts of pleasure from short media' },
          { word: 'diminishes attention spans', meaning: 'Reduces the ability to focus for long periods' },
          { word: 'cognitive effort', meaning: 'Active mental concentration and processing' },
        ],
      },
      {
        id: 'spk_3_q2',
        part: 3,
        topic: 'Libraries in the Future',
        questionText: 'Do you believe traditional public libraries will become obsolete in the digital era?',
        sampleAnswer:
          'I respectfully disagree with that assertion. While libraries are no longer solely custodians of paper archives, they are actively reinventing themselves into vibrant community learning hubs. Beyond borrowing books, modern libraries provide quiet sanctuaries for scholarly research, access to specialized databases, workshops, and digital fabrication spaces. Hence, their communal and educational essence ensures their enduring relevance.',
        keyVocabulary: [
          { word: 'custodians of paper archives', meaning: 'Keepers or guardians of physical book collections' },
          { word: 'quiet sanctuaries', meaning: 'Peaceful spaces free from distraction' },
          { word: 'enduring relevance', meaning: 'Long-lasting value and importance over time' },
        ],
      },
    ],
  },
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
