"""Offline boundaries: round trip, merge preservation, and invalid input rejection."""

import importlib.util
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills/campus-event-csv/scripts/csv_tools.py"
spec = importlib.util.spec_from_file_location("csv_tools", SCRIPT)
tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tools)


def event(**fields):
    record = {key: "" for key in tools.HEADERS}
    record.update(id="old-id", title="测试比赛", status="open", participation_decision="yes",
                  priority="自定义优先级", category="测试", notes='个人备注,含"引号"\n第二行', tags="团队;编程")
    record.update(fields)
    return record


class CampusCsvTests(unittest.TestCase):
    def test_merge_only_changes_requested_fields(self):
        baseline = [event(), event(id="untouched", title="另一项", participation_decision="no")]
        snapshot = [dict(record) for record in baseline]
        merged, counts = tools.merge_manifest({"confirmed": True,
            "updates": [{"id": "old-id", "fields": {"registration_deadline": "2026-10-22"}}],
            "records": [{"title": "新比赛2026校内选拔", "status": "open", "tags": ["算法", "团队"]}]}, baseline)
        self.assertEqual(baseline, snapshot)
        self.assertEqual(merged[1], baseline[1])
        self.assertEqual({k: v for k, v in merged[0].items() if k != "registration_deadline"},
                         {k: v for k, v in baseline[0].items() if k != "registration_deadline"})
        self.assertEqual(merged[2]["participation_decision"], "maybe")
        self.assertEqual(counts, {"added": 1, "updated": 1, "preserved": 1})

    def test_bom_quoting_round_trip_and_no_overwrite(self):
        records = [event(description='含逗号,双引号"和\n换行')]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.csv"
            tools.write_new_csv(path, records)
            original = path.read_bytes()
            self.assertTrue(original.startswith(b"\xef\xbb\xbf"))
            self.assertIn(b"\r\n", original)
            self.assertEqual(tools.read_csv(path), records)
            with self.assertRaises(FileExistsError):
                tools.write_new_csv(path, records)
            self.assertEqual(path.read_bytes(), original)

    def test_actual_calendar_and_independent_stage_ordering(self):
        tools.validate_records([event(registration_start="2024-02-29", registration_deadline="2024-03-01",
                                      event_start="2024-02-29", event_end="2024-02-29")])
        for fields in ({"event_start": "2026-02-29"}, {"last_verified": "2026-13-01"},
                       {"registration_start": "2026-10-23", "registration_deadline": "2026-10-22"},
                       {"event_start": "2026-10-23", "event_end": "2026-10-22"}):
            with self.subTest(fields=fields), self.assertRaises(tools.ValidationError):
                tools.validate_records([event(**fields)])

    def test_duplicates_and_enums_rejected(self):
        for records in ([event(), event()],
                        [event(source_url="https://example.org/event"), event(id="second", source_url="https://example.org/event")],
                        [event(tags="团队; 团队")], [event(status="unknown")], [event(status="")],
                        [event(participation_decision="")], [event(source_url="javascript:alert(1)")]):
            with self.subTest(records=records), self.assertRaises(tools.ValidationError):
                tools.validate_records(records)

    def test_confirmation_patching_and_no_delete(self):
        bad = [({"confirmed": False, "records": [{"title": "测试", "status": "open"}]}, None),
               ({"confirmed": "true", "records": [{"title": "测试", "status": "open"}]}, None),
               ({"confirmed": True, "updates": [{"id": "old-id", "fields": {"notes": "x"}}]}, None),
               ({"confirmed": True, "updates": [{"id": "old-id", "fields": {"id": "new"}}]}, [event()]),
               ({"confirmed": True, "records": [{"id": "old-id", "title": "测试", "status": "open"}]}, [event()]),
               ({"confirmed": True, "records": [{"title": "测试"}]}, None),
               ({"confirmed": True, "records": [{"title": "测试", "status": "open"}], "delete": ["old-id"]}, [event()])]
        for manifest, baseline in bad:
            with self.subTest(manifest=manifest), self.assertRaises(tools.ValidationError):
                tools.merge_manifest(manifest, baseline)

    def test_stable_new_id(self):
        manifest = {"confirmed": True, "records": [{"title": "比赛2026校内", "status": "open"}]}
        self.assertEqual(tools.merge_manifest(manifest, None)[0], tools.merge_manifest(manifest, None)[0])

    def test_broken_csv_rejected(self):
        header = ",".join(tools.HEADERS) + "\r\n"
        for text in ("id,title\r\nx,y\r\n", header + "a,b\r\n", header + '"unterminated'):
            with self.subTest(text=text), self.assertRaises(tools.ValidationError):
                tools.read_csv_stream(io.StringIO(text, newline=""))

    def test_cli_confirmation_generate_validate_and_preserve_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            baseline, manifest, output = folder / "baseline.csv", folder / "confirmed.json", folder / "new.csv"
            tools.write_new_csv(baseline, [event()])
            original = baseline.read_bytes()
            request = {"confirmed": False, "records": [{"title": "新增测试", "status": "open"}]}
            manifest.write_text(json.dumps(request), encoding="utf-8")
            args = ["generate", "--input", str(manifest), "--baseline", str(baseline), "--output", str(output)]
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(tools.main(args), 1)
            self.assertFalse(output.exists())
            request["confirmed"] = True
            manifest.write_text(json.dumps(request), encoding="utf-8")
            report = io.StringIO()
            with contextlib.redirect_stdout(report):
                self.assertEqual(tools.main(args), 0)
                self.assertEqual(tools.main(["validate", str(output)]), 0)
            self.assertEqual(baseline.read_bytes(), original)
            self.assertEqual(tools.read_csv(output)[0], event())
            self.assertIn('"list_type": "merged"', report.getvalue())


if __name__ == "__main__":
    unittest.main()
