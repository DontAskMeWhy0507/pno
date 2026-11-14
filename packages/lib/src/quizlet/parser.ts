export interface ParsedQuizletTerm {
  word: string;
  definition: string;
  imageUrl?: string;
}

export interface ParsedQuizletSet {
  title: string;
  terms: ParsedQuizletTerm[];
}

export interface QuizletExportParseOptions {
  termDelimiter?: string; // 'tab' | 'comma' | 'custom' | literal char (e.g. '@', '\t', ',')
  customTermDelimiter?: string;
  rowDelimiter?: string; // 'newline' | 'semicolon' | 'custom' | literal char (e.g. '\n', ';', '\n\n')
  customRowDelimiter?: string;
}

export function cleanHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Smartly parse text exported from Quizlet matching Quizlet's export options:
 * - Between term and definition: Tab, Comma, Custom (e.g. '@', ' - ', '::')
 * - Between rows: New line, Semicolon, Custom (e.g. '\n\n', '---')
 * Supports multi-line card definitions when definitions span multiple lines.
 */
export function parseQuizletExportText(
  text: string,
  options: QuizletExportParseOptions = {},
): ParsedQuizletTerm[] {
  if (!text || !text.trim()) return [];

  // Resolve term delimiter
  let termDelim = options.termDelimiter || "auto";
  if (termDelim === "tab") termDelim = "\t";
  else if (termDelim === "comma") termDelim = ",";
  else if (termDelim === "custom") {
    termDelim = options.customTermDelimiter?.trim() || "@";
  }

  // Resolve row delimiter
  let rowDelim = options.rowDelimiter || "auto";
  if (rowDelim === "newline") rowDelim = "\n";
  else if (rowDelim === "semicolon") rowDelim = ";";
  else if (rowDelim === "custom") {
    rowDelim = (options.customRowDelimiter || "\n\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }

  // Auto-detect term delimiter if requested or still "auto"
  if (termDelim === "auto") {
    const atCount = (text.match(/ @/g) || text.match(/@/g) || []).length;
    const tabCount = (text.match(/\t/g) || []).length;
    const dashCount = (text.match(/ - /g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;

    if (atCount > 0 && atCount >= tabCount) {
      termDelim = "@";
    } else if (tabCount > 0) {
      termDelim = "\t";
    } else if (dashCount > 0) {
      termDelim = " - ";
    } else if (commaCount > 0) {
      termDelim = ",";
    } else {
      termDelim = "\t";
    }
  }

  // Auto-detect row delimiter if requested
  if (rowDelim === "auto") {
    if (text.includes("\n\n") && (text.match(/\n\n/g) || []).length > 1) {
      rowDelim = "\n\n";
    } else if (text.includes(";\n") || (text.match(/;/g) || []).length > 2) {
      rowDelim = ";";
    } else {
      rowDelim = "\n";
    }
  }

  const terms: ParsedQuizletTerm[] = [];

  // Branch A: Explicit row delimiter (such as \n\n or semicolon)
  if (rowDelim !== "\n") {
    const blocks = text.split(rowDelim).map((b) => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const idx = block.indexOf(termDelim);
      if (idx !== -1) {
        const word = cleanHtml(block.slice(0, idx));
        const def = cleanHtml(block.slice(idx + termDelim.length));
        if (word || def) {
          terms.push({ word, definition: def });
        }
      }
    }
    return terms;
  }

  // Branch B: Row delimiter is newline, with multi-line definition continuation support
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let currentCard: { word: string; definition: string; hasDelim: boolean } | null = null;

  for (const line of lines) {
    const delimIndex = line.indexOf(termDelim);
    if (delimIndex !== -1) {
      // Line contains delimiter: start a new card
      if (currentCard && (currentCard.word || currentCard.definition)) {
        terms.push({
          word: cleanHtml(currentCard.word),
          definition: cleanHtml(currentCard.definition),
        });
      }
      currentCard = {
        word: line.slice(0, delimIndex).trim(),
        definition: line.slice(delimIndex + termDelim.length).trim(),
        hasDelim: true,
      };
    } else {
      // Line doesn't contain delimiter: it's part of the multiline definition of the current card
      if (currentCard) {
        currentCard.definition = currentCard.definition
          ? `${currentCard.definition}\n${line}`
          : line;
      } else {
        // Line before any delimiter was encountered (e.g. scroll remnant from export modal)
        // Only keep if no valid cards exist yet
        currentCard = {
          word: line,
          definition: "",
          hasDelim: false,
        };
      }
    }
  }

  if (currentCard && (currentCard.word || currentCard.definition)) {
    // If the only line in the file had no delimiter, include it;
    // but if we parsed cards with delimiters, drop any leading/trailing orphan line without a delimiter
    if (terms.length === 0 || currentCard.hasDelim || currentCard.definition) {
      terms.push({
        word: cleanHtml(currentCard.word),
        definition: cleanHtml(currentCard.definition),
      });
    }
  }

  // Filter out any leading orphan line that had no delimiter if subsequent cards had delimiters
  if (terms.length > 1 && terms[0] && !terms[0].definition) {
    terms.shift();
  }

  return terms;
}

export function parseQuizletHtml(html: string): ParsedQuizletSet {
  let title = "Quizlet Flashcards";
  const terms: ParsedQuizletTerm[] = [];

  // 1. Try to extract title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1]
      .replace(/\s*\|\s*Quizlet\s*$/i, "")
      .replace(/\s*Flashcards\s*$/i, "")
      .replace(/\s*-\s*Quizlet\s*$/i, "")
      .trim();
  }

  // 2. Try Next.js dehydrated state in __NEXT_DATA__
  const nextDataMatch = html.match(
    /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch && nextDataMatch[1]) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const queries =
        json?.props?.pageProps?.dehydratedState?.queries || [];
      for (const q of queries) {
        const data = q?.state?.data;
        const rawItems =
          data?.studiableItemDocuments ||
          data?.studiableItems ||
          (Array.isArray(data) ? data : []);
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          for (const item of rawItems) {
            const sides = item?.cardSides || item?.sides || [];
            if (sides.length >= 2) {
              const word =
                sides[0]?.media?.find(
                  (m: { type: number; plainText?: string }) =>
                    m.type === 1 || m.plainText,
                )?.plainText ||
                sides[0]?.text ||
                "";
              const def =
                sides[1]?.media?.find(
                  (m: { type: number; plainText?: string }) =>
                    m.type === 1 || m.plainText,
                )?.plainText ||
                sides[1]?.text ||
                "";
              const img =
                sides[1]?.media?.find(
                  (m: { type: number; url?: string }) => m.type === 2 || m.url,
                )?.url ||
                sides[0]?.media?.find(
                  (m: { type: number; url?: string }) => m.type === 2 || m.url,
                )?.url;
              if (word || def) {
                terms.push({
                  word: cleanHtml(word),
                  definition: cleanHtml(def),
                  imageUrl: img,
                });
              }
            }
          }
        }
      }
    } catch {
      // Continue to next parsers
    }
  }

  // 3. Try window._scriptData or window.Quizlet["setPageTarget"]
  if (terms.length === 0) {
    const scriptMatches = [
      html.match(/window\._scriptData\s*=\s*(\{[\s\S]*?\});/i),
      html.match(/window\.Quizlet\["setPageTarget"\]\s*=\s*(\{[\s\S]*?\});/i),
      html.match(/window\.Quizletable\s*=\s*(\{[\s\S]*?\});/i),
    ];
    for (const match of scriptMatches) {
      if (match && match[1]) {
        try {
          const json = JSON.parse(match[1]);
          const target = json?.set || json?.setPageTarget || json;
          if (target?.title) title = target.title;
          const rawTerms =
            target?.terms || target?.studiableData?.studiableItems || [];
          if (Array.isArray(rawTerms)) {
            for (const t of rawTerms) {
              const word =
                t.word ||
                t.term ||
                t.cardSides?.[0]?.media?.[0]?.plainText ||
                "";
              const def =
                t.definition ||
                t.cardSides?.[1]?.media?.[0]?.plainText ||
                "";
              const img = t.imageUrl || t.image?.url;
              if (word || def) {
                terms.push({
                  word: cleanHtml(word),
                  definition: cleanHtml(def),
                  imageUrl: img,
                });
              }
            }
          }
        } catch {
          // Continue to next parsers
        }
      }
    }
  }

  // 4. Try Schema.org ld+json
  if (terms.length === 0) {
    const ldJsonMatches = Array.from(
      html.matchAll(
        /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
      ),
    );
    for (const match of ldJsonMatches) {
      if (!match[1]) continue;
      try {
        const json = JSON.parse(match[1]);
        if (json?.name && !title) title = json.name;
        const items = json?.itemListElement || json?.hasPart || [];
        for (const item of items) {
          const word = item?.name || item?.question || "";
          const def = item?.acceptedAnswer?.text || item?.text || "";
          if (word || def) {
            terms.push({
              word: cleanHtml(word),
              definition: cleanHtml(def),
            });
          }
        }
      } catch {
        // Continue
      }
    }
  }

  // 5. Fallback HTML regex for SetPageTerm
  if (terms.length === 0) {
    const termBlocks = html.split(/class="[^"]*SetPageTerm/);
    if (termBlocks.length > 1) {
      for (let i = 1; i < termBlocks.length; i++) {
        const block = termBlocks[i] || "";
        const wordMatch = block.match(
          /class="[^"]*SetPageTerm-wordText[^"]*"[^>]*>([\s\S]*?)<\/(?:span|a)>/i,
        );
        const defMatch = block.match(
          /class="[^"]*SetPageTerm-definitionText[^"]*"[^>]*>([\s\S]*?)<\/(?:span|a)>/i,
        );
        const word = wordMatch ? cleanHtml(wordMatch[1] || "") : "";
        const def = defMatch ? cleanHtml(defMatch[1] || "") : "";
        if (word || def) {
          terms.push({ word, definition: def });
        }
      }
    }
  }

  return { title, terms };
}

export async function fetchQuizletSet(url: string): Promise<ParsedQuizletSet> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    redirect: "follow",
  });

  const html = await res.text();

  if (
    res.status === 403 ||
    html.includes("Captcha Challenge") ||
    html.includes("One more step…") ||
    html.includes("__cf_chl")
  ) {
    throw new Error(
      "CLOUDFLARE_BLOCKED: Quizlet's Cloudflare bot challenge blocked direct server access to this link. Please open the set in Quizlet, click '...' -> 'Export', copy the text, and paste it into the 'Paste Export' tab.",
    );
  }

  const parsed = parseQuizletHtml(html);
  if (parsed.terms.length === 0) {
    throw new Error(
      "No flashcards found at this URL. Make sure the Quizlet set is public, or copy its exported text and paste it directly.",
    );
  }

  return parsed;
}
