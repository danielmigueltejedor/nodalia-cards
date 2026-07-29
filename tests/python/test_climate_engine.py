"""Unit tests for the dependency-free climate schedule engine."""

from __future__ import annotations

import importlib.util
from datetime import datetime
from pathlib import Path
import unittest


def _load_module(name: str):
    path = Path(__file__).parents[2] / "custom_components" / "nodalia" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


engine = _load_module("climate_engine")


class ClimateEngineTests(unittest.TestCase):
    def test_active_slot_and_next_boundary(self) -> None:
        schedule = engine.normalize_schedule(
            "climate.salon",
            {
                "enabled": True,
                "slots": [
                    {"id": "morning", "day": "mon", "start": "07:00", "end": "09:00", "temperature": 21},
                    {"id": "evening", "day": "mon", "start": "18:30", "end": "22:00", "temperature": 20},
                ],
            },
        )
        now = datetime.fromisoformat("2026-07-27T08:00:00+02:00")
        self.assertEqual(engine.active_slot(schedule, now)["id"], "morning")
        self.assertEqual(engine.next_slot_start(schedule, now).isoformat(), "2026-07-27T18:30:00+02:00")

    def test_overnight_slot_uses_previous_day(self) -> None:
        schedule = engine.normalize_schedule(
            "climate.salon",
            {"slots": [{"id": "night", "day": "mon", "start": "22:00", "end": "06:00", "temperature": 18}]},
        )
        now = datetime.fromisoformat("2026-07-28T01:00:00+02:00")
        self.assertEqual(engine.active_slot(schedule, now)["id"], "night")

    def test_invalid_rows_are_rejected(self) -> None:
        schedule = engine.normalize_schedule(
            "climate.salon",
            {"slots": [{"start": "99:00", "end": "10:00", "temperature": 21}]},
        )
        self.assertEqual(schedule["slots"], [])


if __name__ == "__main__":
    unittest.main()
