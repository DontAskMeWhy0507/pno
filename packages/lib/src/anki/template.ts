export interface RenderCardOptions {
  qfmt: string;                          // Front template
  afmt: string;                          // Back template
  fields: Record<string, string>;        // Field name -> content
  clozeOrdinal?: number;                 // e.g. 1 for c1, 2 for c2
  mediaUrlPrefix?: string;               // e.g. "/api/anki/media/setId"
}

export interface RenderedCard {
  questionHtml: string;
  answerHtml: string;
  audioFiles: string[];
  imageFiles: string[];
}

export function extractClozeOrdinals(text: string): number[] {
  const ordinals = new Set<number>();
  const regex = /\{\{c(\d+)::/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        ordinals.add(num);
      }
    }
  }
  return Array.from(ordinals).sort((a, b) => a - b);
}

function renderCloze(text: string, targetOrdinal: number, isBack: boolean): string {
  // Pattern: {{c1::answer}} or {{c1::answer::hint}}
  const clozeRegex = /\{\{c(\d+)::(.*?)(?:::([^}]*))?\}\}/g;
  return text.replace(clozeRegex, (_match, ordStr, content, hint) => {
    const ord = parseInt(ordStr, 10);
    if (ord === targetOrdinal) {
      if (isBack) {
        return `<span class="anki-cloze">${content}</span>`;
      } else {
        return hint ? `[${hint}]` : "[...]";
      }
    } else {
      // Non-active cloze deletion is revealed as plain content
      return content;
    }
  });
}

function isFieldEmpty(val: string | undefined): boolean {
  if (!val) return true;
  if (/<img\b/i.test(val) || /\[sound:[^\]]+\]/i.test(val)) return false;
  const stripped = val.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return stripped.length === 0;
}

function resolveConditionals(template: string, fields: Record<string, string>): string {
  let result = template;
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    let changed = false;

    // Positive conditional: {{#Field}}...{{/Field}}
    result = result.replace(/\{\{#([^{}#/:]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, rawField, inner) => {
      changed = true;
      const fieldName = rawField.trim();
      const val = fields[fieldName] ?? fields[rawField];
      return isFieldEmpty(val) ? "" : inner;
    });

    // Inverted conditional: {{^Field}}...{{/Field}}
    result = result.replace(/\{\{\^([^{}#/:]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, rawField, inner) => {
      changed = true;
      const fieldName = rawField.trim();
      const val = fields[fieldName] ?? fields[rawField];
      return isFieldEmpty(val) ? inner : "";
    });

    if (!changed) break;
    iterations++;
  }

  return result;
}

function replaceFields(
  template: string,
  fields: Record<string, string>,
  clozeOrdinal?: number,
  isBack: boolean = false
): string {
  let rendered = resolveConditionals(template, fields);

  // Replace {{cloze:FieldName}}
  rendered = rendered.replace(/\{\{cloze:([^{}#/:]+)\}\}/g, (_match, rawField) => {
    const fieldName = rawField.trim();
    const val = fields[fieldName] ?? fields[rawField] ?? "";
    if (clozeOrdinal !== undefined) {
      return renderCloze(val, clozeOrdinal, isBack);
    }
    return val;
  });

  // Replace {{type:FieldName}}
  rendered = rendered.replace(/\{\{type:([^{}#/:]+)\}\}/g, (_match, rawField) => {
    const fieldName = rawField.trim();
    const val = fields[fieldName] ?? fields[rawField] ?? "";
    if (!isBack) {
      return `<input class="anki-type-ans" placeholder="Type answer..." />`;
    }
    return `<div class="anki-type-result">${val}</div>`;
  });

  // Replace standard {{FieldName}}
  rendered = rendered.replace(/\{\{([^{}#/:]+)\}\}/g, (_match, rawField) => {
    const fieldName = rawField.trim();
    return fields[fieldName] ?? fields[rawField] ?? "";
  });

  return rendered;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function encodeMediaPath(mediaUrlPrefix: string, filename: string): string {
  const clean = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  const encoded = encodeURIComponent(clean);
  return mediaUrlPrefix ? `${mediaUrlPrefix.replace(/\/$/, "")}/${encoded}` : encoded;
}

export function sanitizeAnkiHtml(
  rawHtml: string,
  mediaUrlPrefix: string = ""
): {
  html: string;
  audioFiles: string[];
  imageFiles: string[];
} {
  const audioSet = new Set<string>();
  const imageSet = new Set<string>();

  // 1. Strip dangerous paired & void tags to prevent stored XSS and CSS injection
  let html = rawHtml
    .replace(
      /<(script|iframe|object|applet|style|svg|math|form|template|noscript)\b[\s\S]*?(?:<\/\1\s*>|$)/gi,
      "",
    )
    .replace(
      /<(embed|link|meta|base|input|button|textarea|select)\b[^>]*\/?>/gi,
      "",
    );

  // 2. Strip inline event handlers (whitespace or `/`), srcdoc, and dangerous URI schemes
  html = html
    .replace(/(?:[\s/])+on[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(?:[\s/])+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\b(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*'|(?:javascript|vbscript|data\s*:\s*text\/html)[^\s>]*)/gi,
      '$1="#"',
    );

  // 3. Extract and replace [sound:filename.ext] with HTML-escaped attributes
  html = html.replace(/\[sound:([^\]]+)\]/g, (_match, filename: string) => {
    const cleanFile = filename.trim();
    if (!cleanFile) return "";
    audioSet.add(cleanFile);
    const src = encodeMediaPath(mediaUrlPrefix, cleanFile);
    return `<div data-anki-sound="${escapeHtmlAttr(cleanFile)}" class="anki-audio" data-src="${escapeHtmlAttr(src)}"></div>`;
  });

  // 4. Extract and rewrite <img src="..."> cleanly
  html = html.replace(
    /<img\b([^>]*?)\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*?)\/?\s*>/gi,
    (_match, pre, dSrc, sSrc, post) => {
      const cleanSrc = String(dSrc ?? sSrc ?? "").trim();
      if (/^(?:javascript|vbscript|data\s*:\s*text\/html)/i.test(cleanSrc)) {
        return "";
      }
      const altMatch = `${pre} ${post}`.match(
        /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
      );
      const altAttr = altMatch
        ? ` alt="${escapeHtmlAttr(altMatch[1] ?? altMatch[2] ?? "")}"`
        : "";
      if (
        !cleanSrc.startsWith("http://") &&
        !cleanSrc.startsWith("https://") &&
        !cleanSrc.startsWith("data:image/") &&
        !cleanSrc.startsWith("/api/anki/media/")
      ) {
        imageSet.add(cleanSrc);
        const newSrc = encodeMediaPath(mediaUrlPrefix, cleanSrc);
        return `<img src="${escapeHtmlAttr(newSrc)}"${altAttr} class="anki-img" />`;
      }
      return `<img src="${escapeHtmlAttr(cleanSrc)}"${altAttr} class="anki-img" />`;
    },
  );

  return {
    html,
    audioFiles: Array.from(audioSet),
    imageFiles: Array.from(imageSet),
  };
}

export function renderAnkiCard(options: RenderCardOptions): RenderedCard {
  const mediaPrefix = options.mediaUrlPrefix ?? "";

  // Render question
  const rawQuestion = replaceFields(options.qfmt, options.fields, options.clozeOrdinal, false);

  // Render answer, replacing {{FrontSide}} safely without $-pattern interpolation
  let afmt = options.afmt;
  if (afmt.includes("{{FrontSide}}")) {
    afmt = afmt.replace("{{FrontSide}}", () => rawQuestion);
  }
  const rawAnswer = replaceFields(afmt, options.fields, options.clozeOrdinal, true);

  const cleanQ = sanitizeAnkiHtml(rawQuestion, mediaPrefix);
  const cleanA = sanitizeAnkiHtml(rawAnswer, mediaPrefix);

  const audioFiles = Array.from(new Set([...cleanQ.audioFiles, ...cleanA.audioFiles]));
  const imageFiles = Array.from(new Set([...cleanQ.imageFiles, ...cleanA.imageFiles]));

  return {
    questionHtml: cleanQ.html,
    answerHtml: cleanA.html,
    audioFiles,
    imageFiles,
  };
}
