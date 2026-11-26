import type {
  CourseChapter,
  CourseDetail,
  CourseLesson,
  CourseTrack,
  PracticeData,
  QuizOption,
  QuizQuestion,
  SqlTableData,
} from "../types";

export function slugifyCourseId(text: string): string {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `course-${Date.now()}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(raw: string): string {
  // Preserve inline code spans first so ** or * inside code aren't formatted
  const codeSpans: string[] = [];
  let text = raw.replace(/`([^`]+)`/g, (_, code: string) => {
    const idx = codeSpans.length;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `@@CODE_${idx}@@`;
  });

  text = escapeHtml(text);

  // Images: ![alt](url)
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt: string, url: string) => {
      const safeUrl = url.trim();
      if (
        safeUrl.startsWith("http://") ||
        safeUrl.startsWith("https://") ||
        safeUrl.startsWith("data:image/") ||
        safeUrl.startsWith("/")
      ) {
        return `<img src="${escapeHtml(
          safeUrl,
        )}" alt="${alt}" loading="lazy" />`;
      }
      return alt;
    },
  );

  // Links: [label](url)
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label: string, url: string) => {
      const safeUrl = url.trim();
      if (safeUrl.toLowerCase().startsWith("javascript:")) return label;
      const ext =
        safeUrl.startsWith("http://") || safeUrl.startsWith("https://")
          ? ' target="_blank" rel="noopener noreferrer"'
          : "";
      return `<a href="${escapeHtml(safeUrl)}"${ext}>${label}</a>`;
    },
  );

  // Bold & Italic
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Restore inline code
  text = text.replace(/@@CODE_(\d+)@@/g, (_, idx: string) => {
    return codeSpans[Number(idx)] ?? "";
  });

  return text;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block ```
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(
        `<pre><code${cls}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      out.push("<hr />");
      i += 1;
      continue;
    }

    // Headings # .. ####
    const hMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (hMatch) {
      const level = hMatch[1]!.length;
      const title = hMatch[2]!.trim();
      const id = slugifyCourseId(title);
      out.push(
        `<h${level} id="${id}">${renderInlineMarkdown(title)}</h${level}>`,
      );
      i += 1;
      continue;
    }

    // Blockquote >
    if (trimmed.startsWith(">")) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith(">")) {
        qLines.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(
        `<blockquote><p>${renderInlineMarkdown(
          qLines.join(" "),
        )}</p></blockquote>`,
      );
      continue;
    }

    // Markdown pipe table
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1]!)
    ) {
      const parseCells = (rowLine: string) =>
        rowLine
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

      const headers = parseCells(trimmed);
      i += 2; // skip header & separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().includes("|")) {
        rows.push(parseCells(lines[i]!));
        i += 1;
      }
      const thead = `<thead><tr>${headers
        .map((h) => `<th>${renderInlineMarkdown(h)}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(
          (r) =>
            `<tr>${headers
              .map((_, idx) => `<td>${renderInlineMarkdown(r[idx] ?? "")}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i]!.trim())) {
        items.push(
          `<li>${renderInlineMarkdown(
            lines[i]!.trim().replace(/^[-*+]\s+/, ""),
          )}</li>`,
        );
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(
          `<li>${renderInlineMarkdown(
            lines[i]!.trim().replace(/^\d+\.\s+/, ""),
          )}</li>`,
        );
        i += 1;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Standalone image line
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      out.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
      i += 1;
      continue;
    }

    // Paragraph (consume until blank line or block starter)
    const pLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i]!;
      const ct = cur.trim();
      if (
        !ct ||
        ct.startsWith("```") ||
        /^#{1,4}\s+/.test(ct) ||
        ct.startsWith(">") ||
        /^[-*+]\s+/.test(ct) ||
        /^\d+\.\s+/.test(ct) ||
        /^(-{3,}|\*{3,})$/.test(ct)
      ) {
        break;
      }
      pLines.push(ct);
      i += 1;
    }
    out.push(`<p>${renderInlineMarkdown(pLines.join(" "))}</p>`);
  }

  return out.join("\n");
}

export function extractHeadingsFromHtml(
  html: string,
): Array<{ id: string; text: string; level: 2 | 3 }> {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: Array<{ id: string; text: string; level: 2 | 3 }> = [];
  doc.querySelectorAll("h2, h3").forEach((el) => {
    const text = el.textContent?.trim();
    if (!text) return;
    out.push({
      id: el.getAttribute("id") || slugifyCourseId(text),
      text,
      level: el.tagName.toLowerCase() === "h2" ? 2 : 3,
    });
  });
  return out;
}

export function parseTableText(
  raw: string,
): { columns: string[]; rows: string[][] } | null {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  // 1. Pipe-delimited table (Markdown or ASCII +---+ style)
  const pipeLines = lines.filter((l) => l.includes("|") && !/^[+-]+$/.test(l));
  if (pipeLines.length >= 2) {
    const splitPipe = (l: string) =>
      l
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
    const cleaned = pipeLines.filter(
      (l) => !/^\|?[\s:-]+(\|[\s:-]+)*\|?$/.test(l),
    );
    if (cleaned.length >= 1) {
      const columns = splitPipe(cleaned[0]!);
      const rows = cleaned
        .slice(1)
        .map(splitPipe)
        .filter((r) => r.length === columns.length);
      if (columns.length > 0) return { columns, rows };
    }
  }

  // 2. Tab or comma separated
  const delim = lines[0]!.includes("\t") ? "\t" : ",";
  const splitDelim = (l: string) => l.split(delim).map((c) => c.trim());
  const columns = splitDelim(lines[0]!);
  if (columns.length < 2) return null;
  const rows = lines
    .slice(1)
    .map(splitDelim)
    .filter((r) => r.length === columns.length);
  return { columns, rows };
}

export function parseAiQuizText(raw: string): QuizQuestion[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  // Split into question blocks by blank lines followed by Q/number, or direct Q/number starts
  const lines = text.split("\n");
  const blocks: string[][] = [];
  let current: string[] = [];

  const isQuestionStart = (line: string) =>
    /^(?:Q(?:uestion)?\s*\d+\s*[:.)]|Câu\s*\d+\s*[:.)]|\d+\s*[.)]\s+\S)/i.test(
      line.trim(),
    );
  const isOptionLine = (line: string) =>
    /^(?:[-*]\s*)?(?:\*?\s*\[?[A-F]\]?[.)]|\*\s*[A-F][.)])\s+/i.test(
      line.trim(),
    );

  for (const line of lines) {
    if (isQuestionStart(line) && current.length > 0 && !isOptionLine(line)) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  const questions: QuizQuestion[] = [];
  for (const block of blocks) {
    const promptLines: string[] = [];
    const options: QuizOption[] = [];
    const explainLines: string[] = [];
    let correctIndex = -1;
    let explicitAnswerLetter = "";
    let mode: "prompt" | "options" | "explain" = "prompt";

    for (const rawLine of block) {
      const trimmed = rawLine.trim();
      if (!trimmed && mode === "prompt" && promptLines.length === 0) continue;

      const ansMatch =
        /^(?:Answer|Ans|Correct(?:\s+answer)?|Đáp án)\s*[:\-]\s*\[?([A-F])\]?/i.exec(
          trimmed,
        );
      if (ansMatch) {
        explicitAnswerLetter = ansMatch[1]!.toUpperCase();
        continue;
      }

      const expMatch =
        /^(?:Explanation|Explain|Why|Giải thích(?:\s+chi tiết)?)\s*[:\-]\s*(.*)$/i.exec(
          trimmed,
        );
      if (expMatch) {
        mode = "explain";
        if (expMatch[1]?.trim()) explainLines.push(expMatch[1].trim());
        continue;
      }

      const optMatch = /^(?:[-•]\s*)?(\*)?\s*\[?([A-F])\]?[.)]\s*(.+)$/i.exec(
        trimmed,
      );
      if (optMatch && mode !== "explain") {
        mode = "options";
        const hasLeadingStar = Boolean(optMatch[1]);
        const label = optMatch[2]!.toUpperCase();
        let optText = optMatch[3]!.trim();
        const hasInlineTag =
          /(\((?:correct|right|true)\)|\[(?:correct|right|true)\]|✅|\*$)/i.test(
            optText,
          );
        if (hasInlineTag) {
          optText = optText
            .replace(
              /\s*(\((?:correct|right|true)\)|\[(?:correct|right|true)\]|✅|\*)\s*$/gi,
              "",
            )
            .trim();
        }
        if (hasLeadingStar || hasInlineTag) {
          correctIndex = options.length;
        }
        options.push({ label, text: optText });
        continue;
      }

      if (mode === "explain") {
        if (trimmed) explainLines.push(trimmed);
      } else if (mode === "prompt") {
        const cleaned =
          promptLines.length === 0
            ? trimmed.replace(
                /^(?:Q(?:uestion)?\s*\d+\s*[:.)]|Câu\s*\d+\s*[:.)]|\d+\s*[.)])\s*/i,
                "",
              )
            : rawLine.trimEnd();
        promptLines.push(cleaned);
      }
    }

    if (explicitAnswerLetter) {
      const found = options.findIndex(
        (o) => o.label.toUpperCase() === explicitAnswerLetter,
      );
      if (found >= 0) correctIndex = found;
    }

    const prompt = promptLines.join("\n").trim();
    if (prompt && options.length >= 2) {
      questions.push({
        id: `q-${questions.length + 1}`,
        number: questions.length + 1,
        prompt,
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        explanation: explainLines.join("\n").trim(),
      });
    }
  }

  return questions;
}

export function parseAiMarkdownCourse(
  raw: string,
  meta: {
    title: string;
    track: CourseTrack;
    level: string;
    description: string;
  },
): CourseDetail {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const chapters: CourseChapter[] = [];

  let currentChapter: CourseChapter | null = null;
  let currentLessonTitle = "";
  let currentLessonLines: string[] = [];
  let inCodeFence = false;

  const flushLesson = () => {
    if (!currentLessonTitle && currentLessonLines.join("").trim() === "")
      return;
    if (!currentChapter) {
      currentChapter = {
        id: "ch-1",
        number: 1,
        title: "Chapter 1",
        lessons: [],
      };
      chapters.push(currentChapter);
    }

    const bodyMd = currentLessonLines.join("\n").trim();
    const rawTitle =
      currentLessonTitle || `Lesson ${currentChapter.lessons.length + 1}`;
    const isQuiz = /^\[?quiz\]?[:\s-]|(\[quiz\])$/i.test(rawTitle);
    const isPractice = /^\[?practice\]?[:\s-]|(\[practice\])$/i.test(rawTitle);
    const cleanTitle =
      rawTitle
        .replace(/^\[?(?:quiz|practice|theory)\]?\s*[:\-]?\s*/i, "")
        .replace(/\s*\[(?:quiz|practice|theory)\]$/i, "")
        .trim() || rawTitle;

    const lessonId = `lesson-${
      chapters.reduce((a, c) => a + c.lessons.length, 0) + 1
    }`;

    let lesson: CourseLesson;
    if (isQuiz) {
      const questions = parseAiQuizText(bodyMd);
      lesson = {
        id: lessonId,
        index: currentChapter.lessons.length + 1,
        globalIndex: 0,
        title: cleanTitle,
        rawTitle: cleanTitle,
        type: "quiz",
        questions,
      };
    } else if (isPractice) {
      const starterMatch = /```[a-zA-Z]*\n([\s\S]*?)```/.exec(bodyMd);
      const practice: PracticeData = {
        difficulty: meta.level || "Beginner",
        title: cleanTitle,
        summaryHtml: markdownToHtml(bodyMd),
        sections: [],
        starterCode: starterMatch ? starterMatch[1]!.trim() : "",
        sqlTables: [],
        expectedTable: null,
        expectedText: "",
      };
      lesson = {
        id: lessonId,
        index: currentChapter.lessons.length + 1,
        globalIndex: 0,
        title: cleanTitle,
        rawTitle: cleanTitle,
        type: "practice",
        practice,
      };
    } else {
      const html = markdownToHtml(bodyMd);
      lesson = {
        id: lessonId,
        index: currentChapter.lessons.length + 1,
        globalIndex: 0,
        title: cleanTitle,
        rawTitle: cleanTitle,
        type: "theory",
        theory: {
          contentHtml: html,
          markdown: bodyMd,
          headings: extractHeadingsFromHtml(html),
        },
      };
    }

    currentChapter.lessons.push(lesson);
    currentLessonTitle = "";
    currentLessonLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence && /^#\s+/.test(trimmed) && !/^##/.test(trimmed)) {
      flushLesson();
      const chTitle = trimmed.replace(/^#\s+/, "").trim();
      currentChapter = {
        id: `ch-${chapters.length + 1}`,
        number: chapters.length + 1,
        title: chTitle,
        lessons: [],
      };
      chapters.push(currentChapter);
      continue;
    }

    if (!inCodeFence && /^##\s+/.test(trimmed) && !/^###/.test(trimmed)) {
      flushLesson();
      currentLessonTitle = trimmed.replace(/^##\s+/, "").trim();
      continue;
    }

    currentLessonLines.push(line);
  }
  flushLesson();

  let globalIdx = 0;
  let theory = 0;
  let practice = 0;
  let quiz = 0;
  let quizQuestions = 0;

  for (const ch of chapters) {
    ch.lessons.forEach((l, idx) => {
      globalIdx += 1;
      l.index = idx + 1;
      l.globalIndex = globalIdx;
      if (l.type === "theory") theory += 1;
      else if (l.type === "practice") practice += 1;
      else if (l.type === "quiz") {
        quiz += 1;
        quizQuestions += l.questions?.length ?? 0;
      }
    });
  }

  return {
    id: slugifyCourseId(meta.title),
    title: meta.title.trim() || "Untitled Course",
    track: meta.track,
    level: meta.level || "Beginner",
    description:
      meta.description.trim() || `Custom ${meta.track} course created in PNO.`,
    estimatedHours: Math.max(1, Math.round(globalIdx * 0.3)),
    chapterCount: chapters.length,
    lessonCount: globalIdx,
    stats: { theory, practice, quiz, quizQuestions },
    chapters,
    isCustom: true,
    updatedAt: Date.now(),
  };
}

export function parseHtmlCourse(
  rawHtml: string,
  fallbackTitle: string,
  track: CourseTrack,
  level: string,
): CourseDetail {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const titleEl = doc.querySelector("h1.chapter-main-title, title");
  const title =
    fallbackTitle.trim() ||
    titleEl?.textContent?.trim() ||
    "Imported HTML Course";

  const chapters: CourseChapter[] = [];
  const lessonToChapter = new Map<string, number>();

  doc
    .querySelectorAll(".course-toc-accordion .chapter-group")
    .forEach((grp) => {
      const chTitle =
        grp.querySelector(".chapter-group-title")?.textContent?.trim() ||
        `Chapter ${chapters.length + 1}`;
      if (chTitle.toLowerCase() === "submit rating") return;
      const chIdx = chapters.length;
      chapters.push({
        id: `ch-${chIdx + 1}`,
        number: chIdx + 1,
        title: chTitle,
        lessons: [],
      });
      grp.querySelectorAll(".lesson-toc-item a[href^='#']").forEach((a) => {
        const lid = a.getAttribute("href")?.slice(1);
        if (lid) lessonToChapter.set(lid, chIdx);
      });
    });

  const sections = Array.from(doc.querySelectorAll("section.lesson-card"));
  if (sections.length > 0) {
    if (chapters.length === 0) {
      chapters.push({
        id: "ch-1",
        number: 1,
        title: "Chapter 1",
        lessons: [],
      });
    }
    sections.forEach((sec, idx) => {
      const lid = sec.getAttribute("id") || `lesson-${idx + 1}`;
      const cPos = lessonToChapter.get(lid) ?? 0;
      const ch = chapters[cPos]!;
      const badge = sec.querySelector(".lesson-type-badge");
      const rawTitle =
        sec.querySelector(".lesson-anchor-title")?.textContent?.trim() ||
        `Lesson ${idx + 1}`;
      const cleanTitle = rawTitle.replace(/^Bài\s+\d+\s*:\s*/i, "").trim();

      if (badge?.classList.contains("quiz")) {
        const questions: QuizQuestion[] = [];
        sec.querySelectorAll(".quiz-card").forEach((qc, qIdx) => {
          const prompt = (
            qc.querySelector(".q-header")?.textContent?.trim() ||
            `Question ${qIdx + 1}`
          ).replace(/^Câu\s+\d+\s*:\s*/i, "");
          const options: QuizOption[] = [];
          let correctIndex = 0;
          qc.querySelectorAll(".quiz-options .option").forEach((opt, oIdx) => {
            if (opt.classList.contains("correct")) correctIndex = oIdx;
            const clone = opt.cloneNode(true) as Element;
            clone.querySelectorAll(".badge-correct").forEach((b) => b.remove());
            const txt = clone.textContent?.trim() || "";
            const m = /^\[([A-Z])\]\s*([\s\S]*)$/.exec(txt);
            options.push({
              label: m ? m[1]! : String.fromCharCode(65 + oIdx),
              text: m ? m[2]!.trim() : txt,
            });
          });
          const expEl = qc
            .querySelector(".quiz-explanation")
            ?.cloneNode(true) as Element | undefined;
          expEl?.querySelectorAll("strong").forEach((s) => {
            if (s.textContent?.includes("Giải thích")) s.remove();
          });
          questions.push({
            id: `q-${qIdx + 1}`,
            number: qIdx + 1,
            prompt,
            options,
            correctIndex,
            explanation: expEl?.textContent?.trim() || "",
          });
        });
        ch.lessons.push({
          id: lid,
          index: ch.lessons.length + 1,
          globalIndex: 0,
          title: cleanTitle,
          rawTitle,
          type: "quiz",
          questions,
        });
      } else if (badge?.classList.contains("practice")) {
        const container = sec.querySelector(".practice-container");
        const html =
          container?.innerHTML ||
          sec.querySelector(".lesson-body")?.innerHTML ||
          "";
        const sqlTables: SqlTableData[] = [];
        ch.lessons.push({
          id: lid,
          index: ch.lessons.length + 1,
          globalIndex: 0,
          title: cleanTitle,
          rawTitle,
          type: "practice",
          practice: {
            difficulty: level,
            title: cleanTitle,
            summaryHtml: html,
            sections: [],
            starterCode: "",
            sqlTables,
            expectedTable: null,
            expectedText: "",
          },
        });
      } else {
        const bodyHtml =
          sec.querySelector(".lesson-body")?.innerHTML || sec.innerHTML;
        ch.lessons.push({
          id: lid,
          index: ch.lessons.length + 1,
          globalIndex: 0,
          title: cleanTitle,
          rawTitle,
          type: "theory",
          theory: {
            contentHtml: bodyHtml,
            headings: extractHeadingsFromHtml(bodyHtml),
          },
        });
      }
    });
  } else {
    // Generic single-lesson HTML import
    const bodyHtml = doc.body.innerHTML;
    chapters.push({
      id: "ch-1",
      number: 1,
      title: "Chapter 1",
      lessons: [
        {
          id: "lesson-1",
          index: 1,
          globalIndex: 1,
          title,
          rawTitle: title,
          type: "theory",
          theory: {
            contentHtml: bodyHtml,
            headings: extractHeadingsFromHtml(bodyHtml),
          },
        },
      ],
    });
  }

  let globalIdx = 0;
  let theory = 0;
  let practice = 0;
  let quiz = 0;
  let quizQuestions = 0;
  for (const ch of chapters) {
    ch.lessons.forEach((l, idx) => {
      globalIdx += 1;
      l.index = idx + 1;
      l.globalIndex = globalIdx;
      if (l.type === "theory") theory += 1;
      else if (l.type === "practice") practice += 1;
      else if (l.type === "quiz") {
        quiz += 1;
        quizQuestions += l.questions?.length ?? 0;
      }
    });
  }

  return {
    id: slugifyCourseId(title),
    title,
    track,
    level,
    description: `Imported ${track} course (${globalIdx} lessons).`,
    estimatedHours: Math.max(1, Math.round(globalIdx * 0.3)),
    chapterCount: chapters.length,
    lessonCount: globalIdx,
    stats: { theory, practice, quiz, quizQuestions },
    chapters,
    isCustom: true,
    updatedAt: Date.now(),
  };
}

export async function uploadCourseImage(
  file: File,
  courseId: string,
): Promise<string> {
  const safeName = file.name || `image_${Date.now()}.png`;
  const url = `/api/upload-media?skill=courses&testId=${encodeURIComponent(
    courseId || "custom-course",
  )}&filename=${encodeURIComponent(safeName)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!res.ok) {
    let msg = `Image upload failed (${res.status})`;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error) msg = errJson.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Upload succeeded but did not return an image URL.");
  }
  return data.url;
}
