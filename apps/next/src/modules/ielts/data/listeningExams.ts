import type { Exam } from '../types/exam';

// ─── IELTS Listening Sample Tests ────────────────────────────────────────────
// These are representative IELTS Listening practice tests.
// Each exam has 4 sections × 10 questions = 40 questions total.
// The "passage" field holds the section transcript/context notes visible to the student.
// audioUrl can be set to an MP3 link when available.

export const sampleListeningExams: Exam[] = [
  {
    id: 'listening_sample_1',
    title: 'IELTS Listening Practice Test 1',
    description: 'Full IELTS Academic Listening test — 4 sections, 40 questions. Covers form completion, multiple choice, matching, and sentence completion.',
    durationMinutes: 30,
    category: 'IELTS Listening',
    collection: 'IELTS Listening',
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    parts: [
      // ─────────────────────────────────────────────────────────────
      // SECTION 1 — Social/everyday conversation (Questions 1–10)
      // ─────────────────────────────────────────────────────────────
      {
        id: 'l1s1',
        partNumber: 1,
        title: 'Section 1 — Leisure Centre Membership',
        subtitle: 'A conversation between a new member and a leisure centre receptionist.',
        passage: `[SECTION CONTEXT]\nA woman (Sarah) is calling the Greenwood Leisure Centre to enquire about and sign up for membership. She speaks with Tom, the receptionist.\n\nListen and answer Questions 1–10.\n\nQuestions 1–6: Complete the membership form below.\nQuestions 7–10: Choose the correct letter A, B or C.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l1s1g1',
            title: 'Questions 1–6',
            instructions: 'Complete the membership form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
            sharedContent: `GREENWOOD LEISURE CENTRE — New Member Registration

Full Name: Sarah {{1}}
Date of Birth: {{2}} March 1994
Address: {{3}} Oakfield Road, Birmingham
Postcode: {{4}}
Telephone: {{5}}
Membership Type: {{6}}`,
            wordBank: [],
            questions: [
              { id: 'l1s1q1', orderNumber: 1, type: 'FILL_IN_BLANK', prompt: 'Full Name: Sarah ________', correctAnswer: 'Mitchell', explanation: 'The receptionist confirms the surname "Mitchell" and asks Sarah to spell it.' },
              { id: 'l1s1q2', orderNumber: 2, type: 'FILL_IN_BLANK', prompt: 'Date of Birth: ________ March 1994', correctAnswer: '14th / 14', explanation: 'Sarah says her birthday is the fourteenth of March.' },
              { id: 'l1s1q3', orderNumber: 3, type: 'FILL_IN_BLANK', prompt: 'Address: ________ Oakfield Road', correctAnswer: '27', explanation: 'Sarah gives her house number as twenty-seven.' },
              { id: 'l1s1q4', orderNumber: 4, type: 'FILL_IN_BLANK', prompt: 'Postcode: ________', correctAnswer: 'B14 6RQ', explanation: 'The receptionist repeats back "B14 6RQ" and Sarah confirms.' },
              { id: 'l1s1q5', orderNumber: 5, type: 'FILL_IN_BLANK', prompt: 'Telephone: ________', correctAnswer: '07823 441 990', explanation: 'Sarah gives her mobile number as 07823 441 990.' },
              { id: 'l1s1q6', orderNumber: 6, type: 'FILL_IN_BLANK', prompt: 'Membership Type: ________', correctAnswer: 'Gold / Gold membership', explanation: 'Tom recommends the Gold membership and Sarah agrees to take it.' },
            ],
          },
          {
            id: 'l1s1g2',
            title: 'Questions 7–10',
            instructions: 'Choose the correct letter, A, B or C.',
            questions: [
              {
                id: 'l1s1q7', orderNumber: 7, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What is included in the Gold membership that is NOT in the Silver membership?',
                options: [{ id: 'A', text: 'Swimming pool access' }, { id: 'B', text: 'Personal training sessions' }, { id: 'C', text: 'Fitness classes' }],
                correctAnswer: 'B',
                explanation: 'Tom explains that Gold members receive two free personal training sessions per month, which Silver members do not get.',
              },
              {
                id: 'l1s1q8', orderNumber: 8, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'How much does the Gold membership cost per month?',
                options: [{ id: 'A', text: '£35' }, { id: 'B', text: '£45' }, { id: 'C', text: '£55' }],
                correctAnswer: 'C',
                explanation: 'Tom says the Gold membership is fifty-five pounds a month.',
              },
              {
                id: 'l1s1q9', orderNumber: 9, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'When can Sarah collect her membership card?',
                options: [{ id: 'A', text: 'The same day she calls' }, { id: 'B', text: 'The following day' }, { id: 'C', text: 'Within three working days' }],
                correctAnswer: 'B',
                explanation: 'Tom says her card will be ready to collect tomorrow, i.e. the following day.',
              },
              {
                id: 'l1s1q10', orderNumber: 10, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What does Sarah need to bring when she collects her card?',
                options: [{ id: 'A', text: 'A passport photo' }, { id: 'B', text: 'Proof of address' }, { id: 'C', text: 'Her bank card' }],
                correctAnswer: 'B',
                explanation: 'Tom asks Sarah to bring proof of address, such as a utility bill.',
              },
            ],
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // SECTION 2 — Monologue / public talk (Questions 11–20)
      // ─────────────────────────────────────────────────────────────
      {
        id: 'l1s2',
        partNumber: 2,
        title: 'Section 2 — City Heritage Walking Tour',
        subtitle: 'A tour guide describes a self-guided walking tour of a historic city district.',
        passage: `[SECTION CONTEXT]\nA tour guide is presenting information about a free self-guided walking tour of Hartfield city centre to a group of visitors.\n\nListen and answer Questions 11–20.\n\nQuestions 11–15: Complete the notes below.\nQuestions 16–20: Label the map.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l1s2g1',
            title: 'Questions 11–15',
            instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS for each answer.',
            sharedContent: `HARTFIELD HERITAGE WALK — Visitor Notes

Duration of tour: approximately {{11}} hours
Route length: {{12}} km
Starting point: {{13}} Square
Best time to visit: {{14}} mornings (fewer crowds)
Audio guide app: download "{{15}}" before arriving`,
            wordBank: [],
            questions: [
              { id: 'l1s2q11', orderNumber: 11, type: 'FILL_IN_BLANK', prompt: 'Duration: approximately ________ hours', correctAnswer: 'two / 2', explanation: 'The guide says the tour takes approximately two hours to complete at a leisurely pace.' },
              { id: 'l1s2q12', orderNumber: 12, type: 'FILL_IN_BLANK', prompt: 'Route length: ________ km', correctAnswer: '3.5', explanation: 'The guide mentions the route covers three-and-a-half kilometres.' },
              { id: 'l1s2q13', orderNumber: 13, type: 'FILL_IN_BLANK', prompt: 'Starting point: ________ Square', correctAnswer: 'Cathedral / Cathedral Square', explanation: 'The guide instructs visitors to start at Cathedral Square.' },
              { id: 'l1s2q14', orderNumber: 14, type: 'FILL_IN_BLANK', prompt: 'Best time to visit: ________ mornings', correctAnswer: 'weekday', explanation: 'The guide recommends visiting on weekday mornings to avoid weekend crowds.' },
              { id: 'l1s2q15', orderNumber: 15, type: 'FILL_IN_BLANK', prompt: 'Audio guide app: download "________"', correctAnswer: 'Hartfield Heritage / Hartfield Heritage Walk', explanation: 'The guide tells visitors to download the app called "Hartfield Heritage" on their smartphones.' },
            ],
          },
          {
            id: 'l1s2g2',
            title: 'Questions 16–20',
            instructions: 'What is located at each position on the map? Choose FIVE answers from the box and write the correct letter A–H next to Questions 16–20.',
            sharedContent: `Map locations:\n16. Position marked ★ near the river: ________\n17. Building directly opposite Cathedral Square: ________\n18. Large building at the north end of Market Street: ________\n19. Small structure in the park: ________\n20. Building at the corner of Bridge Lane: ________\n\nA. Art Gallery\nB. Old Courthouse\nC. Roman Baths\nD. Covered Market\nE. Clock Tower\nF. Silk Mill\nG. War Memorial\nH. Tourist Information Centre`,
            wordBank: [
              { id: 'A', text: 'Art Gallery' }, { id: 'B', text: 'Old Courthouse' }, { id: 'C', text: 'Roman Baths' },
              { id: 'D', text: 'Covered Market' }, { id: 'E', text: 'Clock Tower' }, { id: 'F', text: 'Silk Mill' },
              { id: 'G', text: 'War Memorial' }, { id: 'H', text: 'Tourist Information Centre' },
            ],
            questions: [
              { id: 'l1s2q16', orderNumber: 16, type: 'MATCHING', prompt: 'Position marked ★ near the river', correctAnswer: 'C', explanation: 'The guide says the Roman Baths are visible beside the river, marked on your map.' },
              { id: 'l1s2q17', orderNumber: 17, type: 'MATCHING', prompt: 'Building directly opposite Cathedral Square', correctAnswer: 'B', explanation: 'The guide identifies the Old Courthouse as the building directly facing Cathedral Square.' },
              { id: 'l1s2q18', orderNumber: 18, type: 'MATCHING', prompt: 'Large building at the north end of Market Street', correctAnswer: 'D', explanation: 'The Covered Market is described as the large Victorian building at the northern end of Market Street.' },
              { id: 'l1s2q19', orderNumber: 19, type: 'MATCHING', prompt: 'Small structure in the park', correctAnswer: 'G', explanation: 'The War Memorial stands in the centre of Riverside Park.' },
              { id: 'l1s2q20', orderNumber: 20, type: 'MATCHING', prompt: 'Building at the corner of Bridge Lane', correctAnswer: 'F', explanation: 'The Silk Mill museum is located at the corner of Bridge Lane and the High Street.' },
            ],
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // SECTION 3 — Academic discussion (Questions 21–30)
      // ─────────────────────────────────────────────────────────────
      {
        id: 'l1s3',
        partNumber: 3,
        title: 'Section 3 — University Research Project',
        subtitle: 'Two students discuss their group project on urban food waste reduction.',
        passage: `[SECTION CONTEXT]\nMia and Daniel are undergraduate students meeting with their tutor to discuss their research project on urban food waste reduction strategies.\n\nListen and answer Questions 21–30.\n\nQuestions 21–24: Choose the correct letter A, B or C.\nQuestions 25–30: Match each strategy with its description.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l1s3g1',
            title: 'Questions 21–24',
            instructions: 'Choose the correct letter, A, B or C.',
            questions: [
              {
                id: 'l1s3q21', orderNumber: 21, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What aspect of food waste does Mia want to focus on?',
                options: [{ id: 'A', text: 'Household waste reduction' }, { id: 'B', text: 'Supermarket surplus redistribution' }, { id: 'C', text: 'Restaurant composting programmes' }],
                correctAnswer: 'B',
                explanation: 'Mia says she is most interested in how supermarkets can donate or redistribute surplus food rather than discarding it.',
              },
              {
                id: 'l1s3q22', orderNumber: 22, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What does Daniel say is the biggest barrier to food waste reduction?',
                options: [{ id: 'A', text: 'Lack of public awareness' }, { id: 'B', text: 'Cost of implementing schemes' }, { id: 'C', text: 'Inadequate legislation' }],
                correctAnswer: 'C',
                explanation: 'Daniel argues that without stronger laws requiring businesses to report waste, voluntary initiatives will remain ineffective.',
              },
              {
                id: 'l1s3q23', orderNumber: 23, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What does the tutor suggest they add to their methodology?',
                options: [{ id: 'A', text: 'Interviews with local businesses' }, { id: 'B', text: 'A comparative international study' }, { id: 'C', text: 'A consumer survey' }],
                correctAnswer: 'A',
                explanation: 'The tutor recommends including semi-structured interviews with managers at local supermarkets and restaurants to gather primary data.',
              },
              {
                id: 'l1s3q24', orderNumber: 24, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'When is the final report due?',
                options: [{ id: 'A', text: 'End of term' }, { id: 'B', text: 'In four weeks' }, { id: 'C', text: 'In six weeks' }],
                correctAnswer: 'C',
                explanation: 'The tutor confirms the submission deadline is in six weeks from the current date.',
              },
            ],
          },
          {
            id: 'l1s3g2',
            title: 'Questions 25–30',
            instructions: 'Which description (A–H) matches each food waste reduction strategy? Write the correct letter A–H next to Questions 25–30. There are more descriptions than strategies, so you will not use all of them.',
            sharedContent: `Strategies:\n25. Community fridges\n26. Dynamic pricing apps\n27. Anaerobic digestion\n28. Gleaning networks\n29. Date label reform\n30. Food banks\n\nDescriptions:\nA. Converts organic waste into biogas and fertiliser\nB. Reduces confusion causing premature disposal of edible food\nC. Allows consumers to buy nearly-expired products at a discount\nD. Recruits volunteers to collect unpicked crops from fields\nE. Provides shared refrigerated space for food donations in neighbourhoods\nF. Connects surplus food with families in financial hardship\nG. Requires businesses to publish annual waste audit reports\nH. Encourages community gardens in urban areas`,
            wordBank: [
              { id: 'A', text: 'Converts organic waste into biogas' },
              { id: 'B', text: 'Reduces confusion about expiry labels' },
              { id: 'C', text: 'Discounted nearly-expired products' },
              { id: 'D', text: 'Volunteers collect unpicked crops' },
              { id: 'E', text: 'Shared refrigerated community space' },
              { id: 'F', text: 'Connects surplus with families in need' },
              { id: 'G', text: 'Mandatory business waste reporting' },
              { id: 'H', text: 'Urban community gardens' },
            ],
            questions: [
              { id: 'l1s3q25', orderNumber: 25, type: 'MATCHING', prompt: 'Community fridges', correctAnswer: 'E', explanation: 'Community fridges are described as shared refrigerated spaces placed in public areas where anyone can leave or take food donations.' },
              { id: 'l1s3q26', orderNumber: 26, type: 'MATCHING', prompt: 'Dynamic pricing apps', correctAnswer: 'C', explanation: 'Dynamic pricing apps allow stores to automatically reduce prices on items approaching their sell-by date to encourage purchase.' },
              { id: 'l1s3q27', orderNumber: 27, type: 'MATCHING', prompt: 'Anaerobic digestion', correctAnswer: 'A', explanation: 'Anaerobic digestion is a biological process that converts food and organic waste into biogas (energy) and digestate (fertiliser).' },
              { id: 'l1s3q28', orderNumber: 28, type: 'MATCHING', prompt: 'Gleaning networks', correctAnswer: 'D', explanation: 'Gleaning networks organise volunteers to harvest produce left in fields after commercial picking, preventing it from going to waste.' },
              { id: 'l1s3q29', orderNumber: 29, type: 'MATCHING', prompt: 'Date label reform', correctAnswer: 'B', explanation: 'Date label reform aims to simplify and standardise "use by" and "best before" labels to reduce premature disposal of safe food.' },
              { id: 'l1s3q30', orderNumber: 30, type: 'MATCHING', prompt: 'Food banks', correctAnswer: 'F', explanation: 'Food banks collect surplus food from retailers and manufacturers and redistribute it to individuals and families in financial hardship.' },
            ],
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // SECTION 4 — Academic lecture (Questions 31–40)
      // ─────────────────────────────────────────────────────────────
      {
        id: 'l1s4',
        partNumber: 4,
        title: 'Section 4 — The Science of Sleep',
        subtitle: 'A university lecture on sleep stages, functions, and the effects of deprivation.',
        passage: `[SECTION CONTEXT]\nA professor delivers a lecture to first-year biology students on the science of sleep, covering REM and non-REM stages, the glymphatic system, and the cognitive effects of chronic sleep deprivation.\n\nListen and answer Questions 31–40.\n\nQuestions 31–40: Complete the lecture notes below.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l1s4g1',
            title: 'Questions 31–40',
            instructions: 'Complete the lecture notes below. Write ONE WORD ONLY for each answer.',
            sharedContent: `THE SCIENCE OF SLEEP — Lecture Notes

Sleep Architecture:
• Sleep cycles last approximately {{31}} minutes each
• Non-REM sleep has three stages; Stage 3 is called {{32}} sleep
• REM sleep is associated with {{33}} and memory consolidation

Functions of Sleep:
• The {{34}} system clears metabolic waste from the brain during deep sleep
• Growth hormone is released during {{35}} sleep (Stage 3)
• Immune function depends heavily on adequate {{36}}

Sleep Deprivation — Effects:
• After 24 hours without sleep, cognitive performance equals a blood alcohol level of {{37}}%
• Chronic deprivation is linked to increased risk of {{38}} disease
• Reaction time and {{39}} are among the first skills to deteriorate
• The body cannot fully {{40}} sleep debt by sleeping longer on weekends`,
            wordBank: [],
            questions: [
              { id: 'l1s4q31', orderNumber: 31, type: 'FILL_IN_BLANK', prompt: 'Sleep cycles last approximately ________ minutes each', correctAnswer: '90', explanation: 'The professor states each complete sleep cycle lasts approximately ninety minutes.' },
              { id: 'l1s4q32', orderNumber: 32, type: 'FILL_IN_BLANK', prompt: 'Stage 3 is called ________ sleep', correctAnswer: 'slow-wave', explanation: 'Stage 3 non-REM sleep is referred to as slow-wave sleep due to the characteristic delta brainwave activity.' },
              { id: 'l1s4q33', orderNumber: 33, type: 'FILL_IN_BLANK', prompt: 'REM sleep is associated with ________ and memory consolidation', correctAnswer: 'dreaming', explanation: 'The professor explains that REM sleep is the stage during which dreaming predominantly occurs.' },
              { id: 'l1s4q34', orderNumber: 34, type: 'FILL_IN_BLANK', prompt: 'The ________ system clears metabolic waste', correctAnswer: 'glymphatic', explanation: 'The glymphatic system, active primarily during deep sleep, flushes out toxic proteins such as beta-amyloid from the brain.' },
              { id: 'l1s4q35', orderNumber: 35, type: 'FILL_IN_BLANK', prompt: 'Growth hormone is released during ________ sleep', correctAnswer: 'deep / slow-wave', explanation: 'The professor notes that the majority of growth hormone secretion occurs during slow-wave (deep) sleep.' },
              { id: 'l1s4q36', orderNumber: 36, type: 'FILL_IN_BLANK', prompt: 'Immune function depends heavily on adequate ________', correctAnswer: 'sleep', explanation: 'Studies show that people who sleep less than six hours per night are more susceptible to viral infections.' },
              { id: 'l1s4q37', orderNumber: 37, type: 'FILL_IN_BLANK', prompt: 'After 24 hours without sleep, cognitive performance equals a blood alcohol level of ________%', correctAnswer: '0.1 / 0.10', explanation: 'The professor cites research showing that 24-hour sleep deprivation impairs cognition to the same degree as a 0.10% blood alcohol concentration.' },
              { id: 'l1s4q38', orderNumber: 38, type: 'FILL_IN_BLANK', prompt: 'Chronic deprivation is linked to increased risk of ________ disease', correctAnswer: 'cardiovascular / heart', explanation: 'Chronic sleep deprivation is strongly associated with elevated risk of cardiovascular disease, including hypertension and heart attacks.' },
              { id: 'l1s4q39', orderNumber: 39, type: 'FILL_IN_BLANK', prompt: 'Reaction time and ________ are among the first skills to deteriorate', correctAnswer: 'concentration / attention', explanation: 'The professor explains that reaction time and the ability to concentrate are among the first cognitive functions to be impaired by sleep loss.' },
              { id: 'l1s4q40', orderNumber: 40, type: 'FILL_IN_BLANK', prompt: 'The body cannot fully ________ sleep debt by sleeping longer on weekends', correctAnswer: 'repay / recover', explanation: 'Research shows that while weekend recovery sleep offers some benefit, it cannot fully repay accumulated sleep debt or reverse all associated health effects.' },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SAMPLE TEST 2
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'listening_sample_2',
    title: 'IELTS Listening Practice Test 2',
    description: 'Full IELTS Academic Listening test — 4 sections, 40 questions. Covers telephone conversation, public announcement, tutorial discussion, and science lecture.',
    durationMinutes: 30,
    category: 'IELTS Listening',
    collection: 'IELTS Listening',
    isBuiltin: true,
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
    parts: [
      {
        id: 'l2s1',
        partNumber: 1,
        title: 'Section 1 — Bicycle Rental Enquiry',
        subtitle: 'A conversation between a tourist and a bicycle rental shop assistant.',
        passage: `[SECTION CONTEXT]\nA tourist (James) phones the CycleCity bike rental shop to book bicycles for himself and his family for a day tour.\n\nListen and answer Questions 1–10.\n\nQuestions 1–5: Complete the booking form.\nQuestions 6–10: Choose the correct letter A, B or C.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l2s1g1',
            title: 'Questions 1–5',
            instructions: 'Complete the booking form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
            sharedContent: `CYCLECITY BIKE RENTAL — Booking Form

Customer Name: James {{1}}
Number of adults: {{2}}
Number of children: {{3}}
Date required: {{4}} July
Duration: {{5}} hours`,
            wordBank: [],
            questions: [
              { id: 'l2s1q1', orderNumber: 1, type: 'FILL_IN_BLANK', prompt: 'Customer Name: James ________', correctAnswer: 'Hartley', explanation: 'James spells out his surname as H-A-R-T-L-E-Y.' },
              { id: 'l2s1q2', orderNumber: 2, type: 'FILL_IN_BLANK', prompt: 'Number of adults: ________', correctAnswer: '2 / two', explanation: 'James says there will be two adults — himself and his wife.' },
              { id: 'l2s1q3', orderNumber: 3, type: 'FILL_IN_BLANK', prompt: 'Number of children: ________', correctAnswer: '3 / three', explanation: 'James says they have three children coming along.' },
              { id: 'l2s1q4', orderNumber: 4, type: 'FILL_IN_BLANK', prompt: 'Date required: ________ July', correctAnswer: '23rd / 23', explanation: 'James asks to book for the twenty-third of July.' },
              { id: 'l2s1q5', orderNumber: 5, type: 'FILL_IN_BLANK', prompt: 'Duration: ________ hours', correctAnswer: '6 / six', explanation: 'James says they would like the bikes for six hours.' },
            ],
          },
          {
            id: 'l2s1g2',
            title: 'Questions 6–10',
            instructions: 'Choose the correct letter, A, B or C.',
            questions: [
              {
                id: 'l2s1q6', orderNumber: 6, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What type of bikes does the assistant recommend for the children?',
                options: [{ id: 'A', text: 'Mountain bikes' }, { id: 'B', text: 'Hybrid bikes' }, { id: 'C', text: 'Children\'s bikes with stabilisers' }],
                correctAnswer: 'B',
                explanation: 'The assistant recommends hybrid bikes for children aged over eight, saying they are comfortable on both roads and paths.',
              },
              {
                id: 'l2s1q7', orderNumber: 7, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What is included free with every rental?',
                options: [{ id: 'A', text: 'Helmet and lock' }, { id: 'B', text: 'Map and lock' }, { id: 'C', text: 'Helmet and map' }],
                correctAnswer: 'C',
                explanation: 'The assistant says every rental includes a safety helmet and a city cycle map at no extra charge.',
              },
              {
                id: 'l2s1q8', orderNumber: 8, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What is the deposit per bike?',
                options: [{ id: 'A', text: '£20' }, { id: 'B', text: '£25' }, { id: 'C', text: '£30' }],
                correctAnswer: 'B',
                explanation: 'The assistant states the refundable deposit is twenty-five pounds per bicycle.',
              },
              {
                id: 'l2s1q9', orderNumber: 9, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What time does the shop open?',
                options: [{ id: 'A', text: '8:00 am' }, { id: 'B', text: '8:30 am' }, { id: 'C', text: '9:00 am' }],
                correctAnswer: 'A',
                explanation: 'The assistant says they open at eight in the morning.',
              },
              {
                id: 'l2s1q10', orderNumber: 10, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'How does James confirm his booking?',
                options: [{ id: 'A', text: 'By email' }, { id: 'B', text: 'By phone' }, { id: 'C', text: 'Online' }],
                correctAnswer: 'A',
                explanation: 'The assistant asks James to confirm by sending an email to the address provided.',
              },
            ],
          },
        ],
      },
      {
        id: 'l2s2',
        partNumber: 2,
        title: 'Section 2 — Community Garden Project',
        subtitle: 'A talk about a new community garden initiative in a local neighbourhood.',
        passage: `[SECTION CONTEXT]\nA council representative is addressing residents at a community meeting about the new Riverbank Community Garden project.\n\nListen and answer Questions 11–20.\n\nQuestions 11–15: Complete the notes below.\nQuestions 16–20: Choose the correct letter A, B or C.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l2s2g1',
            title: 'Questions 11–15',
            instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
            sharedContent: `RIVERBANK COMMUNITY GARDEN — Project Summary

Total area: {{11}} square metres
Number of individual plots: {{12}}
Cost per annual plot rental: £{{13}}
Opening event date: {{14}} September
Contact person: {{15}} at the council office`,
            wordBank: [],
            questions: [
              { id: 'l2s2q11', orderNumber: 11, type: 'FILL_IN_BLANK', prompt: 'Total area: ________ square metres', correctAnswer: '2,400 / 2400', explanation: 'The representative announces the total site area is two thousand four hundred square metres.' },
              { id: 'l2s2q12', orderNumber: 12, type: 'FILL_IN_BLANK', prompt: 'Number of individual plots: ________', correctAnswer: '48 / forty-eight', explanation: 'The site will be divided into forty-eight individual growing plots.' },
              { id: 'l2s2q13', orderNumber: 13, type: 'FILL_IN_BLANK', prompt: 'Cost per annual plot rental: £________', correctAnswer: '75', explanation: 'Each plot costs seventy-five pounds per year to rent.' },
              { id: 'l2s2q14', orderNumber: 14, type: 'FILL_IN_BLANK', prompt: 'Opening event date: ________ September', correctAnswer: '6th / 6', explanation: 'The official opening day is the sixth of September.' },
              { id: 'l2s2q15', orderNumber: 15, type: 'FILL_IN_BLANK', prompt: 'Contact person: ________ at the council office', correctAnswer: 'Karen Webb / Karen', explanation: 'Residents are told to contact Karen Webb at the Parks and Recreation department for further information.' },
            ],
          },
          {
            id: 'l2s2g2',
            title: 'Questions 16–20',
            instructions: 'Choose the correct letter, A, B or C.',
            questions: [
              {
                id: 'l2s2q16', orderNumber: 16, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What is provided free of charge on each plot?',
                options: [{ id: 'A', text: 'Compost and seeds' }, { id: 'B', text: 'A water butt and raised bed frame' }, { id: 'C', text: 'Tools and a storage shed' }],
                correctAnswer: 'B',
                explanation: 'The representative says a water butt and a raised bed frame will be provided on each plot at no additional cost.',
              },
              {
                id: 'l2s2q17', orderNumber: 17, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What will be available at the site for shared use?',
                options: [{ id: 'A', text: 'A communal greenhouse' }, { id: 'B', text: 'A children\'s play area' }, { id: 'C', text: 'A café' }],
                correctAnswer: 'A',
                explanation: 'A communal greenhouse will be available for all plot holders to start seedlings and grow plants that need warmer conditions.',
              },
              {
                id: 'l2s2q18', orderNumber: 18, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'How long is the waiting list currently?',
                options: [{ id: 'A', text: 'Six months' }, { id: 'B', text: 'One year' }, { id: 'C', text: 'Eighteen months' }],
                correctAnswer: 'B',
                explanation: 'The representative says demand has been high and the waiting list is currently approximately one year.',
              },
              {
                id: 'l2s2q19', orderNumber: 19, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What must plot holders do if they cannot tend their plot?',
                options: [{ id: 'A', text: 'Notify the council in advance' }, { id: 'B', text: 'Find a substitute gardener' }, { id: 'C', text: 'Pay a maintenance fee' }],
                correctAnswer: 'A',
                explanation: 'Plot holders who are unable to maintain their allotment for extended periods must notify the council to avoid losing their plot.',
              },
              {
                id: 'l2s2q20', orderNumber: 20, type: 'MULTIPLE_CHOICE_SINGLE',
                prompt: 'What is banned at the community garden?',
                options: [{ id: 'A', text: 'Chemical pesticides' }, { id: 'B', text: 'Bonfires' }, { id: 'C', text: 'Dogs' }],
                correctAnswer: 'A',
                explanation: 'The garden follows an organic-only policy, so chemical pesticides and herbicides are strictly prohibited.',
              },
            ],
          },
        ],
      },
      {
        id: 'l2s3',
        partNumber: 3,
        title: 'Section 3 — Film Studies Assignment',
        subtitle: 'A student and her tutor discuss an essay on documentary filmmaking.',
        passage: `[SECTION CONTEXT]\nEmma is meeting with her film studies tutor, Professor Clarke, to discuss her essay draft on the ethics and techniques of documentary filmmaking.\n\nListen and answer Questions 21–30.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l2s3g1',
            title: 'Questions 21–26',
            instructions: 'Choose the correct letter, A, B or C.',
            questions: [
              { id: 'l2s3q21', orderNumber: 21, type: 'MULTIPLE_CHOICE_SINGLE', prompt: 'What does Professor Clarke say about Emma\'s introduction?', options: [{ id: 'A', text: 'It is too long' }, { id: 'B', text: 'It lacks a clear argument' }, { id: 'C', text: 'It needs more examples' }], correctAnswer: 'B', explanation: 'The professor says the introduction reads like a description rather than establishing a clear argumentative position.' },
              { id: 'l2s3q22', orderNumber: 22, type: 'MULTIPLE_CHOICE_SINGLE', prompt: 'Which filmmaker does Emma focus on most in her essay?', options: [{ id: 'A', text: 'Errol Morris' }, { id: 'B', text: 'Werner Herzog' }, { id: 'C', text: 'Michael Moore' }], correctAnswer: 'A', explanation: 'Emma\'s primary case study is Errol Morris, particularly analysing "The Thin Blue Line".' },
              { id: 'l2s3q23', orderNumber: 23, type: 'MULTIPLE_CHOICE_SINGLE', prompt: 'What does Professor Clarke recommend Emma add to her analysis?', options: [{ id: 'A', text: 'A comparison with fiction films' }, { id: 'B', text: 'Primary interviews with filmmakers' }, { id: 'C', text: 'Audience reception data' }], correctAnswer: 'C', explanation: 'The professor suggests that Emma\'s argument would be strengthened by including audience studies or reception data.' },
              { id: 'l2s3q24', orderNumber: 24, type: 'MULTIPLE_CHOICE_SINGLE', prompt: 'What is the main ethical issue Emma discusses?', options: [{ id: 'A', text: 'Fabrication of scenes' }, { id: 'B', text: 'Informed consent of subjects' }, { id: 'C', text: 'Selective editing to mislead' }], correctAnswer: 'B', explanation: 'Emma\'s central ethical argument concerns whether documentary subjects truly give informed consent to how they will be depicted.' },
              { id: 'l2s3q25', orderNumber: 25, type: 'MULTIPLE_CHOICE_SINGLE', prompt: 'What does Professor Clarke say about Emma\'s conclusion?', options: [{ id: 'A', text: 'It is too similar to the introduction' }, { id: 'B', text: 'It introduces new ideas' }, { id: 'C', text: 'It is well-written but brief' }], correctAnswer: 'B', explanation: 'The professor points out that the conclusion introduces a new concept about digital media that should have been developed earlier in the essay.' },
              { id: 'l2s3q26', orderNumber: 26, type: 'MULTIPLE_CHOICE_SINGLE', prompt: 'When must Emma submit the revised draft?', options: [{ id: 'A', text: 'Next Monday' }, { id: 'B', text: 'Next Wednesday' }, { id: 'C', text: 'Next Friday' }], correctAnswer: 'C', explanation: 'Professor Clarke asks Emma to submit her revised draft by next Friday at the latest.' },
            ],
          },
          {
            id: 'l2s3g2',
            title: 'Questions 27–30',
            instructions: 'Complete the sentences below. Write ONE WORD ONLY for each answer.',
            questions: [
              { id: 'l2s3q27', orderNumber: 27, type: 'FILL_IN_BLANK', prompt: 'Professor Clarke says documentary filmmakers use ________ to construct a particular version of reality.', correctAnswer: 'editing', explanation: 'The professor argues that editing is the primary tool through which documentary filmmakers shape and construct their narrative.' },
              { id: 'l2s3q28', orderNumber: 28, type: 'FILL_IN_BLANK', prompt: 'Emma believes the ________ of the camera changes how subjects behave.', correctAnswer: 'presence', explanation: 'Emma argues that the mere presence of a camera alters the natural behaviour of documentary subjects.' },
              { id: 'l2s3q29', orderNumber: 29, type: 'FILL_IN_BLANK', prompt: 'The professor recommends reading a book by Bill ________ on documentary theory.', correctAnswer: 'Nichols', explanation: 'Professor Clarke suggests Bill Nichols\' "Introduction to Documentary" as essential further reading.' },
              { id: 'l2s3q30', orderNumber: 30, type: 'FILL_IN_BLANK', prompt: 'Emma needs to clarify her use of the term ________ throughout the essay.', correctAnswer: 'authenticity', explanation: 'The professor notes that Emma uses the word "authenticity" inconsistently and needs to define it clearly early in the essay.' },
            ],
          },
        ],
      },
      {
        id: 'l2s4',
        partNumber: 4,
        title: 'Section 4 — Ocean Plastic Pollution',
        subtitle: 'An academic lecture on the sources, distribution, and effects of plastic pollution in the world\'s oceans.',
        passage: `[SECTION CONTEXT]\nA marine biology professor delivers a lecture to postgraduate students on the global crisis of ocean plastic pollution, covering microplastics, gyres, and ecological impact.\n\nListen and answer Questions 31–40.\n\nQuestions 31–40: Complete the lecture notes below.`,
        audioUrl: '',
        questionGroups: [
          {
            id: 'l2s4g1',
            title: 'Questions 31–40',
            instructions: 'Complete the lecture notes below. Write NO MORE THAN TWO WORDS for each answer.',
            sharedContent: `OCEAN PLASTIC POLLUTION — Lecture Notes

Scale of the Problem:
• Approximately {{31}} million tonnes of plastic enter the oceans each year
• Only {{32}}% of all plastic ever produced has been recycled
• Plastic takes up to {{33}} years to fully break down in the ocean

Ocean Gyres:
• The Great Pacific {{34}} Patch is the largest known accumulation zone
• Gyres are formed by circular {{35}} currents
• Most floating plastic is found in the top {{36}} metres of water

Effects on Marine Life:
• Seabirds mistake {{37}} pellets for fish eggs
• Plastic ingestion causes {{38}} blockages in marine mammals
• Microplastics have been detected in human {{39}}

Solutions:
• Beach clean-ups remove {{40}} waste but cannot address deep-sea pollution`,
            wordBank: [],
            questions: [
              { id: 'l2s4q31', orderNumber: 31, type: 'FILL_IN_BLANK', prompt: 'Approximately ________ million tonnes enter the oceans each year', correctAnswer: '8 / eight', explanation: 'The professor cites the widely-cited figure of approximately 8 million metric tonnes of plastic entering oceans annually.' },
              { id: 'l2s4q32', orderNumber: 32, type: 'FILL_IN_BLANK', prompt: 'Only ________% of all plastic ever produced has been recycled', correctAnswer: '9', explanation: 'The professor states that only around 9% of all plastic ever manufactured has been recycled.' },
              { id: 'l2s4q33', orderNumber: 33, type: 'FILL_IN_BLANK', prompt: 'Plastic takes up to ________ years to fully break down', correctAnswer: '500 / five hundred', explanation: 'Depending on the type, some plastics can persist in marine environments for up to 500 years.' },
              { id: 'l2s4q34', orderNumber: 34, type: 'FILL_IN_BLANK', prompt: 'The Great Pacific ________ Patch', correctAnswer: 'Garbage', explanation: 'The Great Pacific Garbage Patch is the world\'s largest accumulation of ocean plastic.' },
              { id: 'l2s4q35', orderNumber: 35, type: 'FILL_IN_BLANK', prompt: 'Gyres are formed by circular ________ currents', correctAnswer: 'ocean / wind-driven', explanation: 'Ocean gyres are large rotating systems of ocean currents driven by wind patterns and the Coriolis effect.' },
              { id: 'l2s4q36', orderNumber: 36, type: 'FILL_IN_BLANK', prompt: 'Most floating plastic is found in the top ________ metres', correctAnswer: '5 / five', explanation: 'The professor explains that the majority of floating plastic debris is concentrated in the top five metres of the ocean surface.' },
              { id: 'l2s4q37', orderNumber: 37, type: 'FILL_IN_BLANK', prompt: 'Seabirds mistake ________ pellets for fish eggs', correctAnswer: 'nurdle / plastic', explanation: 'Nurdles — small pre-production plastic pellets — are commonly mistaken for fish eggs by seabirds, leading to ingestion.' },
              { id: 'l2s4q38', orderNumber: 38, type: 'FILL_IN_BLANK', prompt: 'Plastic ingestion causes ________ blockages in marine mammals', correctAnswer: 'intestinal / digestive', explanation: 'Plastic ingestion leads to intestinal or digestive blockages in whales, dolphins, and other marine mammals, often causing starvation.' },
              { id: 'l2s4q39', orderNumber: 39, type: 'FILL_IN_BLANK', prompt: 'Microplastics have been detected in human ________', correctAnswer: 'blood / tissue', explanation: 'Recent studies have detected microplastic particles in human blood, lungs, and placental tissue.' },
              { id: 'l2s4q40', orderNumber: 40, type: 'FILL_IN_BLANK', prompt: 'Beach clean-ups remove ________ waste', correctAnswer: 'surface / coastal', explanation: 'While beach and coastal clean-up efforts are valuable, the professor emphasises they only address surface or coastal waste and cannot reach deep-sea accumulations.' },
            ],
          },
        ],
      },
    ],
  },
];

export function getAllListeningExams(): Exam[] {
  return sampleListeningExams;
}
