import type { WritingExam } from '../types/writing';

export const sampleWritingExams: WritingExam[] = [
  {
    id: 'writing_test_1',
    title: 'IELTS Writing Test 1 (UK Expenditure & Higher Education)',
    collection: 'IELTS Actual Tests',
    durationMinutes: 60,
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now() - 1000000,
    task1: {
      id: 'writing_test_1_task1',
      taskNumber: 1,
      title: 'Task 1: UK Resident Spending Patterns 2004',
      recommendedMinutes: 20,
      minWords: 150,
      chartType: 'bar',
      prompt:
        'The chart below shows the expenditure on three categories among different age groups of residents in the UK in 2004. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
      analysisTips: [
        'Nhóm tuổi lớn nhất (76+) và nhóm 61-75 chi tiêu nhiều nhất cho Food and Drink.',
        'Nhóm trẻ tuổi nhất (Under 30) chi tiêu cao nhất cho Restaurant and Hotel (14%).',
        'Chi tiêu cho Entertainment đạt đỉnh ở nhóm tuổi 61-75 (23%).',
        'Phần Overview cần nêu bật 2 xu hướng chính: Food & Drink tăng theo độ tuổi, trong khi Restaurant & Hotel giảm dần.',
      ],
      keyVocabulary: [
        { word: 'expenditure / spending allocation', meaning: 'Khoản chi tiêu / phân bổ chi tiêu' },
        { word: 'peaked at / reached a pinnacle of', meaning: 'Đạt đỉnh tại mức...' },
        { word: 'in sharp contrast to', meaning: 'Tương phản rõ rệt với' },
        { word: 'allocated approximately', meaning: 'Dành ra khoảng...' },
        { word: 'accounted for a mere 2%', meaning: 'Chỉ chiếm vỏn vẹn 2%' },
        { word: 'grew progressively', meaning: 'Tăng dần đều đặn qua các nhóm' },
      ],
      sampleAnswer: `The bar chart compares the percentage of total spending allocated to food and drink, restaurants and hotels, and entertainment across five age demographics in the United Kingdom in 2004.

Overall, expenditure on food and drink displayed a steady upward trajectory with age, whereas the proportion spent on restaurants and hotels was highest among the youngest citizens. Furthermore, residents aged between 61 and 75 committed the largest share of their expenditure to entertainment.

Looking at food and drink, UK residents under 30 spent only roughly 6% of their income in this area. This proportion increased consistently through the intermediate age brackets, ultimately reaching a peak of approximately 23% among those aged 76 and over. In sharp contrast, spending on restaurants and hotels exhibited an inverse pattern: individuals under 30 dedicated around 14% of their budget to this category, compared to a mere 2% for the 61-75 group and approximately 7% for the oldest demographic.

Regarding entertainment, spending levels fluctuated substantially. The under-30 and 31-45 cohorts spent modest proportions of approximately 7% and 8% respectively. This figure then rose to 14% for people aged 46 to 60, before climbing to a zenith of 23% in the 61-75 age group. Finally, entertainment spending declined noticeably to 13% for residents aged 76 and above.`,
    },
    task2: {
      id: 'writing_test_1_task2',
      taskNumber: 2,
      title: 'Task 2: Free University Education vs Paid Tuition',
      recommendedMinutes: 40,
      minWords: 250,
      chartType: 'none',
      prompt:
        'Some people think that university education should be free for everyone. Others think that students should pay for their higher education. Discuss both views and give your own opinion.',
      analysisTips: [
        'Dạng bài: Discussion Essay (Thảo luận 2 quan điểm + Đưa ra ý kiến cá nhân).',
        'Body 1: Lập luận vì sao một số người ủng hộ miễn học phí (Bình đẳng cơ hội, giảm gánh nặng nợ nần, phát triển nhân lực quốc gia).',
        'Body 2: Lập luận vì sao nên thu học phí (Giảm áp lực ngân sách nhà nước, nâng cao tính tự giác và chất lượng giảng dạy).',
        'Kết bài: Tóm tắt quan điểm cân bằng (Học phí có trợ cấp hoặc học bổng cho sinh viên hoàn cảnh khó khăn).',
      ],
      keyVocabulary: [
        { word: 'tertiary education / higher education', meaning: 'Giáo dục đại học' },
        { word: 'financial burden', meaning: 'Gánh nặng tài chính' },
        { word: 'equal access to opportunities', meaning: 'Cơ hội tiếp cận bình đẳng' },
        { word: 'subsidise / state subsidies', meaning: 'Trợ cấp nhà nước' },
        { word: 'fiscal strain on public funds', meaning: 'Áp lực tài khóa lên ngân sách công' },
        { word: 'merit-based scholarship', meaning: 'Học bổng dựa trên thành tích' },
      ],
      sampleAnswer: `The debate over whether higher education should be provided free of charge or financed by students themselves has sparked considerable controversy. While there are convincing arguments that tertiary education ought to be publicly funded, I believe that students should contribute financially to their studies, complemented by state-supported scholarships for underprivileged individuals.

On the one hand, proponents of free university education emphasize social equality and national development. When universities abolish tuition fees, students from economically disadvantaged backgrounds are not deterred by crippling student debts. This fosters equal opportunities and ensures that tertiary enrollment is determined purely by merit and academic potential rather than socio-economic status. Furthermore, a highly educated workforce directly benefits society as graduates contribute higher tax revenues, drive scientific and technological innovations, and bolster economic productivity. Countries such as Norway and Germany exemplify how state-funded universities cultivate a thriving, knowledgeable populace.

On the other hand, financing university education entirely through public funds poses severe fiscal challenges. Providing free higher education places immense strain on state budgets, often forcing governments to raise income taxes or divert essential funding from primary education and public healthcare. Moreover, when students invest their own financial resources into higher education, they tend to exhibit greater diligence and dedication toward their coursework. Charging tuition also provides universities with substantial independent revenue, allowing institutions to invest in state-of-the-art laboratory facilities, recruit world-class professors, and maintain high academic standards.

In conclusion, although free higher education promotes equal access for all citizens, the economic burden on governments makes universal free tuition unsustainable. In my view, a hybrid model in which students pay reasonable tuition fees alongside government-backed loans and generous scholarships for underprivileged students represents the most equitable and pragmatic solution.`,
    },
  },
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
        'Cả 3 nước đều có xu hướng tăng đều đặn qua các năm.',
        'Canada và USA luôn dẫn đầu với tỉ lệ trên 70-80%.',
        'Mexico tăng trưởng nhanh nhất từ 30% lên gần 70%.',
      ],
      keyVocabulary: [
        { word: 'steadily escalated', meaning: 'Tăng đều đặn' },
        { word: 'remained dominant', meaning: 'Giữ vị trí áp đảo' },
        { word: 'narrowed the disparity', meaning: 'Thu hẹp khoảng cách' },
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
        'Dạng bài: Advantages vs Disadvantages.',
        'Ưu điểm: Tiết kiệm thời gian di chuyển, cân bằng công việc - gia đình, tiết kiệm chi phí văn phòng cho doanh nghiệp.',
        'Nhược điểm: Giảm tính gắn kết đồng đội, khó tách biệt công việc và cuộc sống cá nhân, cảm giác cô lập.',
      ],
      keyVocabulary: [
        { word: 'telecommuting / remote working', meaning: 'Làm việc từ xa' },
        { word: 'eliminate commuting times', meaning: 'Xóa bỏ thời gian đi lại tắc đường' },
        { word: 'work-life equilibrium', meaning: 'Sự cân bằng công việc - cuộc sống' },
        { word: 'social isolation', meaning: 'Cảm giác cô lập xã hội' },
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
