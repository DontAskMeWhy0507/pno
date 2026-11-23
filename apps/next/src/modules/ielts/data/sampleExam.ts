import type { Exam } from '../types/exam';

export const sampleExam: Exam = {
  id: 'vol-9-test-1-reading',
  title: 'VOL 9 TEST 1 READING',
  description: 'Full Academic Reading Test - Real Exam Format (Passage 1: The Baobabs of Madagascar)',
  category: 'IELTS Academic Reading',
  durationMinutes: 60,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isBuiltin: true,
  parts: [
    {
      id: 'part-1',
      partNumber: 1,
      title: 'The Baobabs of Madagascar',
      subtitle: 'The ancient baobabs of Madagascar are some of the largest and most distinctive trees in the world, but they face an uncertain future',
      passage: `The island of Madagascar in the Indian Ocean is the best place in the world to see baobabs. These spectacular trees, with their massive trunks and distinctive horizontal root-like branches, can live over 800 years. Of the eight known species, six are found only there, while a seventh has made its way across the Mozambique Channel from mainland Africa with a certain amount of human help. Some of the most visited and photographed baobabs in Madagascar are at the Avenue des Baobabs in the western province of Menabe, close to the town of Morondava. There, a dozen trees straddle a narrow sandy road, soaring 30 metres into the sky. Known as renala – 'mother of the forest' – in the local Malagasy* language, these trees belong to the tallest baobab species in the world: Adansonia grandidieri, named after two great 19th-century French botanists, Michel Adanson and Alfred Grandidier.

Baobabs have religious and spiritual significance for many Malagasy tribes, although the majority of the island's population will probably never see one – they only grow along the western margin of the island and not in the more populous central highlands. However, as the national tree and the national emblem, the trees are an ideal symbol for increasing awareness not only of the endangered forests, but also of the traditional beliefs of the people who live alongside them. But what does the future hold for the Malagasy baobabs?

The Avenue des Baobabs is something of a contradiction; the 'natural' scene that tourists visit is actually man-made. While the trees themselves are natural enough, the surrounding landscape was created by humans. Back in the early 20th century, much of the Morondava plain was cleared for rice and sugar-cane fields. However, many baobabs were spared because they are valuable as a food source and renewable building material, or they simply survived the fires that were set to clear the dry deciduous forest around them. These days many stand alone in fields, a reminder of where the forest once was. But now it seems that even the mighty baobabs are falling down. 'Every year I see new trees that have fallen,' says Jim Bond, an ethnobotanist who has studied Madagascar's baobabs for more than a decade. The exact cause of the falling baobabs is uncertain, but some people think that the water used to irrigate the nearby fields is partly to blame. Baobabs are adapted to the annual wet season, but their roots can't cope with constantly waterlogged soils. Lone trees separated from the surrounding forest are also susceptible to cyclones, which reach speeds of over 200 kph in the area, and can easily uproot even a 30-metre baobab.

Baobabs elsewhere on the island are also facing a host of threats, with three of the six native species now listed as endangered by the World Conservation Union. David Baum from the University of Wisconsin has spent years researching Malagasy baobabs. 'The main threat to their survival is land clearance for farming, which probably suppresses regeneration,' he says. Burning is the usual method of clearing land, and while baobabs have some resistance to this, they will eventually succumb to repeated burning. Human disturbance in the forest, such as logging, is also a problem. This practice may be promoting the rapid spread of shrubby undergrowth, which quickly fills in the forest gaps needed for baobab germination. Another problem the trees face is the dispersal of their seeds. Baum suggests that dispersal is being limited by the absence of two large, now extinct animals – a gorilla-sized lemur and the three-metre-tall elephant bird. Passage through the digestive tract of these giant fruit-eating animals probably played a vital role in the distribution of the renala baobabs in particular.

The Malagasy government is becoming increasingly concerned as the baobab is key to the local tourism industry, and thus to the economy of the island as a whole. But visiting and photographing the solitary trees in the dramatic open landscape at the Avenue des Baobabs isn't the only way to experience baobabs in Madagascar. Within a few hours' drive of Morondava, three species of baobab can be seen in relatively intact, dry forest habitat. Jim Bond has led expeditions of Malagasy and foreign participants to the Mikea forest in the island's southwest, which is almost certainly one of the least studied and least damaged areas of baobab forest left in Madagascar. On his expeditions Bond works closely with local people to search for, and create maps of baobab distribution. He also plans to compile an illustrated children's book of the many local folk-tales about the tree, hoping that national and international versions will help to spread the word about how important baobabs are in Malagasy culture. But it's going to require some swift and coordinated action to ensure that the baobab becomes a symbol of conservation success, rather than a symbol of humanity's mistakes.`,
      footnotes: '* Malagasy: of Madagascar',
      questionGroups: [
        {
          id: 'p1-g1',
          title: 'Questions 1–6',
          instructions:
            'Choose TRUE if the statement agrees with the information given in the text, choose FALSE if the statement contradicts the information, or choose NOT GIVEN if there is no information on this.',
          questions: [
            {
              id: 'q1',
              orderNumber: 1,
              type: 'TRUE_FALSE_NOT_GIVEN',
              prompt: 'All of the baobab species found on Madagascar are unique to the island.',
              options: [
                { id: 'TRUE', text: 'TRUE' },
                { id: 'FALSE', text: 'FALSE' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'FALSE',
              explanation:
                'Đoạn 1 nêu rõ: "Of the eight known species, six are found only there, while a seventh has made its way across the Mozambique Channel from mainland Africa...". Do có loài thứ 7 đến từ lục địa châu Phi nên không phải tất cả đều độc quyền tại Madagascar.',
            },
            {
              id: 'q2',
              orderNumber: 2,
              type: 'TRUE_FALSE_NOT_GIVEN',
              prompt: 'Adanson and Grandidier were the first foreign botanists to visit Madagascar.',
              options: [
                { id: 'TRUE', text: 'TRUE' },
                { id: 'FALSE', text: 'FALSE' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'NOT GIVEN',
              explanation:
                'Đoạn 1 nhắc đến hai nhà thực vật học này: "named after two great 19th-century French botanists, Michel Adanson and Alfred Grandidier", nhưng không hề đề cập xem họ có phải những nhà thực vật học nước ngoài ĐẦU TIÊN đặt chân đến Madagascar hay không.',
            },
            {
              id: 'q3',
              orderNumber: 3,
              type: 'TRUE_FALSE_NOT_GIVEN',
              prompt: 'The baobab can be found in most areas of Madagascar.',
              options: [
                { id: 'TRUE', text: 'TRUE' },
                { id: 'FALSE', text: 'FALSE' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'FALSE',
              explanation:
                'Đoạn 2 chỉ ra: "...they only grow along the western margin of the island and not in the more populous central highlands." Cây baobab chỉ mọc ở rìa phía tây chứ không phải hầu hết khu vực.',
            },
            {
              id: 'q4',
              orderNumber: 4,
              type: 'TRUE_FALSE_NOT_GIVEN',
              prompt: 'The landscape around the Avenue des Baobabs is the result of agricultural development.',
              options: [
                { id: 'TRUE', text: 'TRUE' },
                { id: 'FALSE', text: 'FALSE' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'TRUE',
              explanation:
                'Đoạn 3 đề cập: "Back in the early 20th century, much of the Morondava plain was cleared for rice and sugar-cane fields...". Khung cảnh này hình thành do con người phát quang trồng lúa và mía.',
            },
            {
              id: 'q5',
              orderNumber: 5,
              type: 'TRUE_FALSE_NOT_GIVEN',
              prompt: 'The baobab provides useful products for the local people.',
              options: [
                { id: 'TRUE', text: 'TRUE' },
                { id: 'FALSE', text: 'FALSE' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'TRUE',
              explanation:
                'Đoạn 3 có viết: "many baobabs were spared because they are valuable as a food source and renewable building material".',
            },
            {
              id: 'q6',
              orderNumber: 6,
              type: 'TRUE_FALSE_NOT_GIVEN',
              prompt: 'Cyclones are the main reason for the falling baobabs.',
              options: [
                { id: 'TRUE', text: 'TRUE' },
                { id: 'FALSE', text: 'FALSE' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'FALSE',
              explanation:
                'Đoạn 3 chỉ ra: "The exact cause of the falling baobabs is uncertain, but some people think that the water used to irrigate the nearby fields is partly to blame... Lone trees separated from the surrounding forest are also susceptible to cyclones". Bão chỉ là một nguy cơ kèm theo chứ không phải nguyên nhân chính khẳng định được.',
            },
          ],
        },
        {
          id: 'p1-g2',
          title: 'Questions 7–13',
          instructions:
            'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          questions: [
            {
              id: 'q7',
              orderNumber: 7,
              type: 'FILL_IN_BLANK',
              prompt: "Baobab roots are unable to survive in soils that are constantly ________.",
              correctAnswer: 'waterlogged',
              acceptableAnswers: ['waterlogged soils', 'water-logged'],
              explanation: 'Đoạn 3: "...their roots can\'t cope with constantly waterlogged soils."',
            },
            {
              id: 'q8',
              orderNumber: 8,
              type: 'FILL_IN_BLANK',
              prompt: 'David Baum identifies ________ as the greatest danger to the survival of baobabs.',
              correctAnswer: 'land clearance',
              acceptableAnswers: ['farming', 'land clearance for farming'],
              explanation: 'Đoạn 4: "\'The main threat to their survival is land clearance for farming...\'"',
            },
            {
              id: 'q9',
              orderNumber: 9,
              type: 'FILL_IN_BLANK',
              prompt: 'The germination of baobabs is hindered by the growth of ________ after logging.',
              correctAnswer: 'shrubby undergrowth',
              acceptableAnswers: ['undergrowth'],
              explanation: 'Đoạn 4: "...the rapid spread of shrubby undergrowth, which quickly fills in the forest gaps needed for baobab germination."',
            },
            {
              id: 'q10',
              orderNumber: 10,
              type: 'FILL_IN_BLANK',
              prompt: 'In the past, seeds were spread with the help of a large lemur and the ________.',
              correctAnswer: 'elephant bird',
              acceptableAnswers: ['the elephant bird'],
              explanation: 'Đoạn 4: "...a gorilla-sized lemur and the three-metre-tall elephant bird."',
            },
            {
              id: 'q11',
              orderNumber: 11,
              type: 'FILL_IN_BLANK',
              prompt: 'The baobab plays an essential part in the island’s ________ industry.',
              correctAnswer: 'tourism',
              acceptableAnswers: ['local tourism'],
              explanation: 'Đoạn 5: "...the baobab is key to the local tourism industry..."',
            },
            {
              id: 'q12',
              orderNumber: 12,
              type: 'FILL_IN_BLANK',
              prompt: 'Jim Bond has investigated baobab trees in the ________ forest in southwestern Madagascar.',
              correctAnswer: 'Mikea',
              acceptableAnswers: ['Mikea forest'],
              explanation: 'Đoạn 5: "Jim Bond has led expeditions of Malagasy and foreign participants to the Mikea forest in the island\'s southwest..."',
            },
            {
              id: 'q13',
              orderNumber: 13,
              type: 'FILL_IN_BLANK',
              prompt: 'Bond intends to produce an illustrated ________ book inspired by folk stories.',
              correctAnswer: "children's",
              acceptableAnswers: ["children's book", 'children'],
              explanation: 'Đoạn 5: "He also plans to compile an illustrated children\'s book of the many local folk-tales..."',
            },
          ],
        },
      ],
    },
    {
      id: 'part-2',
      partNumber: 2,
      title: 'Biomimicry in Architecture',
      subtitle: 'How modern architects are looking to nature for innovative engineering and sustainable design solutions',
      passage: `Paragraph A
Architecture has historically drawn aesthetic inspiration from nature, mimicking the forms of leaves, shells, and waves in decorative facades. However, in recent decades, a revolutionary paradigm has emerged: biomimicry. Unlike traditional ornamentation, biomimicry focuses not on what nature looks like, but on how nature functions. Designers and structural engineers are investigating biological mechanisms refined over 3.8 billion years of evolution to tackle energy inefficiency, structural weight, and carbon emissions in the built environment.

Paragraph B
One of the earliest and most celebrated exemplars of architectural biomimicry is the Eastgate Centre in Harare, Zimbabwe, conceived by architect Mick Pearce. In a subtropical climate where daytime temperatures routinely exceed 35 degrees Celsius, conventional office buildings rely on energy-hungry air conditioning systems. Pearce sought an alternative by examining macrotermes michaelseni, a species of termite that erects towering mud mounds. Despite outside temperature swings of up to 40 degrees, termites keep their internal fungal gardens at a steady 30 degrees Celsius through an intricate network of low-level passive ventilation vents and chimneys. By replicating this convective draft mechanism using concrete slabs that absorb heat by day and release it into circulating night air, Eastgate consumes 90 percent less energy than conventional complexes of comparable size.

Paragraph C
In London, the 30 St Mary Axe skyscraper, affectionately nicknamed "The Gherkin" and designed by Foster + Partners, looked to the marine realm for structural efficiency. The inspiration was Euplectella aspergillum, commonly known as the Venus flower basket sponge. This deep-sea creature withstands ferocious ocean currents and crushing hydrostatic pressure despite having an intricate silica skeleton. By adopting the sponge's cylindrical lattice structure and triangular spiraling diagrid, the building distributes aerodynamic wind loads evenly across its exterior shell, eliminating the need for heavy internal load-bearing columns and dramatically reducing steel requirements by 21 percent.

Paragraph D
Water conservation presents another frontier for biomimetic design. The Namib Desert beetle (Stenocara gracilipes) survives in one of the most arid landscapes on Earth by harvesting atmospheric moisture from morning ocean fog. The beetle’s back is covered in microscopic hydrophilic (water-attracting) bumps alternating with hydrophobic (water-repelling) waxy troughs. As fog passes over the tilted beetle, condensation coalesces into water droplets that roll straight into its mouth. Inspired by this mechanism, architectural researchers at Grimshaw Architects designed the Seawater Greenhouse in Oman and Tenerife. The facility uses evaporative cooling nets and condensed seawater to grow crops inside enclosed, sun-baked desert greenhouses without consuming freshwater reserves.

Paragraph E
Despite these high-profile triumphs, systemic adoption of biomimicry faces obstacles. The primary impediment is disciplinary estrangement between biology and engineering. Architects are rarely trained to decode dense biological research papers, while biologists are seldom versed in manufacturing tolerances or building codes. To bridge this divide, academic institutions are pioneering interdisciplinary databases and algorithmic generative design tools that match specific engineering dilemmas with relevant evolutionary adaptations. As carbon-neutral mandates tighten worldwide, nature’s blueprint is transitioning from an academic curiosity into an indispensable structural compass.`,
      footnotes: '',
      questionGroups: [
        {
          id: 'p2-g1',
          title: 'Questions 14–18',
          instructions:
            'The reading passage has five paragraphs, A–E. Which paragraph contains the following information? Choose the correct letter, A–E.',
          questions: [
            {
              id: 'q14',
              orderNumber: 14,
              type: 'MATCHING',
              prompt: 'A reference to a structure inspired by an organism capable of gathering moisture in dry climates',
              options: [
                { id: 'A', text: 'Paragraph A' },
                { id: 'B', text: 'Paragraph B' },
                { id: 'C', text: 'Paragraph C' },
                { id: 'D', text: 'Paragraph D' },
                { id: 'E', text: 'Paragraph E' },
              ],
              correctAnswer: 'D',
              explanation: 'Paragraph D nhắc đến bọ cánh cứng sa mạc Namib có thể thu thập hơi ẩm trong sương mù, truyền cảm hứng cho Seawater Greenhouse.',
            },
            {
              id: 'q15',
              orderNumber: 15,
              type: 'MATCHING',
              prompt: 'The reason why biomimetic concepts have not yet become standard in everyday building construction',
              options: [
                { id: 'A', text: 'Paragraph A' },
                { id: 'B', text: 'Paragraph B' },
                { id: 'C', text: 'Paragraph C' },
                { id: 'D', text: 'Paragraph D' },
                { id: 'E', text: 'Paragraph E' },
              ],
              correctAnswer: 'E',
              explanation: 'Paragraph E giải thích rào cản chính (impediment) do sự tách biệt giữa ngành sinh học và kỹ thuật.',
            },
            {
              id: 'q16',
              orderNumber: 16,
              type: 'MATCHING',
              prompt: 'A comparison highlighting the contrast between superficial natural appearance and practical natural function',
              options: [
                { id: 'A', text: 'Paragraph A' },
                { id: 'B', text: 'Paragraph B' },
                { id: 'C', text: 'Paragraph C' },
                { id: 'D', text: 'Paragraph D' },
                { id: 'E', text: 'Paragraph E' },
              ],
              correctAnswer: 'A',
              explanation: 'Paragraph A nhấn mạnh biomimicry tập trung vào "how nature functions" chứ không chỉ "what nature looks like" (trang trí bề ngoài).',
            },
            {
              id: 'q17',
              orderNumber: 17,
              type: 'MATCHING',
              prompt: 'An example of natural ventilation reducing reliance on artificial cooling systems',
              options: [
                { id: 'A', text: 'Paragraph A' },
                { id: 'B', text: 'Paragraph B' },
                { id: 'C', text: 'Paragraph C' },
                { id: 'D', text: 'Paragraph D' },
                { id: 'E', text: 'Paragraph E' },
              ],
              correctAnswer: 'B',
              explanation: 'Paragraph B mô tả tòa nhà Eastgate Centre bắt chước tổ mối thông gió tự nhiên, giảm 90% năng lượng điều hòa.',
            },
            {
              id: 'q18',
              orderNumber: 18,
              type: 'MATCHING',
              prompt: 'A building whose structural frame allowed significant savings in building materials',
              options: [
                { id: 'A', text: 'Paragraph A' },
                { id: 'B', text: 'Paragraph B' },
                { id: 'C', text: 'Paragraph C' },
                { id: 'D', text: 'Paragraph D' },
                { id: 'E', text: 'Paragraph E' },
              ],
              correctAnswer: 'C',
              explanation: 'Paragraph C đề cập tòa The Gherkin giảm 21% lượng thép nhờ cấu trúc lấy cảm hứng từ bọt biển Venus flower basket.',
            },
          ],
        },
        {
          id: 'p2-g2',
          title: 'Questions 19–22',
          instructions:
            'Choose the correct letter, A, B, C or D.',
          questions: [
            {
              id: 'q19',
              orderNumber: 19,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'The Eastgate Centre in Harare keeps internal temperatures steady primarily by:',
              options: [
                { id: 'A', text: 'utilizing a deep subterranean water cooling reservoir' },
                { id: 'B', text: 'mimicking the passive convective air currents of termite mounds' },
                { id: 'C', text: 'installing solar-powered ventilation fans on each floor' },
                { id: 'D', text: 'using lightweight insulating mud bricks on the exterior' },
              ],
              correctAnswer: 'B',
              explanation: 'Đoạn B: "...replicating this convective draft mechanism using concrete slabs that absorb heat by day and release it into circulating night air...".',
            },
            {
              id: 'q20',
              orderNumber: 20,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'Foster + Partners chose the lattice structure of the Venus flower basket sponge because:',
              options: [
                { id: 'A', text: 'it resisted intense underwater earthquakes' },
                { id: 'B', text: 'it could be produced quickly with recycled glass' },
                { id: 'C', text: 'it effectively diverted and distributed wind pressures' },
                { id: 'D', text: 'it provided thermal insulation against extreme cold' },
              ],
              correctAnswer: 'C',
              explanation: 'Đoạn C: "the building distributes aerodynamic wind loads evenly across its exterior shell".',
            },
            {
              id: 'q21',
              orderNumber: 21,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'The Namib Desert beetle is able to drink moisture because its back features:',
              options: [
                { id: 'A', text: 'porous cavities that absorb underground dew' },
                { id: 'B', text: 'alternating water-attracting bumps and water-repelling channels' },
                { id: 'C', text: 'flexible spines that trap morning precipitation' },
                { id: 'D', text: 'electrochemical sensors that detect oncoming cloud cover' },
              ],
              correctAnswer: 'B',
              explanation: 'Đoạn D: "microscopic hydrophilic (water-attracting) bumps alternating with hydrophobic (water-repelling) waxy troughs."',
            },
            {
              id: 'q22',
              orderNumber: 22,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'According to the author, the biggest hurdle to widespread biomimicry adoption is:',
              options: [
                { id: 'A', text: 'the absence of communication and joint training between biologists and engineers' },
                { id: 'B', text: 'excessive cost restrictions imposed by municipal authorities' },
                { id: 'C', text: 'unfavorable consumer reactions toward unorthodox building shapes' },
                { id: 'D', text: 'a lack of evolutionary species left in urban environments' },
              ],
              correctAnswer: 'A',
              explanation: 'Đoạn E: "The primary impediment is disciplinary estrangement between biology and engineering."',
            },
          ],
        },
        {
          id: 'p2-g3',
          title: 'Questions 23–26',
          instructions:
            'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          questions: [
            {
              id: 'q23',
              orderNumber: 23,
              type: 'FILL_IN_BLANK',
              prompt: 'Rather than copying visual forms, modern biomimetic architecture focuses on how nature ________.',
              correctAnswer: 'functions',
              acceptableAnswers: ['functions'],
              explanation: 'Đoạn A: "biomimicry focuses not on what nature looks like, but on how nature functions."',
            },
            {
              id: 'q24',
              orderNumber: 24,
              type: 'FILL_IN_BLANK',
              prompt: 'Termites manage to sustain their internal ________ at an even 30 degrees Celsius.',
              correctAnswer: 'fungal gardens',
              acceptableAnswers: ['gardens'],
              explanation: 'Đoạn B: "termites keep their internal fungal gardens at a steady 30 degrees Celsius".',
            },
            {
              id: 'q25',
              orderNumber: 25,
              type: 'FILL_IN_BLANK',
              prompt: 'The design of 30 St Mary Axe eliminated internal load-bearing columns and decreased the amount of ________ required.',
              correctAnswer: 'steel',
              acceptableAnswers: ['steel requirements'],
              explanation: 'Đoạn C: "...dramatically reducing steel requirements by 21 percent."',
            },
            {
              id: 'q26',
              orderNumber: 26,
              type: 'FILL_IN_BLANK',
              prompt: 'To connect biological science and structural design, researchers are formulating ________ tools.',
              correctAnswer: 'algorithmic generative design',
              acceptableAnswers: ['generative design', 'algorithmic design'],
              explanation: 'Đoạn E: "...algorithmic generative design tools that match specific engineering dilemmas with relevant evolutionary adaptations."',
            },
          ],
        },
      ],
    },
    {
      id: 'part-3',
      partNumber: 3,
      title: 'The Neuroscience of Bilingualism',
      subtitle: 'Research into how managing multiple linguistic systems reshapes cognitive architecture throughout human life',
      passage: `Paragraph 1
For much of the twentieth century, conventional pedagogical consensus regarded childhood bilingualism with distinct skepticism. Early studies, frequently compromised by methodological flaws such as conflating language acquisition with socioeconomic disadvantage, asserted that mastering two tongues overburdened the youthful mind. It was widely feared that linguistic interference would retard cognitive development, induce permanent conceptual confusion, and stunt vocabulary growth in both languages. However, contemporary neuroimaging technologies, paired with longitudinal cognitive testing, have thoroughly demolished this historical prejudice. Today, bilingualism is celebrated not as a developmental impediment, but as one of the most potent stimuli for neural plasticity.

Paragraph 2
The core cognitive difference between monolingual and multilingual individuals stems from how the brain stores and retrieves linguistic codes. Landmark functional Magnetic Resonance Imaging (fMRI) studies led by Dr. Ellen Bialystok have proven that when a bilingual person speaks, both language systems remain simultaneously active in the cortex. For instance, when a French-English speaker prepares to utter the word "table," the French equivalent "table" (pronounced differently) and associated lexical networks are activated concurrently. To prevent catastrophic linguistic interference and produce the intended word seamlessly, the brain must continuously deploy an internal monitoring mechanism: the executive control system.

Paragraph 3
The executive control network—headquartered in the prefrontal cortex, anterior cingulate cortex, and basal ganglia—orchestrates higher-order cognitive faculties. These include inhibitory control (suppressing irrelevant impulses), attentional shifting (toggling focus between disparate tasks), and working memory manipulation. Because bilinguals must continuously suppress one language while operating in another, this neural circuitry undergoes lifelong mental resistance training. Extensive behavioral trials demonstrate that bilingual children and adults consistently outperform monolinguals on non-linguistic executive functioning benchmarks, such as the famous Simon Spatial Task and the Stroop Color-Word test, where participants must resolve conflicting perceptual cues under strict timing constraints.

Paragraph 4
Furthermore, this persistent cognitive workout induces demonstrable neuroanatomical alterations. High-resolution diffusion tensor imaging reveals that long-term bilinguals possess significantly greater grey matter density in the inferior parietal cortex, an area integral to language processing and spatial orientation. Concurrently, white matter integrity—the insulated axonal conduits facilitating rapid communication between disparate cerebral lobes—remains noticeably sturdier in elderly bilinguals compared to age-matched monolinguals. Essentially, the structural "wiring" of the brain exhibits heightened resilience against age-related degeneration.

Paragraph 5
Perhaps the most profound societal implication of bilingualism is its contribution to "cognitive reserve"—the brain's capacity to improvise alternative problem-solving pathways and sustain normal functionality despite physical neuropathology. Seminal epidemiological investigations led by neurologist Thomas Bak across thousands of clinical patients revealed that lifelong bilinguals develop clinical symptoms of neurodegenerative disorders, notably Alzheimer's disease, approximately four to five years later than monolinguals with identical degrees of brain atrophy. While bilingualism cannot prevent the physical accumulation of amyloid plaques and tau tangles, it constructs resilient neural bypasses that keep the mind lucid for substantially longer.

Paragraph 6
Nevertheless, cognitive researchers caution against portraying bilingualism as an infallible panacea. When tested on single-language verbal fluency tasks (such as naming as many animals as possible within sixty seconds), bilinguals occasionally achieve slightly lower average scores than monolinguals, presumably due to the cognitive overhead of filtering a vastly larger mental lexicon. Yet in an interconnected global society, this nominal linguistic trade-off is vastly eclipsed by the profound neuroprotective, attentional, and cultural dividends that lifelong multilingualism confers.`,
      footnotes: '',
      questionGroups: [
        {
          id: 'p3-g1',
          title: 'Questions 27–32',
          instructions:
            'Do the following statements agree with the claims of the writer in the text? Choose YES if the statement agrees with the claims of the writer, choose NO if the statement contradicts the claims of the writer, or choose NOT GIVEN if it is impossible to say what the writer thinks about this.',
          questions: [
            {
              id: 'q27',
              orderNumber: 27,
              type: 'YES_NO_NOT_GIVEN',
              prompt: 'Twentieth-century studies on childhood bilingualism were often undermined by flawed research methods.',
              options: [
                { id: 'YES', text: 'YES' },
                { id: 'NO', text: 'NO' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'YES',
              explanation: 'Đoạn 1: "...frequently compromised by methodological flaws such as conflating language acquisition with socioeconomic disadvantage...".',
            },
            {
              id: 'q28',
              orderNumber: 28,
              type: 'YES_NO_NOT_GIVEN',
              prompt: 'A bilingual speaker’s dormant language is completely deactivated when talking in another language.',
              options: [
                { id: 'YES', text: 'YES' },
                { id: 'NO', text: 'NO' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'NO',
              explanation: 'Đoạn 2: "...proven that when a bilingual person speaks, both language systems remain simultaneously active in the cortex." Cả hai hệ thống đều kích hoạt chứ không hề bị tắt hoàn toàn.',
            },
            {
              id: 'q29',
              orderNumber: 29,
              type: 'YES_NO_NOT_GIVEN',
              prompt: 'Monolinguals generally perform faster on non-verbal inhibitory tests than bilinguals.',
              options: [
                { id: 'YES', text: 'YES' },
                { id: 'NO', text: 'NO' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'NO',
              explanation: 'Đoạn 3: "...bilingual children and adults consistently outperform monolinguals on non-linguistic executive functioning benchmarks...". Người song ngữ vượt trội hơn.',
            },
            {
              id: 'q30',
              orderNumber: 30,
              type: 'YES_NO_NOT_GIVEN',
              prompt: 'Diffusion tensor imaging is cheaper to conduct than functional magnetic resonance imaging.',
              options: [
                { id: 'YES', text: 'YES' },
                { id: 'NO', text: 'NO' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'NOT GIVEN',
              explanation: 'Bài viết đề cập cả hai công nghệ fMRI và diffusion tensor imaging nhưng không so sánh chi phí giữa chúng.',
            },
            {
              id: 'q31',
              orderNumber: 31,
              type: 'YES_NO_NOT_GIVEN',
              prompt: 'Bilingualism prevents the physical build-up of amyloid plaques in the brain.',
              options: [
                { id: 'YES', text: 'YES' },
                { id: 'NO', text: 'NO' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'NO',
              explanation: 'Đoạn 5: "While bilingualism cannot prevent the physical accumulation of amyloid plaques and tau tangles, it constructs resilient neural bypasses...".',
            },
            {
              id: 'q32',
              orderNumber: 32,
              type: 'YES_NO_NOT_GIVEN',
              prompt: 'Bilingual individuals may produce slightly fewer words during rapid single-language fluency tests.',
              options: [
                { id: 'YES', text: 'YES' },
                { id: 'NO', text: 'NO' },
                { id: 'NOT GIVEN', text: 'NOT GIVEN' },
              ],
              correctAnswer: 'YES',
              explanation: 'Đoạn 6: "...bilinguals occasionally achieve slightly lower average scores than monolinguals, presumably due to the cognitive overhead of filtering a vastly larger mental lexicon."',
            },
          ],
        },
        {
          id: 'p3-g2',
          title: 'Questions 33–36',
          instructions: 'Choose the correct letter, A, B, C or D.',
          questions: [
            {
              id: 'q33',
              orderNumber: 33,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'The brain manages dual-language competition primarily through the actions of:',
              options: [
                { id: 'A', text: 'the sensory auditory cortex' },
                { id: 'B', text: 'the executive control system' },
                { id: 'C', text: 'the visual occipital lobe' },
                { id: 'D', text: 'the peripheral motor nervous system' },
              ],
              correctAnswer: 'B',
              explanation: 'Đoạn 2: "...the brain must continuously deploy an internal monitoring mechanism: the executive control system."',
            },
            {
              id: 'q34',
              orderNumber: 34,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'Research into brain anatomy revealed that sustained bilingualism leads to:',
              options: [
                { id: 'A', text: 'a reduction in overall skull volume' },
                { id: 'B', text: 'diminished neural pathways across the corpus callosum' },
                { id: 'C', text: 'greater grey matter density in the inferior parietal cortex' },
                { id: 'D', text: 'temporary suppression of white matter axonal signals' },
              ],
              correctAnswer: 'C',
              explanation: 'Đoạn 4: "...significantly greater grey matter density in the inferior parietal cortex...".',
            },
            {
              id: 'q35',
              orderNumber: 35,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'Thomas Bak’s research on Alzheimer’s patients showed that bilingualism:',
              options: [
                { id: 'A', text: 'delayed the onset of visible symptoms by 4 to 5 years' },
                { id: 'B', text: 'completely eradicated tau protein accumulation' },
                { id: 'C', text: 'only aided patients under forty years of age' },
                { id: 'D', text: 'reversed memory loss after clinical diagnosis' },
              ],
              correctAnswer: 'A',
              explanation: 'Đoạn 5: "...develop clinical symptoms of neurodegenerative disorders... approximately four to five years later than monolinguals".',
            },
            {
              id: 'q36',
              orderNumber: 36,
              type: 'MULTIPLE_CHOICE_SINGLE',
              prompt: 'What is the overall tone of the writer regarding bilingualism?',
              options: [
                { id: 'A', text: 'Deeply critical and cautious of educational harms' },
                { id: 'B', text: 'Strongly positive while acknowledging minor lexical trade-offs' },
                { id: 'C', text: 'Dismissive of modern neuroimaging technologies' },
                { id: 'D', text: 'Neutral with no clear stance' },
              ],
              correctAnswer: 'B',
              explanation: 'Toàn bài tác giả khen ngợi lợi ích to lớn của song ngữ (neuroplasticity, cognitive reserve) dù thừa nhận một hạn chế nhỏ ở đoạn 6.',
            },
          ],
        },
        {
          id: 'p3-g3',
          title: 'Questions 37–40',
          instructions:
            'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
          questions: [
            {
              id: 'q37',
              orderNumber: 37,
              type: 'FILL_IN_BLANK',
              prompt: 'Bilingualism is recognized as an effective catalyst for neural ________.',
              correctAnswer: 'plasticity',
              acceptableAnswers: ['plasticity'],
              explanation: 'Đoạn 1: "...one of the most potent stimuli for neural plasticity."',
            },
            {
              id: 'q38',
              orderNumber: 38,
              type: 'FILL_IN_BLANK',
              prompt: 'The executive control network helps individuals suppress unnecessary ________ during tasks.',
              correctAnswer: 'impulses',
              acceptableAnswers: ['impulses', 'irrelevant impulses'],
              explanation: 'Đoạn 3: "...inhibitory control (suppressing irrelevant impulses)..."',
            },
            {
              id: 'q39',
              orderNumber: 39,
              type: 'FILL_IN_BLANK',
              prompt: 'In older bilingual adults, the integrity of ________ is preserved more effectively than in monolinguals.',
              correctAnswer: 'white matter',
              acceptableAnswers: ['white matter integrity'],
              explanation: 'Đoạn 4: "Concurrently, white matter integrity... remains noticeably sturdier in elderly bilinguals..."',
            },
            {
              id: 'q40',
              orderNumber: 40,
              type: 'FILL_IN_BLANK',
              prompt: 'The ability of the brain to form alternative neural routes despite damage is known as cognitive ________.',
              correctAnswer: 'reserve',
              acceptableAnswers: ['cognitive reserve', 'reserve'],
              explanation: 'Đoạn 5: "...its contribution to \'cognitive reserve\'—the brain\'s capacity to improvise alternative problem-solving pathways..."',
            },
          ],
        },
      ],
    },
  ],
};
