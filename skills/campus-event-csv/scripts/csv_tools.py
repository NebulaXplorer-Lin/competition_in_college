#!/usr/bin/env python3
"""Validate campus CSVs, or export explicitly confirmed additions/patches.

Python standard library only. No model calls, network requests, or browser writes.
"""

import argparse
import csv
import io
import json
import re
import sys
import uuid
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit


HEADERS = (
    "id", "title", "organizer", "category", "tags", "description", "source_url",
    "registration_start", "registration_deadline", "event_start", "event_end",
    "location", "eligibility", "status", "participation_decision", "priority",
    "notes", "last_verified",
)
DATE_FIELDS = (
    "registration_start", "registration_deadline", "event_start", "event_end", "last_verified",
)
DEFAULTS = {"category": "未分类", "participation_decision": "maybe", "priority": "中"}


class ValidationError(ValueError):
    pass


def validate_records(records):
    errors = []
    seen_ids, seen_urls = set(), set()
    if not records:
        errors.append("清单没有活动记录")
    for index, record in enumerate(records, 2):
        prefix = f"第 {index} 行"
        if set(record) != set(HEADERS):
            errors.append(f"{prefix}字段必须与 18 个表头一致")
            continue
        if any(not isinstance(value, str) for value in record.values()):
            errors.append(f"{prefix}单元格必须是文本")
            continue
        event_id = record["id"].strip()
        if not event_id or not record["title"].strip():
            errors.append(f"{prefix}id 和 title 不可空")
        if event_id in seen_ids:
            errors.append(f"{prefix}重复 id: {event_id}")
        seen_ids.add(event_id)
        source = record["source_url"]
        if source:
            try:
                parsed = urlsplit(source)
                valid_url = parsed.scheme in ("http", "https") and bool(parsed.hostname)
            except ValueError:
                valid_url = False
            if not valid_url or any(char.isspace() for char in source):
                errors.append(f"{prefix}source_url 必须是完整 HTTP(S) URL")
            if source in seen_urls:
                errors.append(f"{prefix}重复 source_url: {source}")
            seen_urls.add(source)
        if record["participation_decision"] not in ("yes", "maybe", "no"):
            errors.append(f"{prefix}participation_decision 必须是 yes/maybe/no")
        if record["status"] not in ("open", "closed", "ended"):
            errors.append(f"{prefix}status 必须显式填写 open/closed/ended")
        invalid_dates = set()
        for key in DATE_FIELDS:
            value = record[key]
            if not value:
                continue
            try:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    raise ValueError()
                date.fromisoformat(value)
            except ValueError:
                invalid_dates.add(key)
                errors.append(f"{prefix}{key} 必须是有效 YYYY-MM-DD 日期")
        for start, end in (("registration_start", "registration_deadline"), ("event_start", "event_end")):
            if not ({start, end} & invalid_dates) and record[start] and record[end] and record[start] > record[end]:
                errors.append(f"{prefix}{end} 不能早于 {start}")
        tags = [tag.strip() for tag in record["tags"].split(";") if tag.strip()]
        if len(tags) != len(set(tags)):
            errors.append(f"{prefix}tags 含重复标签")
    if errors:
        raise ValidationError("\n".join(errors))


def read_csv_stream(stream):
    reader = csv.reader(stream, strict=True)
    try:
        headers = next(reader, [])
        if len(headers) != len(HEADERS) or set(headers) != set(HEADERS):
            raise ValidationError("CSV 必须包含全部 18 个表头，不能重复或添加额外列")
        records = []
        for index, row in enumerate(reader, 2):
            if not any(value.strip() for value in row):
                continue
            if len(row) != len(headers):
                raise ValidationError(f"第 {index} 行列数错误：{len(row)}，预期 {len(headers)}")
            records.append(dict(zip(headers, row)))
    except csv.Error as exc:
        raise ValidationError(f"CSV 引号或格式错误：{exc}") from exc
    validate_records(records)
    return records


def read_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        return read_csv_stream(stream)


def normalize_fields(fields):
    if not isinstance(fields, dict):
        raise ValidationError("记录/fields 必须是 JSON 对象")
    unknown = set(fields) - set(HEADERS)
    if unknown:
        raise ValidationError(f"未知字段：{', '.join(sorted(unknown))}")
    result = {}
    for key, value in fields.items():
        if key == "tags" and isinstance(value, list):
            if any(not isinstance(tag, str) or ";" in tag for tag in value):
                raise ValidationError("tags 数组只接受不含分号的字符串")
            value = ";".join(tag.strip() for tag in value if tag.strip())
        if value is None:
            value = ""
        if not isinstance(value, str):
            raise ValidationError(f"{key} 必须是字符串或 null；tags 也可用字符串数组")
        result[key] = value
    return result


def merge_manifest(manifest, baseline):
    if not isinstance(manifest, dict) or manifest.get("confirmed") is not True:
        raise ValidationError("需要 confirmed=true；仅在用户确认具体预览后设置")
    if set(manifest) - {"confirmed", "records", "updates"}:
        raise ValidationError("输入只接受 confirmed、records、updates；不接受删除指令")
    additions, updates = manifest.get("records", []), manifest.get("updates", [])
    if not isinstance(additions, list) or not isinstance(updates, list):
        raise ValidationError("records 和 updates 必须是数组")
    if not additions and not updates:
        raise ValidationError("没有已确认的新增或更新")
    if baseline is None and updates:
        raise ValidationError("更新旧活动必须提供 --baseline")
    records = [dict(record) for record in (baseline or [])]
    positions = {record["id"].strip(): index for index, record in enumerate(records)}
    patched = set()
    for update in updates:
        if not isinstance(update, dict) or set(update) != {"id", "fields"} or not isinstance(update["id"], str):
            raise ValidationError("每个 update 必须且只能包含字符串 id 和 fields")
        event_id = update["id"].strip()
        if event_id not in positions or event_id in patched:
            raise ValidationError(f"更新 ID 不存在或重复更新：{event_id}")
        fields = normalize_fields(update["fields"])
        if not fields or "id" in fields:
            raise ValidationError("更新字段不可空且不能更改 id")
        records[positions[event_id]].update(fields)
        patched.add(event_id)
    for addition in additions:
        fields = normalize_fields(addition)
        if not fields.get("title", "").strip() or not fields.get("status"):
            raise ValidationError("新增必须填写 title 和已确认的 status")
        record = {key: "" for key in HEADERS}
        record.update(DEFAULTS)
        record.update(fields)
        record["title"] = record["title"].strip()
        record["id"] = record["id"].strip() or str(uuid.uuid5(
            uuid.NAMESPACE_URL, "campus-event:" + json.dumps(
                [record["title"], record["source_url"]], ensure_ascii=False, separators=(",", ":")
            )
        ))
        if record["id"] in positions:
            raise ValidationError(f"新增 ID 已存在；更新请用 updates：{record['id']}")
        positions[record["id"]] = len(records)
        records.append(record)
    validate_records(records)
    return records, {"added": len(additions), "updated": len(patched), "preserved": len(baseline or []) - len(patched)}


def write_new_csv(path, records):
    validate_records(records)
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=HEADERS, lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(records)
    text = buffer.getvalue()
    if read_csv_stream(io.StringIO(text, newline="")) != records:
        raise ValidationError("CSV 回读结果与已确认内容不一致")
    destination = Path(path)
    # Exclusive creation: never replace an existing CSV, baseline, or backup.
    with destination.open("x", encoding="utf-8-sig", newline="") as stream:
        stream.write(text)
    return destination


def main(argv=None):
    # Windows pipes may default to a legacy encoding that cannot print Chinese.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="独立校验现有 CSV，不修改文件")
    validate.add_argument("csv")
    generate = commands.add_parser("generate", help="从已确认 JSON 生成新 CSV，不覆盖或删除旧记录")
    generate.add_argument("--input", required=True)
    generate.add_argument("--output", required=True)
    generate.add_argument("--baseline")
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            records = read_csv(args.csv)
            print(json.dumps({"valid": True, "records": len(records)}, ensure_ascii=False))
        else:
            with Path(args.input).open(encoding="utf-8-sig") as stream:
                manifest = json.load(stream)
            baseline = read_csv(args.baseline) if args.baseline else None
            records, counts = merge_manifest(manifest, baseline)
            destination = write_new_csv(args.output, records)
            # Validate the saved bytes as well as the in-memory round trip.
            if read_csv(destination) != records:
                raise ValidationError("保存后的 CSV 与已确认内容不一致")
            print(json.dumps({"output": str(destination.resolve()), "records": len(records),
                              "list_type": "merged" if args.baseline else "additions_only", **counts}, ensure_ascii=False))
        return 0
    except (ValidationError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
