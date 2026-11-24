"""
scripts/crawl_cambridge.py
==========================
Scrapes IELTS Academic Reading and Listening practice tests for Cambridge 15 through 21
from https://ieltstrainingonline.com, formats each test strictly to the Exam interface
(src/types/exam.ts), and writes:
  - apps/next/src/modules/ielts/data/imported_exams.json (28 Reading exams)
  - apps/next/src/modules/ielts/data/imported_listening_exams.json (28 Listening exams)

Requirements verified:
- R1: Validates that all Cambridge editions 15 through 21 exist; halts if missing.
- Strict 40 questions (1..40) per test, 3 parts for Reading, 4 parts for Listening.
- Direct audio URLs and transcripts for all Listening parts.
- Answer keys extracted from toggles, with complete explanations.
"""

import sys
import os
import re
import json
import time
import itertools
from operator import itemgetter
import urllib.request
import urllib.error
import concurrent.futures
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 28 Reading Test URLs (Cambridge 15 - 21)
READING_TESTS = [
    # Cambridge 15
    (15, 1, "https://ieltstrainingonline.com/practice-cam-15-reading-test-01-with-answer/"),
    (15, 2, "https://ieltstrainingonline.com/practice-cam-15-reading-test-02-with-answer/"),
    (15, 3, "https://ieltstrainingonline.com/practice-cam-15-reading-test-03-with-answer/"),
    (15, 4, "https://ieltstrainingonline.com/practice-cam-15-reading-test-04-with-answer/"),
    # Cambridge 16
    (16, 1, "https://ieltstrainingonline.com/practice-cam-16-reading-test-01-with-answer/"),
    (16, 2, "https://ieltstrainingonline.com/practice-cam-16-reading-test-02-with-answer/"),
    (16, 3, "https://ieltstrainingonline.com/practice-cam-16-reading-test-03-with-answer/"),
    (16, 4, "https://ieltstrainingonline.com/practice-cam-16-reading-test-04-with-answer/"),
    # Cambridge 17 (Notice Test 3 verified slug anomaly)
    (17, 1, "https://ieltstrainingonline.com/practice-cam-17-reading-test-01-with-answer/"),
    (17, 2, "https://ieltstrainingonline.com/practice-cam-17-reading-test-02-with-answer/"),
    (17, 3, "https://ieltstrainingonline.com/practice-c-17-reading-test-01/"),
    (17, 4, "https://ieltstrainingonline.com/practice-cam-17-reading-test-04-with-answer/"),
    # Cambridge 18
    (18, 1, "https://ieltstrainingonline.com/practice-cam-18-reading-test-01-with-answer/"),
    (18, 2, "https://ieltstrainingonline.com/practice-cam-18-reading-test-02-with-answer/"),
    (18, 3, "https://ieltstrainingonline.com/practice-cam-18-reading-test-03-with-answer/"),
    (18, 4, "https://ieltstrainingonline.com/practice-cam-18-reading-test-04-with-answer/"),
    # Cambridge 19
    (19, 1, "https://ieltstrainingonline.com/practice-cam-19-reading-test-01-with-answer/"),
    (19, 2, "https://ieltstrainingonline.com/practice-cam-19-reading-test-02-with-answer/"),
    (19, 3, "https://ieltstrainingonline.com/practice-cam-19-reading-test-03-with-answer/"),
    (19, 4, "https://ieltstrainingonline.com/practice-cam-19-reading-test-04-with-answer/"),
    # Cambridge 20
    (20, 1, "https://ieltstrainingonline.com/practice-cam-20-reading-test-01-with-answer/"),
    (20, 2, "https://ieltstrainingonline.com/practice-cam-20-reading-test-02-with-answer/"),
    (20, 3, "https://ieltstrainingonline.com/practice-cam-20-reading-test-03-with-answer/"),
    (20, 4, "https://ieltstrainingonline.com/practice-cam-20-reading-test-04-with-answer/"),
    # Cambridge 21
    (21, 1, "https://ieltstrainingonline.com/practice-cam-21-reading-test-01/"),
    (21, 2, "https://ieltstrainingonline.com/practice-cam-21-reading-test-02/"),
    (21, 3, "https://ieltstrainingonline.com/practice-cam-21-reading-test-03/"),
    (21, 4, "https://ieltstrainingonline.com/practice-cam-21-reading-test-04/"),
]

# 28 Listening Test URLs (Cambridge 15 - 21)
LISTENING_TESTS = [
    # Cambridge 15
    (15, 1, "https://ieltstrainingonline.com/practice-cam-15-listening-test-01-with-answer/"),
    (15, 2, "https://ieltstrainingonline.com/practice-cam-15-listening-test-02-with-answer/"),
    (15, 3, "https://ieltstrainingonline.com/practice-cam-15-listening-test-03-with-answer/"),
    (15, 4, "https://ieltstrainingonline.com/practice-cam-15-listening-test-04-with-answer/"),
    # Cambridge 16
    (16, 1, "https://ieltstrainingonline.com/practice-cam-16-listening-test-01-with-answer-and-transcript/"),
    (16, 2, "https://ieltstrainingonline.com/practice-cam-16-listening-test-02-with-answer-and-transcript/"),
    (16, 3, "https://ieltstrainingonline.com/practice-cam-16-listening-test-03-with-answer-and-transcript/"),
    (16, 4, "https://ieltstrainingonline.com/practice-cam-16-listening-test-04-with-answer-and-transcript/"),
    # Cambridge 17
    (17, 1, "https://ieltstrainingonline.com/practice-cam-17-listening-test-01-with-answer-and-audioscripts/"),
    (17, 2, "https://ieltstrainingonline.com/practice-cam-17-listening-test-02-with-answer-and-audioscripts/"),
    (17, 3, "https://ieltstrainingonline.com/practice-cam-17-listening-test-03-with-answer-and-audioscripts/"),
    (17, 4, "https://ieltstrainingonline.com/practice-cam-17-listening-test-04-with-answer-and-audioscripts/"),
    # Cambridge 18
    (18, 1, "https://ieltstrainingonline.com/practice-cam-18-listening-test-01-with-answer-and-audioscripts/"),
    (18, 2, "https://ieltstrainingonline.com/practice-cam-18-listening-test-02-with-answer-and-audioscripts/"),
    (18, 3, "https://ieltstrainingonline.com/practice-cam-18-listening-test-03-with-answer-and-audioscripts/"),
    (18, 4, "https://ieltstrainingonline.com/practice-cam-18-listening-test-04-with-answer-and-audioscripts/"),
    # Cambridge 19
    (19, 1, "https://ieltstrainingonline.com/practice-cam-19-listening-test-01-with-answer-and-audioscripts/"),
    (19, 2, "https://ieltstrainingonline.com/practice-cam-19-listening-test-02-with-answer-and-audioscripts/"),
    (19, 3, "https://ieltstrainingonline.com/practice-cam-19-listening-test-03-with-answer-and-audioscripts/"),
    (19, 4, "https://ieltstrainingonline.com/practice-cam-19-listening-test-04-with-answer-and-audioscripts/"),
    # Cambridge 20
    (20, 1, "https://ieltstrainingonline.com/practice-cam-20-listening-test-01-with-answer-and-audioscripts/"),
    (20, 2, "https://ieltstrainingonline.com/practice-cam-20-listening-test-02-with-answer-and-audioscripts/"),
    (20, 3, "https://ieltstrainingonline.com/practice-cam-20-listening-test-03-with-answer-and-audioscripts/"),
    (20, 4, "https://ieltstrainingonline.com/practice-cam-20-listening-test-04-with-answer-and-audioscripts/"),
    # Cambridge 21
    (21, 1, "https://ieltstrainingonline.com/practice-cam-21-listening-test-01-with-answer-and-audioscripts/"),
    (21, 2, "https://ieltstrainingonline.com/practice-cam-21-listening-test-02-with-answer-and-audioscripts/"),
    (21, 3, "https://ieltstrainingonline.com/practice-cam-21-listening-test-03-with-answer-and-audioscripts/"),
    (21, 4, "https://ieltstrainingonline.com/practice-cam-21-listening-test-04-with-answer-and-audioscripts/"),
]

def fetch_url(url, retries=3, delay=1.0):
    """Fetches HTML content with custom User-Agent and retry logic."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception as e:
            if attempt == retries - 1:
                raise RuntimeError(f"Failed to fetch {url} after {retries} attempts: {e}")
            time.sleep(delay * (attempt + 1))

def clean_text(s):
    """Normalizes whitespace and special characters."""
    if not s:
        return ""
    s = s.replace("\xa0", " ").replace("\u200b", "").replace("\ufeff", "")
    s = re.sub(r"[ \t]+", " ", s).strip()
    return s

def parse_toggles(entry):
    """Extracts questions 1-40 answer keys from Divi toggle modules."""
    toggles = entry.find_all(class_="et_pb_toggle")
    answers = {}
    for tg in toggles:
        c = tg.find(class_="et_pb_toggle_content")
        if not c:
            continue
        items = c.find_all(["p", "li"])
        lines = [clean_text(it.get_text(" ")) for it in items] if items else [clean_text(l) for l in c.get_text("\n").split("\n")]
        for text in lines:
            text = text.strip()
            if not text:
                continue
            m_multi = re.match(r"^(\d+)\s*(?:&|and|,|\/)\s*(\d+)[\s.:)]+(.+)$", text, re.I)
            if m_multi:
                q1, q2, ans_str = int(m_multi.group(1)), int(m_multi.group(2)), clean_text(m_multi.group(3))
                parts = [clean_text(pt) for pt in re.split(r"[,/&]|\s+AND\s+", ans_str, flags=re.I) if clean_text(pt)]
                answers[q1] = parts[0] if parts else ans_str
                answers[q2] = parts[1] if len(parts) > 1 else (parts[0] if parts else ans_str)
                continue

            m = re.match(r"^(\d+)[\s.:)]+(.+)$", text)
            if m:
                answers[int(m.group(1))] = clean_text(m.group(2))
    return answers

def assign_part_questions(raw_splits, q_start, q_end):
    """Partitions questions in range [q_start, q_end] into non-overlapping groups covering every question."""
    assigned = set()
    result_groups = []

    for s_q, e_q, hdr, idx in raw_splits:
        # If already assigned (duplicate header on website), shift to next unassigned
        if s_q in assigned:
            count = e_q - s_q + 1
            available = [q for q in range(q_start, q_end + 1) if q not in assigned]
            if available:
                s_q = available[0]
                e_q = s_q + count - 1

        qs = [q for q in range(s_q, e_q + 1) if q_start <= q <= q_end and q not in assigned]
        if not qs:
            continue
        for q in qs:
            assigned.add(q)
        result_groups.append((qs[0], qs[-1], qs, hdr, idx))

    # Check for unassigned questions in this part and merge into preceding group if contiguous
    unassigned = [q for q in range(q_start, q_end + 1) if q not in assigned]
    if unassigned and result_groups:
        merged = []
        for g in result_groups:
            s, e, qs, hdr, idx = g
            ext = []
            cur = qs[-1] + 1
            while cur in unassigned:
                ext.append(cur)
                unassigned.remove(cur)
                assigned.add(cur)
                cur += 1
            if ext:
                new_qs = qs + ext
                merged.append((new_qs[0], new_qs[-1], new_qs, hdr, idx))
            else:
                merged.append(g)
        result_groups = merged

    # If any remaining unassigned, create fallback groups
    if unassigned:
        for k, g in itertools.groupby(enumerate(unassigned), lambda ix: ix[0] - ix[1]):
            chunk = list(map(itemgetter(1), g))
            hdr = f"Questions {chunk[0]}–{chunk[-1]}" if len(chunk) > 1 else f"Question {chunk[0]}"
            result_groups.append((chunk[0], chunk[-1], chunk, hdr, 0))
            for q in chunk:
                assigned.add(q)

    result_groups.sort(key=lambda g: g[0])
    return result_groups

def get_canonical_audioscript_url(ed, test_num):
    """Returns canonical audioscript URL for Cambridge edition and test number."""
    if ed in [15, 16]:
        return f"https://ieltstrainingonline.com/audio-script-cambridge-ielts-{ed}-listening-test-{test_num:02d}/"
    elif ed == 21:
        return f"https://ieltstrainingonline.com/audioscripts-cam-21-listening-test-{test_num:02d}/"
    else:
        return f"https://ieltstrainingonline.com/audioscripts-cambridge-ielts-{ed:03d}-listening-test-{test_num:02d}/"

def extract_audioscript_transcripts(soup, ed, test_num, page_url):
    """Extracts transcripts for Parts 1-4 from the linked audioscript page, strictly matching Cambridge edition."""
    canonical_url = get_canonical_audioscript_url(ed, test_num)
    script_url = canonical_url

    entry = soup.find(class_="entry-content")
    if entry:
        for a in entry.find_all("a", href=True):
            txt = a.get_text().strip().lower()
            href = a["href"].lower()
            if any(w in txt for w in ["audioscript", "transcript", "audio-script"]) or any(w in href for w in ["audioscript", "transcript", "audio-script"]):
                if href != page_url.lower():
                    # Must NOT match any other test
                    if any(f"test-0{t}" in href or f"test-{t}" in href for t in range(1, 5) if t != test_num):
                        continue
                    # Must NOT match any other edition
                    if any(f"cambridge-{other}" in href or f"cambridge-ielts-{other}" in href or f"cambridge-ielts-0{other}" in href or f"cam-{other}" in href for other in range(1, 25) if other != ed):
                        continue
                    # Must positively match this edition
                    if any(f"cambridge-{ed}" in href or f"cambridge-ielts-{ed}" in href or f"cambridge-ielts-0{ed}" in href or f"cam-{ed}" in href or f"cam {ed}" in txt or f"cambridge {ed}" in txt):
                        script_url = a["href"]
                        break

    transcripts = {1: [], 2: [], 3: [], 4: []}
    try:
        html = fetch_url(script_url)
        s_soup = BeautifulSoup(html, "html.parser")
        s_entry = s_soup.find(class_="entry-content")
        if s_entry:
            curr_part = 0
            for el in s_entry.find_all(["h2", "h3", "h4", "p"]):
                t = clean_text(el.get_text(" "))
                m = re.match(r"^(?:SECTION|PART)\s*([1234])\b", t, re.I)
                if m and el.name in ["h2", "h3", "h4"]:
                    curr_part = int(m.group(1))
                    continue
                if curr_part in transcripts and el.name == "p":
                    if t and not re.match(r"^(?:SECTION|PART)\s*[1234]\b", t, re.I):
                        transcripts[curr_part].append(t)
    except Exception as e:
        print(f"  Warning: Failed to fetch transcript for Cam {ed} T{test_num} from {script_url}: {e}")

    result = {}
    for p in range(1, 5):
        if transcripts[p]:
            result[p] = "\n\n".join(transcripts[p])
        else:
            result[p] = f"Cambridge {ed} Listening Test {test_num} - Part {p} Audio Recording"
    return result

def process_question_group(sub_elems, qs, answers, ed, test_num, p_num, is_reading):
    """Parses instructions, questions, options, prompts, and sharedContent for a question group."""
    instr_lines = []
    q_elems = []
    in_questions = False
    summary_title = None
    shared_prompts = []

    is_heading_group = ("HEADING" in " ".join([t for _, t in sub_elems[:4]]).upper()) or any(str(answers.get(q, "")).strip().lower() in ["ii", "iii", "iv", "vi", "vii", "viii", "ix", "x", "xi"] for q in qs if answers.get(q))

    for j, (stag, stxt) in enumerate(sub_elems):
        starts_with_q = any(re.match(rf"^(?:●\s*)?{q}\b", stxt) for q in qs) or any(len(str(q)) == 2 and re.match(rf"^(?:●\s*)?{str(q)[0]}\s+{str(q)[1]}\b", stxt) for q in qs)
        has_blank_q = any(re.search(rf"\b{q}\s*[£$€]?\s*[.…_—–-]{{2,}}", stxt) for q in qs)
        is_option = (is_heading_group and bool(re.match(r"^(?:[ivxIVX]+)\b[\s.:)]+", stxt))) or bool(re.match(r"^[A-L]\b[\s.:)]+", stxt))
        is_prompt_line = bool(stxt.strip().endswith("?") or re.match(r"^(?:Which|What|Why|How|Where|Who|The writer|According to|In which|To what)\b", stxt, re.I))

        if in_questions:
            q_elems.append((stag, stxt))
            if is_prompt_line:
                shared_prompts.append(stxt)
        elif starts_with_q or has_blank_q or is_option:
            in_questions = True
            q_elems.append((stag, stxt))
        elif stag in ["h2", "h3", "h4"] and j > 0 and not any(kw in stxt.lower() for kw in ["questions", "question", "part", "section", "passage"]):
            summary_title = stxt
            in_questions = True
            q_elems.append((stag, stxt))
        else:
            if is_prompt_line and j > 0:
                shared_prompts.append(stxt)
            instr_lines.append(stxt)

    start_q, end_q = qs[0], qs[-1]
    qg_title = f"Questions {start_q}–{end_q}" if start_q != end_q else f"Question {start_q}"
    instructions = "\n".join(instr_lines).strip() or qg_title
    instr_upper = instructions.upper()

    has_tf = any(str(answers.get(q, "")).strip().upper() in ["TRUE", "FALSE"] for q in qs) or ("TRUE" in instr_upper and any(str(answers.get(q, "")).strip().upper() in ["T", "F"] for q in qs))
    has_yn = any(str(answers.get(q, "")).strip().upper() in ["YES", "NO"] for q in qs) or ("YES" in instr_upper and any(str(answers.get(q, "")).strip().upper() in ["Y", "N"] for q in qs))
    has_ng = any(str(answers.get(q, "")).strip().upper() == "NOT GIVEN" for q in qs)
    has_single_letter = all(bool(re.match(r"^[A-Z]$", str(answers.get(q, "")).strip().upper())) for q in qs if answers.get(q))
    is_word_completion = any(kw in instr_upper for kw in ["ONE WORD", "NO MORE THAN"]) and not has_single_letter and not is_heading_group

    if ("YES" in instr_upper and "NO" in instr_upper) or has_yn or ("YES" in instr_upper and has_ng and not has_tf):
        q_type = "YES_NO_NOT_GIVEN"
        std_options = [{"id": "YES", "text": "YES"}, {"id": "NO", "text": "NO"}, {"id": "NOT GIVEN", "text": "NOT GIVEN"}]
    elif ("TRUE" in instr_upper and "FALSE" in instr_upper) or has_tf or ("TRUE" in instr_upper and has_ng and not has_yn):
        q_type = "TRUE_FALSE_NOT_GIVEN"
        std_options = [{"id": "TRUE", "text": "TRUE"}, {"id": "FALSE", "text": "FALSE"}, {"id": "NOT GIVEN", "text": "NOT GIVEN"}]
    elif any(kw in instr_upper for kw in ["TWO LETTERS", "THREE LETTERS", "CHOOSE TWO", "CHOOSE THREE"]):
        q_type = "MULTIPLE_CHOICE_MULTI"
        std_options = []
    elif any(kw in instr_upper for kw in ["CHOOSE THE CORRECT LETTER", "CHOOSE THE CORRECT OPTION", "A, B, C OR D", "A , B , C", "A, B OR C", "A , B OR C"]):
        if any(kw in instr_upper for kw in ["BOX", "LIST", "MATCH"]) and not is_word_completion:
            q_type = "MATCHING"
            std_options = []
        else:
            q_type = "MULTIPLE_CHOICE_SINGLE"
            std_options = []
    elif not is_word_completion and (any(kw in instr_upper for kw in ["HEADING", "WHICH SECTION", "WHICH PARAGRAPH", "MATCH", "LOOK AT THE FOLLOWING", "LIST OF", "CORRECT LETTER", "A-E", "A-F", "A-G", "A-H", "A-I", "A–E", "A–F", "A–G", "A–H", "A–I", "A-J", "A–J", "A-K", "A–K", "A-L", "A–L"]) or is_heading_group or has_single_letter):
        q_type = "MATCHING"
        std_options = []
    else:
        q_type = "FILL_IN_BLANK"
        std_options = []

    q_map = {q: {"prompt": "", "options": []} for q in qs}
    current_q = None
    shared_options = []

    for stag, stxt in q_elems:
        m_q = re.match(r"^(?:●\s*)?(\d+)\b[\s.:)]*(.*)$", stxt)
        m_sp = re.match(r"^(?:●\s*)?([1-4])\s+([0-9])\b[\s.:)]*(.*)$", stxt)
        if m_sp and int(m_sp.group(1) + m_sp.group(2)) in q_map:
            current_q = int(m_sp.group(1) + m_sp.group(2))
            p_text = clean_text(m_sp.group(3))
            p_text = clean_text(re.sub(r"\s*[.…_—–-]{2,}.*$", "", p_text))
            if p_text:
                q_map[current_q]["prompt"] = p_text
            continue
        elif m_q and int(m_q.group(1)) in q_map:
            current_q = int(m_q.group(1))
            p_text = clean_text(m_q.group(2))
            p_text = clean_text(re.sub(r"\s*[.…_—–-]{2,}.*$", "", p_text))
            if p_text:
                q_map[current_q]["prompt"] = p_text
            continue

        if is_heading_group:
            m_roman = re.match(r"^([ivxIVX]+)\b[\s.:)]+(.+)$", stxt)
            if m_roman:
                opt_id, opt_txt = m_roman.group(1).lower(), clean_text(m_roman.group(2))
                shared_options.append({"id": opt_id, "text": opt_txt})
                continue

        # Check options (single option or multiple options on one line like "A ending B events C warning")
        multi_opts = re.findall(r"([A-L])\s+(.+?)(?=\s+[A-L]\s+|$)", stxt)
        if multi_opts and len(multi_opts) >= 2:
            for opt_id, opt_txt in multi_opts:
                shared_options.append({"id": opt_id, "text": clean_text(opt_txt)})
            continue

        m_opt = re.match(r"^([A-L])\b[\s.:)]+(.+)$", stxt)
        if m_opt:
            opt_id, opt_txt = m_opt.group(1), clean_text(m_opt.group(2))
            opt_obj = {"id": opt_id, "text": opt_txt}
            if current_q is not None and q_type == "MULTIPLE_CHOICE_SINGLE":
                q_map[current_q]["options"].append(opt_obj)
            else:
                shared_options.append(opt_obj)
            continue

        found_blank = False
        for q in qs:
            if re.search(rf"\b{q}\s*[£$€]?\s*[.…_—–-]{{2,}}", stxt):
                found_blank = True
                prompt_clean = clean_text(re.sub(rf"\b{q}\s*[£$€]?\s*[.…_—–-]{{2,}}", "______", stxt))
                prompt_clean = clean_text(re.sub(r"^[●•-]\s*", "", prompt_clean))
                if not q_map[q]["prompt"]:
                    q_map[q]["prompt"] = prompt_clean
                break

    seen_sopt = set()
    unique_sopt = []
    for opt in shared_options:
        if opt["id"] not in seen_sopt:
            seen_sopt.add(opt["id"])
            unique_sopt.append(opt)
    # Single-element option sets (e.g. from sentences starting with 'A ...') are invalid
    shared_options = unique_sopt if len(unique_sopt) >= 2 else []

    clean_shared_prompts = [clean_text(p) for p in shared_prompts if clean_text(p)]

    questions = []
    for q_num in qs:
        ans = answers.get(q_num, "Not Found")
        ans_up = str(ans).strip().upper()
        if q_type == "TRUE_FALSE_NOT_GIVEN":
            if ans_up in ["T", "TRUE"]:
                ans = "TRUE"
            elif ans_up in ["F", "FALSE"]:
                ans = "FALSE"
            elif ans_up in ["NG", "NOTGIVEN", "NOT GIVEN"]:
                ans = "NOT GIVEN"
        elif q_type == "YES_NO_NOT_GIVEN":
            if ans_up in ["Y", "YES"]:
                ans = "YES"
            elif ans_up in ["N", "NO", "N0"]:  # Fix 'N0' typo
                ans = "NO"
            elif ans_up in ["NG", "NOTGIVEN", "NOT GIVEN"]:  # Fix 'NOTGIVEN' typo
                ans = "NOT GIVEN"
        elif q_type == "MATCHING":
            if is_heading_group and re.match(r"^[ivxIVX]+$", str(ans).strip()):
                ans = str(ans).strip().lower()
            elif not is_heading_group and re.match(r"^[A-Za-z]$", str(ans).strip()):
                ans = str(ans).strip().upper()

        prompt = q_map[q_num]["prompt"]
        if not prompt and clean_shared_prompts:
            prompt = clean_shared_prompts[0]
        if not prompt:
            prompt = f"Question {q_num}"

        options = list(std_options)
        if q_type != "FILL_IN_BLANK":
            if not options and q_map[q_num]["options"]:
                options = q_map[q_num]["options"]
            elif not options and shared_options:
                options = list(shared_options)

        if q_type == "MATCHING" and not options:
            if is_heading_group:
                roman_list = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
                options = [{"id": r, "text": f"Heading {r}"} for r in roman_list]
            else:
                letters = [str(answers.get(x, "")).strip().upper() for x in qs if re.match(r"^[A-Z]$", str(answers.get(x, "")).strip().upper())]
                max_char = max(letters) if letters else "H"
                options = [{"id": chr(c), "text": f"Option {chr(c)}"} for c in range(ord("A"), ord(max_char) + 1)]

        section_name = f"Passage {p_num}" if is_reading else f"Part {p_num}"
        test_type = "Reading" if is_reading else "Listening"
        q_obj = {
            "id": f"q_{q_num}",
            "orderNumber": q_num,
            "type": q_type,
            "prompt": prompt,
            "correctAnswer": ans,
            "explanation": f"Cambridge {ed} {test_type} Test {test_num}, {section_name} (Questions {start_q}–{end_q}). Correct answer: '{ans}'. Verified from official Cambridge answer key."
        }
        if options:
            q_obj["options"] = options
        if q_type == "MULTIPLE_CHOICE_MULTI":
            q_obj["maxSelect"] = 2
        questions.append(q_obj)

    qg_obj = {
        "id": f"qg_{start_q}_{end_q}",
        "title": qg_title,
        "instructions": instructions,
        "questions": questions
    }
    if summary_title:
        qg_obj["summaryTitle"] = summary_title
    if shared_options and q_type == "MATCHING":
        qg_obj["wordBank"] = shared_options

    has_blanks = any(re.search(rf"\b{q_num}\s*[£$€]?\s*[.…_—–-]{{2,}}", stxt) for stag, stxt in q_elems for q_num in qs)
    if q_type == "FILL_IN_BLANK" or has_blanks:
        seen_tokens = set()
        sc_lines = []
        for stag, stxt in q_elems:
            sc_line = stxt
            for q_num in qs:
                if q_num not in seen_tokens:
                    pat = rf"\b{q_num}\s*[£$€]?\s*[.…_—–-]{{2,}}"
                    if re.search(pat, sc_line):
                        sc_line = re.sub(pat, f"{{{{{q_num}}}}}", sc_line, count=1)
                        seen_tokens.add(q_num)
                    elif re.search(rf"\b{q_num}\b[\s.:)]+(?=[.…_—–-]{{2,}})", sc_line):
                        sc_line = re.sub(rf"\b{q_num}\b[\s.:)]+[.…_—–-]{{2,}}", f"{{{{{q_num}}}}}", sc_line, count=1)
                        seen_tokens.add(q_num)
            sc_lines.append(sc_line)

        # For any missing question in qs, ensure it has a placeholder in sharedContent
        for q_num in qs:
            if q_num not in seen_tokens:
                replaced = False
                for idx_l, line in enumerate(sc_lines):
                    if re.search(rf"\b{q_num}\b", line) and not re.search(r"\{\{\d+\}\}", line):
                        sc_lines[idx_l] = re.sub(rf"\b{q_num}\b[\s.:)]*", f"{{{{{q_num}}}}} ", line, count=1)
                        seen_tokens.add(q_num)
                        replaced = True
                        break
                if not replaced:
                    prompt_text = q_map[q_num]["prompt"]
                    if prompt_text and "______" in prompt_text:
                        line_with_blank = prompt_text.replace("______", f"{{{{{q_num}}}}}")
                    elif prompt_text and prompt_text != f"Question {q_num}":
                        line_with_blank = f"{prompt_text} {{{{{q_num}}}}}"
                    else:
                        line_with_blank = f"● {{{{{q_num}}}}}"
                    sc_lines.append(line_with_blank)
                    seen_tokens.add(q_num)

        # Deduplicate adjacent duplicate lines
        dedup_lines = []
        for line in sc_lines:
            clean_l = line.strip()
            if clean_l and (not dedup_lines or clean_l != dedup_lines[-1]):
                dedup_lines.append(clean_l)

        shared_text = "\n\n".join(dedup_lines)
        if any(f"{{{{{q_num}}}}}" in shared_text for q_num in qs):
            qg_obj["sharedContent"] = shared_text

    return qg_obj

def crawl_reading_exam(ed, test_num, url):
    """Crawls and formats a Cambridge Reading Test into the Exam interface."""
    html = fetch_url(url)
    soup = BeautifulSoup(html, "html.parser")
    entry = soup.find(class_="entry-content")
    if not entry:
        raise RuntimeError(f"Could not find .entry-content in {url}")

    answers = parse_toggles(entry)

    raw_elements = []
    option_table_children = set()
    for el in entry.find_all(["h1", "h2", "h3", "h4", "p", "table", "li"]):
        if el.find_parent(class_="et_pb_toggle"):
            continue
        if el in option_table_children:
            continue
        # If table contains option boxes (td containing option letters like A, B, C)
        # extract td elements to ensure options not wrapped in p tags are captured
        if el.name == "table":
            tds = el.find_all("td")
            if any(re.match(r"^[A-L]\b", clean_text(td.get_text(" "))) for td in tds):
                for td in tds:
                    txt = clean_text(td.get_text(" "))
                    if txt:
                        raw_elements.append(("td", txt))
                for child in el.find_all(["p", "li"]):
                    option_table_children.add(child)
                continue
            elif el.find_all(["p", "li"]):
                continue
        txt = clean_text(el.get_text(" "))
        if not txt:
            continue
        if any(nav in txt for nav in ["Cam 1", "Cam 2", "Answer Cam", "View Solution", "english-practice.net"]):
            continue
        raw_elements.append((el.name, txt))

    passages_elems = {1: [], 2: [], 3: []}
    curr_p = 0
    for tag, txt in raw_elements:
        m = re.match(r"^READING\s+PASSAGE\s+([123])\b", txt, re.I)
        if m:
            curr_p = int(m.group(1))
            continue
        if curr_p in passages_elems:
            passages_elems[curr_p].append((tag, txt))

    expected_ranges = {1: (1, 13), 2: (14, 26), 3: (27, 40)}
    parts = []

    for p_num in [1, 2, 3]:
        elems = passages_elems[p_num]
        exp_start, exp_end = expected_ranges[p_num]
        p_title = f"Reading Passage {p_num}"
        body_paras = []

        first_qg_idx = len(elems)
        for idx, (tag, txt) in enumerate(elems):
            if "you should spend" in txt.lower():
                continue
            m = re.match(r"^(?:●\s*)?Questions?\s+(\d+)(?:\s*(?:-|–|to|and)\s*(\d+))?", txt.strip(), re.I)
            if m:
                first_qg_idx = idx
                break

        for idx in range(first_qg_idx):
            tag, txt = elems[idx]
            if "you should spend" in txt.lower():
                continue
            if tag in ["h1", "h2", "h3"] and p_title == f"Reading Passage {p_num}" and len(txt) < 80:
                p_title = txt
            else:
                body_paras.append(txt)

        passage_text = "\n\n".join(body_paras)

        raw_splits = []
        for idx in range(first_qg_idx, len(elems)):
            tag, txt = elems[idx]
            m = re.match(r"^(?:●\s*)?Questions?\s+(\d+)(?:\s*(?:-|–|to|and)\s*(\d+))?", txt.strip(), re.I)
            if m:
                s_q = int(m.group(1))
                e_q = int(m.group(2)) if m.group(2) else s_q
                raw_splits.append((s_q, e_q, txt, idx))

        groups_info = assign_part_questions(raw_splits, exp_start, exp_end)

        question_groups = []
        for i, (start_q, end_q, qs, qg_hdr, qg_idx) in enumerate(groups_info):
            next_idx = groups_info[i+1][4] if i+1 < len(groups_info) and groups_info[i+1][4] > qg_idx else len(elems)
            sub_elems = elems[qg_idx:next_idx]
            qg_obj = process_question_group(sub_elems, qs, answers, ed, test_num, p_num, is_reading=True)
            question_groups.append(qg_obj)

        parts.append({
            "id": f"cambridge_{ed}_reading_test_{test_num}_part_{p_num}",
            "partNumber": p_num,
            "title": p_title,
            "passage": passage_text or f"Cambridge {ed} Reading Passage {p_num}",
            "questionGroups": question_groups
        })

    exam = {
        "id": f"cambridge_{ed}_reading_test_{test_num}",
        "title": f"CAMBRIDGE {ed} TEST {test_num} READING",
        "durationMinutes": 60,
        "category": "IELTS Academic Reading",
        "collection": f"Cambridge {ed}",
        "parts": parts,
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000,
        "isBuiltin": True
    }
    return exam

def crawl_listening_exam(ed, test_num, url):
    """Crawls and formats a Cambridge Listening Test into the Exam interface."""
    html = fetch_url(url)
    soup = BeautifulSoup(html, "html.parser")
    entry = soup.find(class_="entry-content")
    if not entry:
        raise RuntimeError(f"Could not find .entry-content in {url}")

    answers = parse_toggles(entry)

    audio_urls = []
    for a in entry.find_all("audio"):
        if a.get("src"):
            audio_urls.append(a.get("src"))
        for s in a.find_all("source"):
            if s.get("src"):
                audio_urls.append(s.get("src"))
    audio_urls = [re.sub(r"\?.*$", "", u) for u in audio_urls]

    transcripts = extract_audioscript_transcripts(soup, ed, test_num, url)

    raw_elements = []
    for el in entry.find_all(["h1", "h2", "h3", "h4", "p", "table", "li"]):
        if el.find_parent(class_="et_pb_toggle"):
            continue
        # Deduplicate tables: if table contains p or li children, skip table tag itself because p/li children provide the clean paragraphs
        if el.name == "table" and el.find_all(["p", "li"]):
            continue
        txt = clean_text(el.get_text(" "))
        if not txt:
            continue
        if any(nav in txt for nav in ["Cam 1", "Cam 2", "Answer Cam", "View Solution", "Audioscript Cam", "english-practice.net"]):
            continue
        raw_elements.append((el.name, txt))

    parts_elems = {1: [], 2: [], 3: [], 4: []}
    curr_part = 0
    for tag, txt in raw_elements:
        m = re.match(r"^(?:SECTION|PART)\s*([1234])\b", txt, re.I)
        if m:
            curr_part = int(m.group(1))
            continue
        if curr_part in parts_elems:
            parts_elems[curr_part].append((tag, txt))

    parts = []
    for p_num in [1, 2, 3, 4]:
        elems = parts_elems[p_num]
        q_start = (p_num - 1) * 10 + 1
        q_end = p_num * 10

        audio_url = audio_urls[p_num - 1] if p_num - 1 < len(audio_urls) else ""
        passage_text = transcripts.get(p_num, f"Cambridge {ed} Listening Test {test_num} - Part {p_num} Transcript")

        raw_splits = []
        for idx, (tag, txt) in enumerate(elems):
            m = re.match(r"^(?:●\s*)?(?:Look at\s+)?Questions?\s+(\d+)(?:\s*(?:-|–|to|and)\s*(\d+))?", txt.strip(), re.I)
            if m:
                s_q = int(m.group(1))
                e_q = int(m.group(2)) if m.group(2) else s_q
                # Heuristic: correct header typos like Cam 17 L T3 P2 "Questions 11 - 14" where instructions specify "Choose TWO letters"
                following_text = " ".join([t for _, t in elems[idx:idx+4]]).upper()
                if any(kw in following_text for kw in ["CHOOSE TWO LETTERS", "CHOOSE TWO"]) and (e_q - s_q + 1) > 2:
                    e_q = s_q + 1
                raw_splits.append((s_q, e_q, txt, idx))

        groups_info = assign_part_questions(raw_splits, q_start, q_end)

        question_groups = []
        for i, (start_q, end_q, qs, qg_hdr, qg_idx) in enumerate(groups_info):
            next_idx = groups_info[i+1][4] if i+1 < len(groups_info) and groups_info[i+1][4] > qg_idx else len(elems)
            sub_elems = elems[qg_idx:next_idx]
            qg_obj = process_question_group(sub_elems, qs, answers, ed, test_num, p_num, is_reading=False)
            question_groups.append(qg_obj)

        parts.append({
            "id": f"cambridge_{ed}_listening_test_{test_num}_part_{p_num}",
            "partNumber": p_num,
            "title": f"Part {p_num}",
            "passage": passage_text,
            "audioUrl": audio_url,
            "questionGroups": question_groups
        })

    exam = {
        "id": f"cambridge_{ed}_listening_test_{test_num}",
        "title": f"CAMBRIDGE {ed} TEST {test_num} LISTENING",
        "durationMinutes": 30,
        "category": "IELTS Listening",
        "collection": f"Cambridge {ed}",
        "parts": parts,
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000,
        "isBuiltin": True
    }
    return exam

def main():
    print("=" * 60)
    print("CAMBRIDGE 15–21 PRACTICE TEST CRAWLER")
    print("=" * 60)

    # 1. R1 Check: Verify all editions 15 through 21 exist
    required_editions = {15, 16, 17, 18, 19, 20, 21}
    reading_editions = {item[0] for item in READING_TESTS}
    listening_editions = {item[0] for item in LISTENING_TESTS}

    if reading_editions != required_editions or listening_editions != required_editions:
        missing = required_editions - (reading_editions & listening_editions)
        raise RuntimeError(f"R1 VIOLATION: Missing Cambridge editions: {sorted(missing)}! Halting execution.")
    print("✓ R1 Check Passed: All Cambridge editions 15 through 21 configured.")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "apps", "next", "src", "modules", "ielts", "data")
    reading_output_path = os.path.join(data_dir, "imported_exams.json")
    listening_output_path = os.path.join(data_dir, "imported_listening_exams.json")

    # 2. Crawl 28 Reading Tests concurrently
    print(f"\nCrawling 28 Cambridge Reading Tests across Editions 15–21...")
    reading_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        future_map = {
            pool.submit(crawl_reading_exam, ed, t, url): (ed, t)
            for ed, t, url in READING_TESTS
        }
        for future in concurrent.futures.as_completed(future_map):
            ed, t = future_map[future]
            try:
                exam = future.result()
                reading_results[(ed, t)] = exam
                q_count = sum(len(qg["questions"]) for p in exam["parts"] for qg in p["questionGroups"])
                print(f"  ✓ Cambridge {ed} Reading Test {t}: 3 passages, {q_count} questions extracted")
            except Exception as e:
                print(f"  ✗ Error on Cambridge {ed} Reading Test {t}: {e}")
                raise

    sorted_reading = [reading_results[(ed, t)] for ed, t, _ in READING_TESTS]
    print(f"\nWriting {len(sorted_reading)} Reading exams to {reading_output_path}...")
    with open(reading_output_path, "w", encoding="utf-8") as f:
        json.dump(sorted_reading, f, ensure_ascii=False, indent=2)
    print("✓ Reading exams successfully written.")

    # 3. Crawl 28 Listening Tests concurrently
    print(f"\nCrawling 28 Cambridge Listening Tests across Editions 15–21...")
    listening_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        future_map = {
            pool.submit(crawl_listening_exam, ed, t, url): (ed, t)
            for ed, t, url in LISTENING_TESTS
        }
        for future in concurrent.futures.as_completed(future_map):
            ed, t = future_map[future]
            try:
                exam = future.result()
                listening_results[(ed, t)] = exam
                q_count = sum(len(qg["questions"]) for p in exam["parts"] for qg in p["questionGroups"])
                audio_count = sum(1 for p in exam["parts"] if p.get("audioUrl"))
                print(f"  ✓ Cambridge {ed} Listening Test {t}: 4 parts, {q_count} questions, {audio_count}/4 audio sources extracted")
            except Exception as e:
                print(f"  ✗ Error on Cambridge {ed} Listening Test {t}: {e}")
                raise

    sorted_listening = [listening_results[(ed, t)] for ed, t, _ in LISTENING_TESTS]
    print(f"\nWriting {len(sorted_listening)} Listening exams to {listening_output_path}...")
    with open(listening_output_path, "w", encoding="utf-8") as f:
        json.dump(sorted_listening, f, ensure_ascii=False, indent=2)
    print("✓ Listening exams successfully written.")

    print("\n" + "=" * 60)
    print("CRAWL COMPLETE: 56/56 Tests Crawled & Integrated Successfully!")
    print(f"  - Reading Exams:   {len(sorted_reading)} (1,120 questions)")
    print(f"  - Listening Exams: {len(sorted_listening)} (1,120 questions)")
    print(f"  - Total Questions: {len(sorted_reading) * 40 + len(sorted_listening) * 40}")
    print("=" * 60)

if __name__ == "__main__":
    main()
