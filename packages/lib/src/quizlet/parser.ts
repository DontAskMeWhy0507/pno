export interface ParsedQuizletTerm {
  word: string;
  definition: string;
  imageUrl?: string;
}

export interface ParsedQuizletSet {
  title: string;
  terms: ParsedQuizletTerm[];
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

export function parseQuizletExportText(text: string): ParsedQuizletTerm[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const terms: ParsedQuizletTerm[] = [];

  for (const line of lines) {
    let word = "";
    let definition = "";

    if (line.includes("\t")) {
      const parts = line.split("\t");
      word = parts[0] || "";
      definition = parts.slice(1).join("\t");
    } else if (line.includes(" - ")) {
      const parts = line.split(" - ");
      word = parts[0] || "";
      definition = parts.slice(1).join(" - ");
    } else if (line.includes(",")) {
      const parts = line.split(",");
      word = parts[0] || "";
      definition = parts.slice(1).join(",");
    } else {
      word = line;
      definition = "";
    }

    const cleanWord = cleanHtml(word);
    const cleanDef = cleanHtml(definition);
    if (cleanWord || cleanDef) {
      terms.push({
        word: cleanWord,
        definition: cleanDef,
      });
    }
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
