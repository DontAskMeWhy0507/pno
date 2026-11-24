import type { WritingExam } from '../types/writing';

export const sampleWritingExams: WritingExam[] = [
  {
    id: 'writing_test_2',
    title: 'IELTS Writing Test 2 (Internet Usage & Work From Home)',
    collection: 'Cambridge 18',
    durationMinutes: 60,
    createdAt: Date.now() - 500000,
    updatedAt: Date.now() - 500000,
    task1: {
      id: 'writing_test_2_task1',
      taskNumber: 1,
      title: 'Task 1: Internet Usage Trends (2010 - 2020)',
      recommendedMinutes: 20,
      minWords: 150,
      chartType: 'line',
      prompt:
        'The line graph below shows the percentage of people using the internet in three countries (USA, Canada, and Mexico) between 2010 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
      analysisTips: [
        'All three countries experienced a steady upward trend over the decade.',
        'Canada and the USA consistently led with usage rates above 70-80%.',
        'Mexico grew the fastest, more than doubling from 30% to nearly 70%.',
      ],
      keyVocabulary: [
        { word: 'steadily escalated', meaning: 'Increased continuously and consistently' },
        { word: 'remained dominant', meaning: 'Held the leading position throughout' },
        { word: 'narrowed the disparity', meaning: 'Reduced the gap between countries' },
      ],
      sampleAnswer: `The line graph illustrates the proportion of citizens utilizing the internet across three North American nations—the United States, Canada, and Mexico—over a decade from 2010 to 2020.

Overall, internet penetration experienced significant growth in all three countries throughout the period. While Canada and the USA consistently maintained the highest usage rates, Mexico demonstrated the most dramatic surge, substantially narrowing the gap with its northern neighbors.

In 2010, internet access was most prevalent in the United States, where approximately 72% of the population used the web, slightly ahead of Canada at around 68%. Over the subsequent ten years, both countries followed a similar upward trajectory. Canada overtook the US around 2015, with both nations eventually finishing the decade with roughly 88% and 86% of their populations using the internet respectively.

Meanwhile, Mexico commenced the period with a markedly lower proportion of approximately 30% in 2010. However, this figure rose sharply and continuously, surpassing the 50% milestone by 2016 and ultimately reaching nearly 70% by 2020, representing more than a twofold increase over the ten-year timeframe.`,
    },
    task2: {
      id: 'writing_test_2_task2',
      taskNumber: 2,
      title: 'Task 2: Remote Work vs Office Attendance',
      recommendedMinutes: 40,
      minWords: 250,
      chartType: 'none',
      prompt:
        'In many countries, an increasing number of people are choosing to work from home rather than in a traditional office. Do the advantages of this trend outweigh the disadvantages?',
      analysisTips: [
        'Essay Type: Advantages vs Disadvantages (Outweigh Essay).',
        'Advantages: Eliminates commuting time, improves work-life balance, and reduces office overhead costs for companies.',
        'Disadvantages: Reduces team cohesion, blurs boundaries between work and personal life, and increases feelings of isolation.',
      ],
      keyVocabulary: [
        { word: 'telecommuting / remote working', meaning: 'Working from home via digital tools' },
        { word: 'eliminate commuting times', meaning: 'Remove daily travel time in traffic' },
        { word: 'work-life equilibrium', meaning: 'Healthy balance between career and personal life' },
        { word: 'social isolation', meaning: 'Lack of interpersonal contact with colleagues' },
      ],
      sampleAnswer: `In recent years, the transition toward remote work has accelerated globally, with numerous professionals opting to work from home instead of conventional office environments. While this arrangement introduces notable obstacles regarding team cohesion and personal isolation, I believe that the flexibility and productivity enhancements it offers make the advantages far outweigh the disadvantages.

On the one hand, telecommuting can yield several drawbacks, primarily concerning mental well-being and collaboration. When employees operate in isolation, informal communication, spontaneous brainstorming, and workplace camaraderie are significantly diminished. Furthermore, the absence of a physical boundary between the professional workstation and personal living space frequently causes workers to struggle with switching off, leading to extended working hours and eventual burnout. Studies have also revealed that new employees may experience delays in onboarding and skill acquisition when deprived of immediate in-person mentorship.

On the other hand, the benefits of remote work are profound for both individuals and organizations. Foremost among these is the elimination of daily commuting. By avoiding arduous travel in rush-hour traffic, employees reclaim substantial amounts of time and energy, which can be redirected toward exercise, family commitments, and rest. This heightened flexibility fosters superior job satisfaction and mental well-being. From an employer’s viewpoint, offering remote work reduces commercial real estate overheads and unlocks access to a geographically diverse talent pool, unrestricted by office location. Moreover, contemporary digital tools like video conferencing and project management software have proven that high productivity can be sustained seamlessly outside the office.

To conclude, despite legitimate concerns regarding isolation and communication friction, the autonomy, cost savings, and enhanced work-life balance generated by remote working demonstrate that its benefits overwhelmingly surpass the drawbacks.`,
    },
  },
];

const WRITING_STORAGE_KEY = 'ielts_writing_exams_custom';

export function getAllWritingExams(): WritingExam[] {
  try {
    const raw = localStorage.getItem(WRITING_STORAGE_KEY);
    const custom: WritingExam[] = raw ? JSON.parse(raw) : [];
    const deletedRaw = localStorage.getItem('ielts_writing_exams_deleted');
    const deletedSet: Set<string> = new Set(deletedRaw ? JSON.parse(deletedRaw) : []);

    const map = new Map<string, WritingExam>();
    for (const ex of sampleWritingExams) {
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
    return sampleWritingExams;
  }
}

export function saveWritingExam(exam: WritingExam): void {
  try {
    const deletedRaw = localStorage.getItem('ielts_writing_exams_deleted');
    if (deletedRaw) {
      const deletedSet: Set<string> = new Set(JSON.parse(deletedRaw));
      if (deletedSet.has(exam.id)) {
        deletedSet.delete(exam.id);
        localStorage.setItem('ielts_writing_exams_deleted', JSON.stringify(Array.from(deletedSet)));
      }
    }
    const raw = localStorage.getItem(WRITING_STORAGE_KEY);
    const custom: WritingExam[] = raw ? JSON.parse(raw) : [];
    const idx = custom.findIndex((e) => e.id === exam.id);
    if (idx >= 0) {
      custom[idx] = exam;
    } else {
      custom.push(exam);
    }
    localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(custom));
  } catch (err) {
    console.error('Failed to save writing exam', err);
  }
}

export function deleteWritingExam(id: string): boolean {
  try {
    const deletedRaw = localStorage.getItem('ielts_writing_exams_deleted');
    const deletedSet: Set<string> = new Set(deletedRaw ? JSON.parse(deletedRaw) : []);
    deletedSet.add(id);
    localStorage.setItem('ielts_writing_exams_deleted', JSON.stringify(Array.from(deletedSet)));

    const raw = localStorage.getItem(WRITING_STORAGE_KEY);
    if (raw) {
      const custom: WritingExam[] = JSON.parse(raw);
      const filtered = custom.filter((e) => e.id !== id);
      localStorage.setItem(WRITING_STORAGE_KEY, JSON.stringify(filtered));
    }
    return true;
  } catch (err) {
    console.error('Failed to delete writing exam', err);
    return false;
  }
}

export function restoreDefaultWritingExams(): void {
  try {
    localStorage.removeItem('ielts_writing_exams_deleted');
  } catch (err) {
    console.error('Failed to restore default writing exams', err);
  }
}
