import type { AnkiDeckOptions } from "./srs";

export type AnkiPresetId = "vocab_pro" | "basic" | "cloze" | "imported" | "custom";

export interface AnkiDeckTemplate {
  presetId?: AnkiPresetId;
  fields: string[];
  qfmt: string;
  afmt: string;
  css: string;
  isCloze?: boolean;
  options?: Partial<AnkiDeckOptions>;
}

export interface AnkiCardFieldData {
  ankiFields: Record<string, string>;
  clozeOrdinal?: number;
}

export interface AnkiPresetDefinition extends AnkiDeckTemplate {
  id: "vocab_pro" | "basic" | "cloze";
  name: string;
  description: string;
}

export const ANKI_DECK_PRESETS: AnkiPresetDefinition[] = [
  {
    id: "vocab_pro",
    presetId: "vocab_pro",
    name: "Vocabulary Pro",
    description:
      "Word + IPA + Word Audio on front; Image, Example, Meaning & multiple Audio slots on back.",
    fields: [
      "Word",
      "IPA",
      "WordAudio",
      "Image",
      "Example",
      "Meaning",
      "ExampleAudio",
      "MeaningAudio",
    ],
    qfmt: `<div class="anki-word">{{Word}}</div>
{{#IPA}}<div class="anki-ipa">{{IPA}}</div>{{/IPA}}
{{#WordAudio}}<div class="anki-audio-slot">{{WordAudio}}</div>{{/WordAudio}}`,
    afmt: `{{FrontSide}}
<hr id="answer">
{{#Image}}<div class="anki-media">{{Image}}</div>{{/Image}}
{{#Example}}<div class="anki-section"><div class="anki-label">Example</div><div class="anki-text">{{Example}}</div></div>{{/Example}}
{{#Meaning}}<div class="anki-section"><div class="anki-label">Meaning</div><div class="anki-text">{{Meaning}}</div></div>{{/Meaning}}
{{#ExampleAudio}}<div class="anki-audio-slot">{{ExampleAudio}}</div>{{/ExampleAudio}}
{{#MeaningAudio}}<div class="anki-audio-slot">{{MeaningAudio}}</div>{{/MeaningAudio}}`,
    css: `.anki-word {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.anki-ipa {
  margin-top: 6px;
  font-size: 1.05rem;
  opacity: 0.72;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.anki-section {
  margin-top: 14px;
}
.anki-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  margin-bottom: 4px;
}
.anki-text {
  font-size: 1.05rem;
  line-height: 1.55;
}`,
    isCloze: false,
  },
  {
    id: "basic",
    presetId: "basic",
    name: "Basic (Front & Back)",
    description:
      "Classic 2-sided Anki card with Front, Back, optional Image, and dedicated Front/Back Audio.",
    fields: ["Front", "FrontAudio", "Back", "BackAudio", "Image"],
    qfmt: `<div class="anki-front">{{Front}}</div>
{{#FrontAudio}}<div class="anki-audio-slot">{{FrontAudio}}</div>{{/FrontAudio}}`,
    afmt: `{{FrontSide}}
<hr id="answer">
{{#Image}}<div class="anki-media">{{Image}}</div>{{/Image}}
<div class="anki-back">{{Back}}</div>
{{#BackAudio}}<div class="anki-audio-slot">{{BackAudio}}</div>{{/BackAudio}}`,
    css: `.anki-front {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.45;
}
.anki-back {
  font-size: 1.2rem;
  line-height: 1.6;
}`,
    isCloze: false,
  },
  {
    id: "cloze",
    presetId: "cloze",
    name: "Cloze Deletion",
    description:
      "Fill-in-the-blank card supporting {{c1::answer::hint}} syntax, Extra notes, and Audio.",
    fields: ["Text", "Extra", "Audio"],
    qfmt: `<div class="anki-cloze-text">{{cloze:Text}}</div>`,
    afmt: `<div class="anki-cloze-text">{{cloze:Text}}</div>
<hr id="answer">
{{#Extra}}<div class="anki-section"><div class="anki-label">Extra</div><div class="anki-text">{{Extra}}</div></div>{{/Extra}}
{{#Audio}}<div class="anki-audio-slot">{{Audio}}</div>{{/Audio}}`,
    css: `.anki-cloze-text {
  font-size: 1.35rem;
  line-height: 1.6;
}
.anki-section {
  margin-top: 14px;
}
.anki-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  margin-bottom: 4px;
}`,
    isCloze: true,
  },
];

export function getAnkiPreset(
  presetId: "vocab_pro" | "basic" | "cloze" = "vocab_pro",
): AnkiDeckTemplate {
  const found =
    ANKI_DECK_PRESETS.find((p) => p.id === presetId) ?? ANKI_DECK_PRESETS[0]!;
  return {
    presetId: found.presetId,
    fields: [...found.fields],
    qfmt: found.qfmt,
    afmt: found.afmt,
    css: found.css,
    isCloze: found.isCloze,
  };
}

export function parseAnkiDeckTemplate(raw: unknown): AnkiDeckTemplate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.fields) || typeof obj.qfmt !== "string" || typeof obj.afmt !== "string") {
    return null;
  }
  const fields = obj.fields
    .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
    .map((f) => f.trim());
  if (fields.length === 0) return null;

  const presetId =
    typeof obj.presetId === "string" &&
    ["vocab_pro", "basic", "cloze", "imported", "custom"].includes(obj.presetId)
      ? (obj.presetId as AnkiPresetId)
      : "custom";

  return {
    presetId,
    fields,
    qfmt: obj.qfmt,
    afmt: obj.afmt,
    css: typeof obj.css === "string" ? obj.css : "",
    isCloze: typeof obj.isCloze === "boolean" ? obj.isCloze : obj.qfmt.includes("{{cloze:"),
    ...(obj.options && typeof obj.options === "object" && !Array.isArray(obj.options)
      ? { options: obj.options as Partial<AnkiDeckOptions> }
      : {}),
  };
}

export function parseAnkiCardFields(raw: unknown): AnkiCardFieldData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.ankiFields || typeof obj.ankiFields !== "object" || Array.isArray(obj.ankiFields)) {
    return null;
  }
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj.ankiFields as Record<string, unknown>)) {
    if (typeof v === "string") {
      fields[k] = v;
    }
  }
  return {
    ankiFields: fields,
    clozeOrdinal: typeof obj.clozeOrdinal === "number" ? obj.clozeOrdinal : undefined,
  };
}

/**
 * Sanitizes and scopes custom Anki CSS inside `.anki-card-surface`
 * so deck styles never leak out to the surrounding PNO app UI.
 */
export function scopeAnkiCss(
  rawCss: string,
  scopeSelector = ".anki-card-surface",
): string {
  if (!rawCss || !rawCss.trim()) return "";

  const cleaned = rawCss
    .replace(/<\/?style\b[^>]*>/gi, "")
    .replace(/@import\b[^;]*;?/gi, "")
    .replace(/@charset\b[^;]*;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/behavior\s*:[^;]*(;|$)/gi, "")
    .replace(/-moz-binding\s*:[^;]*(;|$)/gi, "");

  // Prefix top-level rule selectors inside optional @media blocks
  const scopeRuleSelector = (selectorText: string): string => {
    return selectorText
      .split(",")
      .map((part) => {
        const s = part.trim();
        if (!s) return "";
        if (s.startsWith(scopeSelector)) return s;
        if (/^(?:html|body|:root)$/i.test(s)) return scopeSelector;
        if (s === ".card" || s.startsWith(".card ") || s.startsWith(".card:") || s.startsWith(".card.")) {
          return s.replace(/^\.card\b/, scopeSelector);
        }
        return `${scopeSelector} ${s}`;
      })
      .filter(Boolean)
      .join(", ");
  };

  let out = "";
  let i = 0;
  const len = cleaned.length;

  while (i < len) {
    // Skip whitespace & comments
    if (/\s/.test(cleaned[i]!)) {
      out += cleaned[i++];
      continue;
    }
    if (cleaned[i] === "/" && cleaned[i + 1] === "*") {
      const end = cleaned.indexOf("*/", i + 2);
      if (end === -1) break;
      out += cleaned.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    const braceOpen = cleaned.indexOf("{", i);
    if (braceOpen === -1) break;

    const header = cleaned.slice(i, braceOpen).trim();
    if (!header) {
      i = braceOpen + 1;
      continue;
    }

    // Find matching closing brace
    let depth = 1;
    let j = braceOpen + 1;
    while (j < len && depth > 0) {
      if (cleaned[j] === "{") depth++;
      else if (cleaned[j] === "}") depth--;
      j++;
    }
    const body = cleaned.slice(braceOpen + 1, j - 1);

    if (header.startsWith("@media") || header.startsWith("@supports")) {
      out += `${header} {\n${scopeAnkiCss(body, scopeSelector)}\n}\n`;
    } else if (header.startsWith("@")) {
      // Skip unsupported/dangerous at-rules like @font-face or @keyframes if external URLs are present
      if (!/url\s*\(/i.test(body)) {
        out += `${header} {${body}}\n`;
      }
    } else {
      const scopedSel = scopeRuleSelector(header);
      if (scopedSel) {
        out += `${scopedSel} {${body}}\n`;
      }
    }

    i = j;
  }

  return out.trim();
}
