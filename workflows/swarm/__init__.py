"""
workflows.swarm — sub-package containing extracted helpers for SwarmOrchestrator.

Sub-modules:
  track_manager  — track extraction, dependency ordering, conflict resolution
  healing        — failing-test parsing and failure-recovery helpers
  state          — workflow manifest builder
  reporting      — final report assembly and PR comment formatting
"""
from workflows.swarm.track_manager import (
    _extract_tracks,
    _order_tracks_by_deps,
    _normalise_path,
    _resolve_track_conflicts,
    _track_plan,
    _merge_build_results,
)
from workflows.swarm.healing import _parse_failing_tests
from workflows.swarm.state import build_manifest
from workflows.swarm.reporting import _build_final_report, format_quality_comment

__all__ = [
    "_extract_tracks",
    "_order_tracks_by_deps",
    "_normalise_path",
    "_resolve_track_conflicts",
    "_track_plan",
    "_merge_build_results",
    "_parse_failing_tests",
    "build_manifest",
    "_build_final_report",
    "format_quality_comment",
]
