"""Unit tests for the dependency-free background notification engine."""

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


engine = _load_module("notification_engine")


class NotificationEngineTests(unittest.TestCase):
    def _profile(self, extra=None):
        source = {
            "enabled": True,
            "notify": {"enabled": True, "entities": ["notify.phone"], "min_severity": "warning"},
            "entities": {"temperature": ["sensor.room_temperature"]},
            "thresholds": {"hot_temperature": 27},
        }
        if extra:
            source.update(extra)
        return engine.normalize_profile(source)

    def test_threshold_only_fires_when_crossed(self) -> None:
        profile = self._profile()
        alerts = engine.evaluate_transition(profile, "sensor.room_temperature", "26.9", "27.1", {"friendly_name": "Room", "unit_of_measurement": "°C"})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["kind"], "hot")
        self.assertEqual(engine.evaluate_transition(profile, "sensor.room_temperature", "27.1", "28", {}), [])

    def test_explicit_push_bypasses_minimum_severity(self) -> None:
        profile = self._profile({
            "custom": [{
                "id": "presence",
                "entity": "binary_sensor.presence",
                "condition": "on",
                "title": "Presence",
                "message": "Detected",
                "severity": "info",
                "mobile": "push",
            }],
        })
        alerts = engine.evaluate_transition(profile, "binary_sensor.presence", "off", "on", {})
        self.assertEqual(len(alerts), 1)
        profile["notify"]["enabled"] = False
        self.assertTrue(engine.delivery_allowed(profile, alerts[0]))

    def test_quiet_hours_allow_critical_and_equal_times_are_disabled(self) -> None:
        profile = self._profile({"context": {"quiet_hours": {"enabled": True, "start": "22:00", "end": "07:00", "allow_critical": True}}})
        self.assertTrue(engine.is_within_quiet_hours(profile, datetime.fromisoformat("2026-07-29T23:00:00+02:00")))
        equal = self._profile({"context": {"quiet_hours": {"enabled": True, "start": "08:00", "end": "08:00"}}})
        self.assertFalse(engine.is_within_quiet_hours(equal, datetime.fromisoformat("2026-07-29T08:00:00+02:00")))

    def test_missing_override_policy_keeps_inherit(self) -> None:
        profile = self._profile({"overrides": {"sensor.room_temperature": {"title": "Warm"}}})
        self.assertEqual(profile["overrides"]["sensor.room_temperature"]["mobile"], "inherit")


if __name__ == "__main__":
    unittest.main()
