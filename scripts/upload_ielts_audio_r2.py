#!/usr/bin/env python3
"""
Upload all 112 Cambridge 15-21 Listening audio files to Cloudflare R2 (MEDIA_S3_BUCKET),
rewrite audioUrl fields in apps/next/src/modules/ielts/data/imported_listening_exams.json,
and verify HTTP 200 + audio/* Content-Type for every uploaded URL.
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
import requests


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
            v = v[1:-1]
        if k and v and k not in os.environ:
            os.environ[k] = v


def get_content_type(ext: str) -> str:
    ext = ext.lower()
    if ext == ".m4a":
        return "audio/mp4"
    if ext == ".mp3":
        return "audio/mpeg"
    if ext == ".ogg":
        return "audio/ogg"
    if ext == ".wav":
        return "audio/wav"
    return "audio/mp4"


def parse_edition_and_test(exam: dict) -> tuple[str, str]:
    text = f"{exam.get('id', '')} {exam.get('collection', '')} {exam.get('title', '')}"
    ed_match = re.search(r"(\d{2})", text)
    test_match = re.search(r"test[_\s-]*(\d+)", text, re.IGNORECASE)
    ed = ed_match.group(1) if ed_match else "unknown"
    test_num = test_match.group(1) if test_match else "unknown"
    return ed, test_num


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    load_env_file(root / ".env.r2")
    load_env_file(root / ".env")

    required_vars = [
        "MEDIA_S3_ENDPOINT",
        "MEDIA_S3_BUCKET",
        "MEDIA_S3_PUBLIC_URL",
        "MEDIA_S3_ACCESS_KEY_ID",
        "MEDIA_S3_SECRET_ACCESS_KEY",
    ]
    missing = [k for k in required_vars if not os.environ.get(k) or os.environ.get(k) == "[SENSITIVE]"]
    if missing:
        raise RuntimeError(f"Missing R2 credentials/config in .env.r2 or env: {', '.join(missing)}")

    endpoint = os.environ["MEDIA_S3_ENDPOINT"].strip()
    region = os.environ.get("MEDIA_S3_REGION", "auto").strip() or "auto"
    bucket = os.environ["MEDIA_S3_BUCKET"].strip()
    public_url = os.environ["MEDIA_S3_PUBLIC_URL"].strip().rstrip("/")
    access_key = os.environ["MEDIA_S3_ACCESS_KEY_ID"].strip()
    secret_key = os.environ["MEDIA_S3_SECRET_ACCESS_KEY"].strip()

    json_path = root / "apps" / "next" / "src" / "modules" / "ielts" / "data" / "imported_listening_exams.json"
    exams = json.loads(json_path.read_text(encoding="utf-8"))

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
    )

    tasks = []
    for ex_idx, exam in enumerate(exams):
        ed, test_num = parse_edition_and_test(exam)
        for p_idx, part in enumerate(exam.get("parts", [])):
            url = (part.get("audioUrl") or "").strip()
            if not url:
                continue
            parsed = urlparse(url)
            ext = os.path.splitext(parsed.path)[1].lower() or ".m4a"
            part_num = part.get("partNumber") or (p_idx + 1)
            key = f"ielts/audio/cambridge-{ed}/test-{test_num}-part-{part_num}{ext}"
            target_url = f"{public_url}/{key}"
            tasks.append((ex_idx, p_idx, url, key, ext, target_url))

    print(f"Prepared {len(tasks)} audio assets for upload to R2 bucket '{bucket}'...")

    def upload_one(item: tuple[int, int, str, str, str, str]) -> tuple[int, int, str, str]:
        ex_idx, p_idx, src_url, key, ext, target_url = item
        content_type = get_content_type(ext)

        # Idempotent skip if already uploaded in R2 with valid size
        try:
            head = s3.head_object(Bucket=bucket, Key=key)
            if head.get("ContentLength", 0) > 10000 and head.get("ContentType", "").startswith("audio/"):
                return ex_idx, p_idx, target_url, "skipped"
        except ClientError:
            pass

        if src_url.startswith(public_url):
            raise RuntimeError(f"Source URL already points to R2 but head_object failed for {key}")

        last_err: Exception | None = None
        data: bytes | None = None
        for attempt in range(1, 4):
            try:
                resp = requests.get(
                    src_url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                    timeout=90,
                )
                resp.raise_for_status()
                if len(resp.content) <= 10000:
                    raise ValueError(f"Downloaded payload too small ({len(resp.content)} bytes)")
                data = resp.content
                break
            except Exception as err:
                last_err = err
                time.sleep(attempt * 1.5)

        if data is None:
            raise RuntimeError(f"Failed downloading {src_url}: {last_err}")

        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        return ex_idx, p_idx, target_url, f"uploaded ({len(data) // 1024} KB)"

    uploaded_count = 0
    skipped_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(upload_one, t) for t in tasks]
        for idx, fut in enumerate(concurrent.futures.as_completed(futures), start=1):
            ex_idx, p_idx, target_url, status = fut.result()
            exams[ex_idx]["parts"][p_idx]["audioUrl"] = target_url
            if status == "skipped":
                skipped_count += 1
            else:
                uploaded_count += 1
            if idx % 10 == 0 or idx == len(tasks):
                print(f"  [{idx}/{len(tasks)}] {status} -> {target_url}")

    json_path.write_text(json.dumps(exams, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nUpdated {json_path} (uploaded={uploaded_count}, skipped={skipped_count}).")

    # Verify HTTP 200 + audio/* Content-Type for all 112 R2 URLs
    print("Verifying HTTP 200 and Content-Type across all R2 URLs...")
    r2_urls = [p["audioUrl"] for ex in exams for p in ex.get("parts", [])]

    def verify_one(url: str) -> None:
        if not url.startswith(public_url):
            raise RuntimeError(f"URL does not start with {public_url}: {url}")
        r = requests.head(url, timeout=20, allow_redirects=True)
        if r.status_code != 200:
            raise RuntimeError(f"HEAD {url} returned HTTP {r.status_code}")
        ct = r.headers.get("Content-Type", "")
        if not ct.startswith("audio/"):
            raise RuntimeError(f"HEAD {url} returned invalid Content-Type: {ct}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(verify_one, r2_urls))

    print(f"✓ Verified all {len(r2_urls)} R2 audio URLs return HTTP 200 with audio/* Content-Type.")


if __name__ == "__main__":
    main()
