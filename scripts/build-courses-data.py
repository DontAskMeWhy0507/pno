#!/usr/bin/env python3
"""
Parse all XomData HTML course exports into structured JSON files under
apps/next/public/courses-data/ for the interactive PNO Courses workspace.
"""

from __future__ import annotations

import argparse
import html as html_lib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, Tag

DEFAULT_SOURCE = r"h:\My Drive\1 K68I-IS\XomData - 15 Khoa Hoc"
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "apps" / "next" / "public" / "courses-data"

TRACK_ORDER = ["Python", "SQL", "R", "Git", "JavaScript", "Excel"]

LEVEL_MAP = {
    "Python Beginner": "Beginner",
    "Python Intermediate": "Intermediate",
    "Python Advanced": "Advanced",
    "Python Api": "Specialized",
    "Python Numpy": "Specialized",
    "Python Pandas": "Specialized",
    "Python Visualization": "Specialized",
    "Sql Beginner": "Beginner",
    "Sql Intermediate": "Intermediate",
    "Sql Advanced": "Advanced",
    "R Beginner": "Beginner",
    "R Intermediate": "Intermediate",
    "R Advanced": "Advanced",
    "Git For Data": "Beginner",
    "Javascript Beginner": "Beginner",
    "Excel For Data": "Beginner",
}

COURSE_DESCRIPTIONS = {
    "Python Beginner": "Variables, data types, conditionals, loops and lists — the foundations of Python programming.",
    "Python Intermediate": "Functions, tuples, dicts, sets, comprehensions, file I/O and error handling in Python.",
    "Python Advanced": "Lambda & higher-order functions, closures, decorators, tabular data, JSON, generators and regex.",
    "Python Api": "HTTP, REST APIs, requests, nested JSON parsing, auth headers, pagination and API projects.",
    "Python Numpy": "Multi-dimensional arrays, indexing, slicing, broadcasting, vectorization and numerical computing.",
    "Python Pandas": "Series, DataFrames, filtering, grouping, merging, pivoting and cleaning real-world datasets.",
    "Python Visualization": "Create publication-ready charts and exploratory visuals with Matplotlib and Seaborn.",
    "Sql Beginner": "Write your first query, filter and sort data with SELECT, WHERE, ORDER BY and GROUP BY.",
    "Sql Intermediate": "Combine multiple tables with JOIN, write Subqueries and transform data with CASE WHEN.",
    "Sql Advanced": "Window Functions, CTEs, Set Operations and advanced SQL data-analysis techniques.",
    "R Beginner": "Vectors, data structures, control flow, functions, strings and data aggregation in R.",
    "R Intermediate": "The apply family, dplyr data manipulation, table joins, regex, dates and applied statistics.",
    "R Advanced": "Functional programming, linear regression, hypothesis testing, charts and fast reusable R.",
    "Git For Data": "Version control for data workflows: init, add, commit, branching, merging, GitHub and PRs.",
    "Javascript Beginner": "Variables, loops, functions, arrays, objects, strings and real-world data processing in JS.",
    "Excel For Data": "Learn to inspect data, write formulas, clean with Power Query, and build PivotTables & dashboards.",
}


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s or "course"


def clean_lesson_title(raw_title: str) -> str:
    return re.sub(r"^Bài\s+\d+\s*:\s*", "", raw_title.strip(), flags=re.IGNORECASE)


def sanitize_fragment(tag: Tag) -> str:
    """
    Strip unsafe tags/attrs and highlight/editor scaffolding while keeping
    clean semantic HTML (headings, prose, lists, code, tables, svg/base64 imgs).
    """
    clone = BeautifulSoup(str(tag), "html.parser")
    for bad in clone.select("script, style, iframe, object, embed, form, input, button, textarea"):
        bad.decompose()
    for el in clone.select('[data-lesson-next="true"]'):
        el.decompose()
    # Unwrap highlight spans and <section> wrappers to keep content flat & clean
    for span in clone.select("span[data-hl-block]"):
        span.unwrap()
    for sec_el in clone.select("section"):
        sec_el.unwrap()
    # Remove empty trailing divider divs with no text or images
    for div in clone.find_all("div"):
        if not div.get_text(strip=True) and not div.find(["img", "svg", "pre", "table"]):
            div.decompose()

    for el in clone.find_all(True):
        attrs = dict(el.attrs)
        kept: dict[str, Any] = {}
        for k, v in attrs.items():
            kl = k.lower()
            if kl.startswith("on"):
                continue
            if kl in {"id", "class", "colspan", "rowspan", "start", "alt", "title", "width", "height"}:
                kept[k] = v
            elif kl == "href" and el.name == "a":
                href = str(v).strip()
                if not href.lower().startswith("javascript:"):
                    kept["href"] = href
                    if href.startswith("http://") or href.startswith("https://"):
                        kept["target"] = "_blank"
                        kept["rel"] = "noopener noreferrer"
            elif kl == "src" and el.name == "img":
                src = str(v).strip()
                if src.startswith("data:image/") or src.startswith("http://") or src.startswith("https://"):
                    kept["src"] = src
                    kept["loading"] = "lazy"
        el.attrs = kept

    return "".join(str(c) for c in clone.contents).strip()


def parse_ascii_table(text: str) -> dict[str, Any] | None:
    """Parse PostgreSQL/MySQL-style +----+ ASCII tables into {columns, rows}."""
    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    pipe_lines = [ln for ln in lines if ln.lstrip().startswith("|") and ln.rstrip().endswith("|")]
    if len(pipe_lines) < 2:
        return None

    def split_row(ln: str) -> list[str]:
        inner = ln.strip()[1:-1]
        return [cell.strip() for cell in inner.split("|")]

    headers = split_row(pipe_lines[0])
    if not headers or all(h == "" for h in headers):
        return None
    rows = []
    for ln in pipe_lines[1:]:
        cells = split_row(ln)
        if len(cells) == len(headers):
            rows.append(cells)
    return {"columns": headers, "rows": rows}


def extract_sql_tables(sections: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Extract Sample data tables and Expected output table for SQL practice lessons."""
    tables: list[dict[str, Any]] = []
    expected_table: dict[str, Any] | None = None

    for sec in sections:
        title_l = sec["title"].lower()
        soup = BeautifulSoup(sec["html"], "html.parser")
        if "sample data" in title_l:
            # Find table names preceding each <pre>
            pres = soup.select("pre")
            for idx, pre in enumerate(pres):
                parsed = parse_ascii_table(pre.get_text())
                if not parsed:
                    continue
                table_name = f"table_{idx + 1}"
                # Look backwards for <p>Table <code>name</code>:</p>
                prev_p = pre.find_parent("div")
                candidate = pre.find_previous("p")
                if candidate:
                    code_el = candidate.select_one("code")
                    if code_el:
                        table_name = code_el.get_text(strip=True)
                    else:
                        m = re.search(r"Table\s+([a-zA-Z0-9_]+)", candidate.get_text(), re.IGNORECASE)
                        if m:
                            table_name = m.group(1)
                tables.append({
                    "name": table_name,
                    "columns": parsed["columns"],
                    "rows": parsed["rows"],
                })
        elif "expected output" in title_l:
            pre = soup.select_one("pre")
            if pre:
                expected_table = parse_ascii_table(pre.get_text())

    return tables, expected_table


def disambiguate_correct_index(
    prompt: str, options: list[dict[str, str]], flagged: list[int], explanation: str
) -> int:
    """Resolve the 18 scraper substring-collision quizzes using the explanation."""
    if len(flagged) == 1:
        return flagged[0]
    if not flagged:
        return 0

    exp_low = explanation.lower()
    letters = ["a", "b", "c", "d", "e", "f"]

    # 1. Check explicit letter references like "(b)", "(c) is correct", "option b"
    mentioned = []
    for idx in flagged:
        if idx < len(letters):
            ch = letters[idx]
            if re.search(rf"\(\s*{ch}\s*\)\s*(is|are|—|-|:)?\s*(correct|right|true)?", exp_low):
                # Prefer letters NOT explicitly called "is wrong"
                if not re.search(rf"\(\s*{ch}\s*\)\s*(is|are)\s*wrong", exp_low):
                    mentioned.append((idx, len(re.findall(rf"\(\s*{ch}\s*\)", exp_low))))

    # Check explicit "(X) is wrong" exclusions
    not_wrong = [
        idx
        for idx in flagged
        if idx < len(letters)
        and not re.search(rf"\(\s*{letters[idx]}\s*\)\s*(is|are)\s*wrong", exp_low)
        and not re.search(rf"\b{letters[idx]}\)\s*is\s*wrong", exp_low)
    ]
    if len(not_wrong) == 1:
        return not_wrong[0]

    # 2. Check exact phrases like "result is X" / "answer is X" / "prints X" / "evaluates to X" / "returns X"
    for idx in (not_wrong or flagged):
        opt_txt = options[idx]["text"].strip()
        # Strip trailing explanation after " - " in option
        core = opt_txt.split(" - ")[0].strip().lower()
        if core and re.search(
            rf"(result|answer|output|prints|evaluates to|returns|is)\s+['\"]?{re.escape(core)}['\"]?([.,!\s]|$)",
            exp_low,
        ):
            return idx

    # 3. Prefer option with longest text if one is full statement and other is prefix,
    # unless explanation says "(a) is wrong" etc.
    candidates = not_wrong or flagged
    # Look for "so (X)" or "hence (X)"
    for idx in candidates:
        if idx < len(letters) and re.search(rf"(so|hence|therefore|thus)\s*\(\s*{letters[idx]}\s*\)", exp_low):
            return idx

    # Fallback: check if one candidate has exact match in explanation
    best_idx = candidates[0]
    best_score = -1
    for idx in candidates:
        core = options[idx]["text"].split(" - ")[0].strip().lower()
        score = 0
        if core and core in exp_low:
            score += len(core)
        if idx < len(letters) and f"({letters[idx]})" in exp_low:
            score += 5
        if score > best_score:
            best_score = score
            best_idx = idx
    return best_idx


def parse_quiz_lesson(sec: Tag) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    for q_idx, qc in enumerate(sec.select(".quiz-card"), start=1):
        header_el = qc.select_one(".q-header")
        raw_prompt = header_el.get_text("\n", strip=False).strip() if header_el else f"Question {q_idx}"
        # Normalize leading/trailing spaces per line while preserving code indentation
        prompt_lines = raw_prompt.splitlines()
        prompt = "\n".join(line.rstrip() for line in prompt_lines).strip()
        prompt = re.sub(r"^Câu\s+\d+\s*:\s*", "", prompt, flags=re.IGNORECASE)

        options: list[dict[str, str]] = []
        flagged: list[int] = []
        for o_idx, opt in enumerate(qc.select(".quiz-options .option")):
            if "correct" in (opt.get("class") or []):
                flagged.append(o_idx)
            # Remove badge-correct before extracting text
            opt_copy = BeautifulSoup(str(opt), "html.parser")
            for b in opt_copy.select(".badge-correct"):
                b.decompose()
            opt_text = opt_copy.get_text(" ", strip=True)
            m = re.match(r"^\[([A-Z])\]\s*(.*)$", opt_text, flags=re.DOTALL)
            if m:
                label, text = m.group(1), m.group(2).strip()
            else:
                label, text = chr(65 + o_idx), opt_text
            options.append({"label": label, "text": text})

        exp_el = qc.select_one(".quiz-explanation")
        explanation = ""
        if exp_el:
            exp_copy = BeautifulSoup(str(exp_el), "html.parser")
            for strong in exp_copy.select("strong"):
                if "Giải thích" in strong.get_text():
                    strong.decompose()
                    break
            explanation = exp_copy.get_text("\n", strip=True).strip()

        correct_index = disambiguate_correct_index(prompt, options, flagged, explanation)
        questions.append({
            "id": f"q-{q_idx}",
            "number": q_idx,
            "prompt": prompt,
            "options": options,
            "correctIndex": correct_index,
            "explanation": explanation,
        })
    return questions


def parse_practice_lesson(sec: Tag, track: str) -> dict[str, Any]:
    container = sec.select_one(".practice-container")
    if not container:
        body = sec.select_one(".lesson-body")
        return {
            "difficulty": "Practice",
            "title": "",
            "summaryHtml": sanitize_fragment(body) if body else "",
            "sections": [],
            "starterCode": "",
            "sqlTables": [],
            "expectedTable": None,
            "expectedText": "",
        }

    # Check if there is an embedded textarea (e.g., Python Beginner recap)
    starter_code = ""
    ta = container.select_one("textarea")
    if ta:
        starter_code = html_lib.unescape(ta.get_text())

    # Difficulty badge
    diff_el = container.select_one("div > span.text-emerald-600, div > span[class*='font-medium']")
    difficulty = diff_el.get_text(strip=True) if diff_el else "Practice"
    if difficulty in {"Completed", "+30 XP"}:
        difficulty = "Beginner"

    # Prompt title
    h1 = container.select_one("h1")
    practice_title = h1.get_text(strip=True) if h1 else ""

    # Collect prose blocks
    prose_blocks = container.select(".challenge-description")
    summary_html = ""
    sections: list[dict[str, Any]] = []

    if prose_blocks:
        # First block without h3 is usually the summary
        first_has_h3 = bool(prose_blocks[0].select("h3"))
        if not first_has_h3:
            summary_html = sanitize_fragment(prose_blocks[0])
            rest_blocks = prose_blocks[1:]
        else:
            rest_blocks = prose_blocks

        for block in rest_blocks:
            h3s = block.select("h3, h2")
            if h3s:
                # Could be direct div children with <h3>
                children_divs = [d for d in block.find_all("div", recursive=False) if d.select_one("h3, h2")]
                if children_divs:
                    for d in children_divs:
                        heading = d.select_one("h3, h2")
                        sec_title = heading.get_text(strip=True)
                        d_clone = BeautifulSoup(str(d), "html.parser")
                        h_rem = d_clone.select_one("h3, h2")
                        if h_rem:
                            h_rem.decompose()
                        sections.append({
                            "title": sec_title,
                            "html": sanitize_fragment(d_clone),
                        })
                else:
                    sections.append({
                        "title": h3s[0].get_text(strip=True),
                        "html": sanitize_fragment(block),
                    })
            else:
                sections.append({
                    "title": "Instructions",
                    "html": sanitize_fragment(block),
                })

    sql_tables: list[dict[str, Any]] = []
    expected_table: dict[str, Any] | None = None
    expected_text = ""

    if track == "SQL":
        sql_tables, expected_table = extract_sql_tables(sections)
        if not starter_code and sql_tables:
            first_tbl = sql_tables[0]["name"]
            starter_code = f"-- Write your SQL query here\nSELECT *\nFROM {first_tbl}\nLIMIT 10;"
    elif track == "JavaScript" and not starter_code:
        starter_code = "// Write your JavaScript code here\nconsole.log('Hello Data Courses!');"
    elif track == "Python" and not starter_code:
        starter_code = "# Write your Python code here\n"

    for s in sections:
        if any(k in s["title"].lower() for k in ("expected output", "example 1", "expected")):
            s_soup = BeautifulSoup(s["html"], "html.parser")
            pre = s_soup.select_one("pre")
            if pre:
                expected_text = pre.get_text().strip()
                break

    return {
        "difficulty": difficulty,
        "title": practice_title,
        "summaryHtml": summary_html,
        "sections": sections,
        "starterCode": starter_code,
        "sqlTables": sql_tables,
        "expectedTable": expected_table,
        "expectedText": expected_text,
    }


def parse_theory_lesson(sec: Tag) -> dict[str, Any]:
    body = sec.select_one(".lesson-body")
    if not body:
        return {"contentHtml": "", "headings": []}

    # Extract section headings for mini-TOC
    headings: list[dict[str, Any]] = []
    for h in body.select("h2[id], h3[id]"):
        text = h.get_text(" ", strip=True)
        if text:
            headings.append({
                "id": h.get("id"),
                "text": text,
                "level": 2 if h.name == "h2" else 3,
            })

    # Clean duplicate top header if .lesson-body wraps the inner platform header
    body_clone = BeautifulSoup(str(body), "html.parser")
    # Remove top-level Completed/Chapter pill bar + duplicate h1 inside .lesson-body
    for top_wrap in body_clone.select(".max-w-3xl > div:first-child"):
        if top_wrap.select_one("h1"):
            top_wrap.decompose()
            break

    return {
        "contentHtml": sanitize_fragment(body_clone),
        "headings": headings,
    }


def parse_course_file(html_path: Path, track: str) -> dict[str, Any]:
    raw_title = html_path.parent.name
    course_id = slugify(raw_title)
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")

    # Map lesson-id -> chapter from sidebar .chapter-group
    lesson_to_chapter: dict[str, tuple[int, str]] = {}
    chapters_meta: list[dict[str, Any]] = []
    chap_idx = 0
    for grp in soup.select(".course-toc-accordion .chapter-group"):
        title_el = grp.select_one(".chapter-group-title")
        chap_title = title_el.get_text(" ", strip=True) if title_el else f"Chapter {chap_idx + 1}"
        if chap_title.strip().lower() == "submit rating":
            continue
        chap_idx += 1
        chapters_meta.append({
            "id": f"ch-{chap_idx}",
            "number": chap_idx,
            "title": chap_title,
            "lessons": [],
        })
        for a in grp.select(".lesson-toc-item a[href^='#']"):
            lid = a["href"].lstrip("#")
            lesson_to_chapter[lid] = (chap_idx - 1, chap_title)

    # Parse all lesson cards
    stats = {"theory": 0, "practice": 0, "quiz": 0, "quizQuestions": 0}
    for sec in soup.select("section.lesson-card"):
        lid = sec.get("id", "")
        if lid not in lesson_to_chapter:
            continue
        c_pos, _ = lesson_to_chapter[lid]
        badge = sec.select_one(".lesson-type-badge")
        badge_classes = badge.get("class", []) if badge else []
        if "quiz" in badge_classes:
            l_type = "quiz"
        elif "practice" in badge_classes:
            l_type = "practice"
        else:
            l_type = "theory"

        title_el = sec.select_one(".lesson-anchor-title")
        raw_lesson_title = title_el.get_text(" ", strip=True) if title_el else lid
        lesson_title = clean_lesson_title(raw_lesson_title)

        lesson_obj: dict[str, Any] = {
            "id": lid,
            "index": len(chapters_meta[c_pos]["lessons"]) + 1,
            "title": lesson_title,
            "rawTitle": raw_lesson_title,
            "type": l_type,
        }

        if l_type == "quiz":
            questions = parse_quiz_lesson(sec)
            lesson_obj["questions"] = questions
            stats["quiz"] += 1
            stats["quizQuestions"] += len(questions)
        elif l_type == "practice":
            lesson_obj["practice"] = parse_practice_lesson(sec, track)
            stats["practice"] += 1
        else:
            lesson_obj["theory"] = parse_theory_lesson(sec)
            stats["theory"] += 1

        chapters_meta[c_pos]["lessons"].append(lesson_obj)

    # Assign global sequential lesson numbers across chapters
    global_idx = 0
    for ch in chapters_meta:
        for l in ch["lessons"]:
            global_idx += 1
            l["globalIndex"] = global_idx

    estimated_hours = max(3, round(global_idx * 0.3))

    return {
        "id": course_id,
        "title": raw_title,
        "track": track,
        "level": LEVEL_MAP.get(raw_title, "Beginner"),
        "description": COURSE_DESCRIPTIONS.get(raw_title, f"Interactive {raw_title} course."),
        "estimatedHours": estimated_hours,
        "chapterCount": len(chapters_meta),
        "lessonCount": global_idx,
        "stats": stats,
        "chapters": chapters_meta,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    src_root = Path(args.source)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not src_root.exists():
        print(f"Source directory not found: {src_root}", file=sys.stderr)
        return 1

    manifest_courses: list[dict[str, Any]] = []

    tracks = [d for d in src_root.iterdir() if d.is_dir()]
    tracks.sort(key=lambda d: TRACK_ORDER.index(d.name) if d.name in TRACK_ORDER else 999)

    for track_dir in tracks:
        track_name = track_dir.name
        level_rank = {"Beginner": 0, "Intermediate": 1, "Advanced": 2, "Specialized": 3}
        course_dirs = sorted(
            [d for d in track_dir.iterdir() if d.is_dir()],
            key=lambda d: (level_rank.get(LEVEL_MAP.get(d.name, "Beginner"), 9), d.name),
        )
        for c_dir in course_dirs:
            full_htmls = sorted(c_dir.glob("00 - *.html"))
            if not full_htmls:
                continue
            course_data = parse_course_file(full_htmls[0], track_name)
            course_file = out_dir / f"{course_data['id']}.json"
            course_file.write_text(
                json.dumps(course_data, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

            # Lightweight summary for manifest
            manifest_courses.append({
                "id": course_data["id"],
                "title": course_data["title"],
                "track": course_data["track"],
                "level": course_data["level"],
                "description": course_data["description"],
                "estimatedHours": course_data["estimatedHours"],
                "chapterCount": course_data["chapterCount"],
                "lessonCount": course_data["lessonCount"],
                "stats": course_data["stats"],
                "chapters": [
                    {
                        "id": ch["id"],
                        "number": ch["number"],
                        "title": ch["title"],
                        "lessons": [
                            {
                                "id": l["id"],
                                "globalIndex": l["globalIndex"],
                                "title": l["title"],
                                "type": l["type"],
                            }
                            for l in ch["lessons"]
                        ],
                    }
                    for ch in course_data["chapters"]
                ],
            })
            print(
                f"Built {course_data['id']:22s} | {course_data['chapterCount']:2d} ch | "
                f"{course_data['lessonCount']:2d} lessons | {course_file.stat().st_size // 1024:4d} KB"
            )

    manifest = {
        "version": 1,
        "totalCourses": len(manifest_courses),
        "tracks": TRACK_ORDER,
        "courses": manifest_courses,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Done! {len(manifest_courses)} courses written to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
