import type { SpeakingExam } from '../types/speaking';

export const sampleSpeakingExams: SpeakingExam[] = [
  {
    id: 'speaking_test_1',
    title: 'IELTS Speaking Test 1: Hometown, Book & Reading Culture',
    collection: 'IELTS Forecast 2024-2026',
    description: 'Chủ đề quen thuộc Part 1, Cue card sách yêu thích Part 2 và Thảo luận văn hóa đọc Part 3.',
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
          { word: 'hail from', meaning: 'Sinh ra và lớn lên từ...', phonetic: '/heɪl frəm/' },
          { word: 'breathtaking harmony', meaning: 'Sự hòa hợp ngoạn mục, tuyệt đẹp', phonetic: '/ˈbreθteɪkɪŋ ˈhɑːməni/' },
          { word: 'laid-back atmosphere', meaning: 'Không khí thư thả, bình yên', phonetic: '/ˌleɪd ˈbæk ˈætməsfɪər/' },
          { word: 'unparalleled', meaning: 'Không gì sánh bằng, xuất sắc vượt trội', phonetic: '/ʌnˈpærəleld/' },
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
          { word: 'rapid modernization', meaning: 'Hiện đại hóa nhanh chóng' },
          { word: 'architectural landmarks', meaning: 'Các biểu tượng kiến trúc' },
          { word: 'succumbing to', meaning: 'Bị khuất phục, chìm vào (ùn tắc)' },
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
          { word: 'tactile sensation', meaning: 'Cảm giác xúc giác khi chạm vào' },
          { word: 'sheer portability', meaning: 'Tính tiện lợi, dễ mang theo' },
          { word: 'lean toward', meaning: 'Nghiêng về, ưa chuộng hơn' },
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
        'Dùng 1 phút chuẩn bị để ghi từ khóa chính (Keywords) chứ không viết thành câu.',
        'Sử dụng các cấu trúc thì quá khứ (Past simple, Past continuous, Past perfect) khi kể lại hoàn cảnh.',
        'Áp dụng Idioms tự nhiên và nhấn nhá ngữ điệu để tạo sự lôi cuốn.',
      ],
      sampleAnswer: `I would like to share my thoughts on a profoundly thought-provoking non-fiction book that I finished just a couple of months ago, entitled "Atomic Habits" by James Clear. 

I initially stumbled upon this masterpiece through a recommendation by a close university colleague who claimed it revolutionized his daily productivity. At that time, I was wrestling with procrastination and struggling to maintain consistent study routines, so I decided to delve into it with the hope of instigating positive personal change.

The core philosophy of the book revolves around the transformative power of marginal gains—the notion that tiny, 1% improvements compounded over time culminate in monumental life achievements. Clear introduces a comprehensive four-step framework: making good habits obvious, attractive, easy, and satisfying, while applying the inverse principles to dismantle destructive habits.

What captivated me most was Clear's scientific yet accessible narrative. Rather than relying on empty motivational platitudes, he grounds his concepts in behavioral psychology and neuroscience. Reading the book genuinely shifted my mindset from fixating on abstract goals to designing durable daily systems. It was an eye-opening revelation that has tangibly improved my daily focus and disciplined routine.`,
      keyVocabulary: [
        { word: 'thought-provoking', meaning: 'Kích thích suy nghĩ sâu sắc' },
        { word: 'stumbled upon', meaning: 'Tình cờ biết đến' },
        { word: 'marginal gains', meaning: 'Những cải tiến nhỏ nhặt nhưng tích lũy' },
        { word: 'culminate in monumental achievements', meaning: 'Đạt đỉnh điểm thành thành tựu vĩ đại' },
        { word: 'motivational platitudes', meaning: 'Những lời sáo rỗng tạo động lực' },
        { word: 'eye-opening revelation', meaning: 'Một sự khai sáng mở mang tầm mắt' },
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
          { word: 'boils down to', meaning: 'Quy tụ về nguyên nhân chính là' },
          { word: 'instant dopamine hits', meaning: 'Kích thích tức thời dopamine' },
          { word: 'diminishes attention spans', meaning: 'Làm suy giảm khả năng tập trung' },
          { word: 'cognitive effort', meaning: 'Nỗ lực tư duy nhận thức' },
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
          { word: 'custodians of paper archives', meaning: 'Người trông coi các kho lưu trữ giấy' },
          { word: 'quiet sanctuaries', meaning: 'Nơi chốn yên tĩnh tôn nghiêm' },
          { word: 'enduring relevance', meaning: 'Giá trị và sự phù hợp lâu bền theo thời gian' },
        ],
      },
    ],
  },
  {
    id: 'speaking_test_2',
    title: 'IELTS Speaking Test 2: Technology, Artificial Intelligence & Future Careers',
    collection: 'Cambridge 18',
    description: 'Chủ đề xu hướng công nghệ số, Trí tuệ nhân tạo và Tác động đối với thị trường việc làm.',
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
          { word: 'virtually non-stop', meaning: 'Gần như liên tục không ngừng' },
          { word: 'indispensable tool', meaning: 'Công cụ thiết yếu không thể thiếu' },
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
        { word: 'revolutionary workflow', meaning: 'Quy trình làm việc mang tính cách mạng' },
        { word: 'environmental awareness', meaning: 'Khả năng hiểu bối cảnh môi trường xung quanh' },
        { word: 'unprecedented heights', meaning: 'Tầm cao chưa từng có trước đây' },
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
          { word: 'supersede', meaning: 'Thay thế, vượt trội hơn' },
          { word: 'frictional unemployment', meaning: 'Thất nghiệp tạm thời do chuyển đổi' },
          { word: 'ethical discernment', meaning: 'Sự sáng suốt về mặt đạo đức' },
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
