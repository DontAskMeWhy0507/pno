export type CrosswordDirection = "across" | "down";

export interface CrosswordWord {
  id: string;
  number: number;
  direction: CrosswordDirection;
  answer: string;
  clue: string;
  originalWord: string;
  row: number;
  col: number;
}

export interface CrosswordCell {
  row: number;
  col: number;
  letter: string | null;
  clueNumber?: number;
  wordIds: string[];
}

export interface CrosswordPuzzle {
  rows: number;
  cols: number;
  grid: CrosswordCell[][];
  words: CrosswordWord[];
}

export interface RawTermInput {
  id?: string;
  word: string;
  definition: string;
}

export function cleanCrosswordText(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .replace(/<br\s*\/?>/gi, " / ")
    .replace(/<\/?(?:div|p|li|tr|h[1-6])[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCleanAnswer(rawWord: string): string {
  if (!rawWord) return "";
  const cleaned = rawWord
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:div|p|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:^|[\s(])\/[^\s/][^/\n]*?(?<!\s)\/(?=$|[\s.,;)])/g, " ")
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return cleaned;
}

interface PlacedCandidate {
  answer: string;
  clue: string;
  originalWord: string;
  row: number;
  col: number;
  direction: CrosswordDirection;
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

export function generateCrosswordPuzzle(
  rawTerms: RawTermInput[],
  maxWords = 12,
): CrosswordPuzzle {
  const eligible: {
    answer: string;
    clue: string;
    originalWord: string;
  }[] = [];
  const seenAnswers = new Set<string>();

  for (const t of rawTerms) {
    const cleanWord = cleanCrosswordText(t.word);
    const cleanDef = cleanCrosswordText(t.definition);
    if (!cleanWord && !cleanDef) continue;

    let answer = extractCleanAnswer(t.word);
    let clue = cleanDef || cleanWord;
    let originalWord = cleanWord || cleanDef;

    if (answer.length < 2 || answer.length > 16) {
      const fallbackDefAnswer = extractCleanAnswer(t.definition);
      if (fallbackDefAnswer.length >= 2 && fallbackDefAnswer.length <= 16) {
        answer = fallbackDefAnswer;
        clue = cleanWord || cleanDef;
        originalWord = cleanDef;
      } else {
        continue;
      }
    }

    if (seenAnswers.has(answer)) continue;
    seenAnswers.add(answer);
    eligible.push({ answer, clue, originalWord });
  }

  if (eligible.length === 0) {
    return { rows: 0, cols: 0, grid: [], words: [] };
  }

  // Fisher-Yates shuffle eligible items so "New Puzzle" produces fresh layouts
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const picked = shuffled.slice(0, maxWords);
  // Keep a randomized anchor among longer words and allow randomized order after longest-first bias
  const anchorIdx = Math.floor(Math.random() * Math.min(3, picked.length));
  const [anchor] = picked.splice(anchorIdx, 1);
  picked.sort((a, b) => b.answer.length - a.answer.length + (Math.random() * 4 - 2));
  const selected = anchor ? [anchor, ...picked] : picked;

  const boardMap = new Map<string, string>();
  const placed: PlacedCandidate[] = [];

  const getBounds = (extraCells?: { r: number; c: number }[]) => {
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;

    for (const k of boardMap.keys()) {
      const [rs, cs] = k.split(",");
      const r = Number(rs);
      const c = Number(cs);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }

    if (extraCells) {
      for (const { r, c } of extraCells) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }

    return { minR, maxR, minC, maxC };
  };

  // Place first word horizontally at (0, 0)
  const first = selected[0]!;
  for (let i = 0; i < first.answer.length; i++) {
    boardMap.set(keyOf(0, i), first.answer[i]!);
  }
  placed.push({
    ...first,
    row: 0,
    col: 0,
    direction: "across",
  });

  // Greedy intersecting placement for remaining words
  for (let wIdx = 1; wIdx < selected.length; wIdx++) {
    const candidateItem = selected[wIdx]!;
    const word = candidateItem.answer;

    let bestPlacement: {
      row: number;
      col: number;
      direction: CrosswordDirection;
      score: number;
    } | null = null;

    // Collect existing cells matching letters in candidate word
    const entries = Array.from(boardMap.entries());
    for (let charIdx = 0; charIdx < word.length; charIdx++) {
      const ch = word[charIdx]!;
      for (const [cellKey, existingLetter] of entries) {
        if (existingLetter !== ch) continue;
        const [rs, cs] = cellKey.split(",");
        const baseR = Number(rs);
        const baseC = Number(cs);

        for (const direction of ["across", "down"] as CrosswordDirection[]) {
          const dr = direction === "down" ? 1 : 0;
          const dc = direction === "across" ? 1 : 0;
          const startR = baseR - charIdx * dr;
          const startC = baseC - charIdx * dc;

          // Before start & after end must be empty
          const beforeKey = keyOf(startR - dr, startC - dc);
          const afterKey = keyOf(
            startR + word.length * dr,
            startC + word.length * dc,
          );
          if (boardMap.has(beforeKey) || boardMap.has(afterKey)) continue;

          let valid = true;
          let intersections = 0;
          const newCells: { r: number; c: number }[] = [];

          for (let i = 0; i < word.length; i++) {
            const r = startR + i * dr;
            const c = startC + i * dc;
            const k = keyOf(r, c);
            const existing = boardMap.get(k);

            if (existing !== undefined) {
              if (existing !== word[i]) {
                valid = false;
                break;
              }
              intersections++;
            } else {
              // Ensure perpendicular adjacent cells are empty so parallel words don't touch
              const perp1 = keyOf(r + (direction === "across" ? 1 : 0), c + (direction === "down" ? 1 : 0));
              const perp2 = keyOf(r - (direction === "across" ? 1 : 0), c - (direction === "down" ? 1 : 0));
              if (boardMap.has(perp1) || boardMap.has(perp2)) {
                valid = false;
                break;
              }
              newCells.push({ r, c });
            }
          }

          // Require at least 1 intersection and at least 1 new cell (not completely covered)
          if (!valid || intersections === 0 || newCells.length === 0) continue;

          // Prevent overlapping identically oriented words at same position
          const alreadyDuplicateAxis = placed.some(
            (p) =>
              p.direction === direction &&
              ((direction === "across" &&
                p.row === startR &&
                !(startC + word.length - 1 < p.col || startC > p.col + p.answer.length - 1)) ||
                (direction === "down" &&
                  p.col === startC &&
                  !(startR + word.length - 1 < p.row || startR > p.row + p.answer.length - 1))),
          );
          if (alreadyDuplicateAxis) continue;

          const bounds = getBounds(newCells);
          const area = (bounds.maxR - bounds.minR + 1) * (bounds.maxC - bounds.minC + 1);
          const score = intersections * 100 - area;

          if (!bestPlacement || score > bestPlacement.score) {
            bestPlacement = { row: startR, col: startC, direction, score };
          }
        }
      }
    }

    if (bestPlacement) {
      const dr = bestPlacement.direction === "down" ? 1 : 0;
      const dc = bestPlacement.direction === "across" ? 1 : 0;
      for (let i = 0; i < word.length; i++) {
        boardMap.set(
          keyOf(bestPlacement.row + i * dr, bestPlacement.col + i * dc),
          word[i]!,
        );
      }
      placed.push({
        ...candidateItem,
        row: bestPlacement.row,
        col: bestPlacement.col,
        direction: bestPlacement.direction,
      });
    } else if (placed.length < 4) {
      // Fallback for small / disjoint sets: place horizontally two rows below current bounds
      const bounds = getBounds();
      const startR = bounds.maxR + 2;
      const startC = bounds.minC;
      for (let i = 0; i < word.length; i++) {
        boardMap.set(keyOf(startR, startC + i), word[i]!);
      }
      placed.push({
        ...candidateItem,
        row: startR,
        col: startC,
        direction: "across",
      });
    }
  }

  // Normalize grid coordinates to (0..rows-1, 0..cols-1)
  const finalBounds = getBounds();
  const rows = finalBounds.maxR - finalBounds.minR + 1;
  const cols = finalBounds.maxC - finalBounds.minC + 1;

  const grid: CrosswordCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (__, c) => ({
      row: r,
      col: c,
      letter: null,
      wordIds: [],
    })),
  );

  const normalized = placed.map((p) => ({
    ...p,
    row: p.row - finalBounds.minR,
    col: p.col - finalBounds.minC,
  }));

  // Populate letters first
  for (const p of normalized) {
    const dr = p.direction === "down" ? 1 : 0;
    const dc = p.direction === "across" ? 1 : 0;
    for (let i = 0; i < p.answer.length; i++) {
      const r = p.row + i * dr;
      const c = p.col + i * dc;
      grid[r]![c]!.letter = p.answer[i]!;
    }
  }

  // Assign standard crossword clue numbers in row-major order
  const startCoordToNumber = new Map<string, number>();
  let nextNumber = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startsHere = normalized.some((p) => p.row === r && p.col === c);
      if (startsHere) {
        startCoordToNumber.set(keyOf(r, c), nextNumber);
        grid[r]![c]!.clueNumber = nextNumber;
        nextNumber++;
      }
    }
  }

  const words: CrosswordWord[] = normalized
    .map((p) => {
      const number = startCoordToNumber.get(keyOf(p.row, p.col))!;
      const id = `${number}-${p.direction}`;
      return {
        id,
        number,
        direction: p.direction,
        answer: p.answer,
        clue: p.clue,
        originalWord: p.originalWord,
        row: p.row,
        col: p.col,
      };
    })
    .sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      return a.direction === "across" ? -1 : 1;
    });

  // Link wordIds into each cell
  for (const w of words) {
    const dr = w.direction === "down" ? 1 : 0;
    const dc = w.direction === "across" ? 1 : 0;
    for (let i = 0; i < w.answer.length; i++) {
      const r = w.row + i * dr;
      const c = w.col + i * dc;
      grid[r]![c]!.wordIds.push(w.id);
    }
  }

  return { rows, cols, grid, words };
}
