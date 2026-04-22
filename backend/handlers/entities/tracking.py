# Copyright (c) 2025 Efstratios Goudelis
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

"""Tracking state handlers and emission functions."""

from typing import Any, Dict, Optional, Union

import crud
from common.constants import RigStates, SocketEvents, TrackerCommandScopes, TrackerCommandStatus
from db import AsyncSessionLocal
from session.tracker import session_tracker
from tracker.contracts import InvalidTrackerIdError, get_tracking_state_name, require_tracker_id
from tracker.data import compiled_satellite_data, get_ui_tracker_state
from tracker.instances import emit_tracker_instances
from tracker.runner import (
    assign_rotator_to_tracker,
    get_assigned_rotator_for_tracker,
    get_tracker_instances_payload,
    get_tracker_manager,
    restore_tracker_rotator_assignment,
)
from tracking.events import fetch_next_events_for_satellite


def _tracker_id_required_response() -> Dict[str, Any]:
    return {
        "success": False,
        "error": "tracker_id_required",
        "message": "tracker_id is required",
    }


async def emit_tracker_data(dbsession, sio, logger, tracker_id: str):
    """
    Emits satellite tracking data to the provided Socket.IO instance. This function retrieves the
    current state of satellite tracking from the database, processes the relevant satellite data,
    fetches the UI tracker state, and emits the resulting combined data to a specific event on
    the Socket.IO instance. Errors during data retrieval, processing, or emitting are logged.

    :param dbsession: Database session object used to access and query the database.
    :type dbsession: Any
    :param sio: Socket.IO server instance for emitting events.
    :type sio: AsyncServer
    :param logger: Logger object for logging errors or exceptions.
    :type logger: Any
    :return: This function does not return any value as it emits data asynchronously.
    :rtype: None
    """
    tracker_id = require_tracker_id(tracker_id)
    state_name = get_tracking_state_name(tracker_id)
    try:
        logger.debug("Sending tracker data to clients...")

        tracking_state_reply = await crud.trackingstate.get_tracking_state(
            dbsession, name=state_name
        )

        # Check if tracking state exists (not None for first-time users)
        if not tracking_state_reply.get("success") or tracking_state_reply.get("data") is None:
            logger.debug("No tracking state found, skipping tracker data emission")
            return

        tracking_value = tracking_state_reply["data"].get("value")
        if tracking_value is None:
            logger.debug("Tracking state has no value, skipping tracker data emission")
            return

        norad_id = tracking_value.get("norad_id", None)
        satellite_data = await compiled_satellite_data(dbsession, norad_id)
        data = {
            "tracker_id": tracker_id,
            "satellite_data": satellite_data,
            "tracking_state": tracking_value,
        }
        await sio.emit("satellite-tracking", data)
        await sio.emit(SocketEvents.SATELLITE_TRACKING_V2, data)

    except Exception as e:
        logger.error(f"Error emitting tracker data: {e}")
        logger.exception(e)


async def emit_ui_tracker_values(dbsession, sio, logger, tracker_id: str):
    """
    Call this when UI tracker values are updated

    :param dbsession:
    :param sio:
    :param logger:
    :return:
    """

    tracker_id = require_tracker_id(tracker_id)
    state_name = get_tracking_state_name(tracker_id)
    try:
        logger.debug("Sending UI tracker value to clients...")

        tracking_state_reply = await crud.trackingstate.get_tracking_state(
            dbsession, name=state_name
        )

        # Check if tracking state exists (not None for first-time users)
        if not tracking_state_reply.get("success") or tracking_state_reply.get("data") is None:
            logger.debug("No tracking state found, skipping UI tracker values emission")
            return

        tracking_value = tracking_state_reply["data"].get("value")
        if tracking_value is None:
            logger.debug("Tracking state has no value, skipping UI tracker values emission")
            return

        group_id = tracking_value.get("group_id", None)
        norad_id = tracking_value.get("norad_id", None)
        ui_tracker_state = await get_ui_tracker_state(group_id, norad_id, tracker_id)
        data = ui_tracker_state["data"]
        if isinstance(data, dict):
            data["tracker_id"] = tracker_id
        await sio.emit("ui-tracker-state", data)
        await sio.emit(SocketEvents.UI_TRACKER_STATE_V2, data)

    except Exception as e:
        logger.error(f"Error emitting UI tracker values: {e}")
        logger.exception(e)


async def get_tracking_state(
    sio: Any, data: Optional[Dict], logger: Any, sid: str
) -> Dict[str, Any]:
    """
    Get current tracking state and emit tracker data.

    Args:
        sio: Socket.IO server instance
        data: Not used
        logger: Logger instance
        sid: Socket.IO session ID

    Returns:
        Dictionary with success status and tracking state
    """
    try:
        requested_tracker_id = require_tracker_id((data or {}).get("tracker_id"))
    except InvalidTrackerIdError:
        return _tracker_id_required_response()
    state_name = get_tracking_state_name(requested_tracker_id)
    async with AsyncSessionLocal() as dbsession:
        logger.debug(f"Fetching tracking state, data: {data}")
        tracking_state = await crud.trackingstate.get_tracking_state(dbsession, name=state_name)
        await emit_tracker_data(dbsession, sio, logger, requested_tracker_id)
        await emit_ui_tracker_values(dbsession, sio, logger, requested_tracker_id)
        response = {"success": tracking_state["success"], "data": tracking_state.get("data", [])}
        response["tracker_id"] = requested_tracker_id
        return response


async def set_tracking_state(
    sio: Any, data: Optional[Dict], logger: Any, sid: str
) -> Dict[str, Any]:
    """
    Update tracking state and emit tracker data.

    Args:
        sio: Socket.IO server instance
        data: Tracking state updates (format: {"name": "satellite-tracking", "value": {...}})
        logger: Logger instance
        sid: Socket.IO session ID

    Returns:
        Dictionary with success status and updated tracking state
    """
    logger.info(f"Updating satellite tracking state, data: {data}")

    try:
        tracker_id = require_tracker_id((data or {}).get("tracker_id"))
    except InvalidTrackerIdError:
        return _tracker_id_required_response()

    # Extract the value from the data structure
    value = data.get("value", {}) if data else {}

    # Enforce one rotator -> one tracker ownership.
    assignment_previous_rotator = get_assigned_rotator_for_tracker(tracker_id)
    requested_rotator_id = value.get("rotator_id") if value else None
    ownership_touched = requested_rotator_id is not None
    if ownership_touched:
        assignment_result = assign_rotator_to_tracker(tracker_id, requested_rotator_id)
        if not assignment_result.get("success"):
            owner_tracker_id = assignment_result.get("owner_tracker_id")
            message = f"Rotator '{requested_rotator_id}' is already assigned to tracker '{owner_tracker_id}'."
            return {
                "success": False,
                "error": "rotator_in_use",
                "message": message,
                "data": {
                    "tracker_id": tracker_id,
                    "rotator_id": requested_rotator_id,
                    "owner_tracker_id": owner_tracker_id,
                },
            }

    # Use TrackerManager to update tracking state
    manager = get_tracker_manager(tracker_id)
    result = await manager.update_tracking_state(requester_sid=sid, **value)
    if not result.get("success") and ownership_touched:
        restore_tracker_rotator_assignment(tracker_id, assignment_previous_rotator)
    command_id = result.get("command_id")

    command_scope = result.get("command_scope", TrackerCommandScopes.TRACKING)
    requested_state = {
        "rotator_state": value.get("rotator_state"),
        "rig_state": value.get("rig_state"),
    }
    if command_id:
        await sio.emit(
            SocketEvents.TRACKER_COMMAND_STATUS,
            {
                "command_id": command_id,
                "tracker_id": tracker_id,
                "status": TrackerCommandStatus.SUBMITTED,
                "scope": command_scope,
                "requested_state": requested_state,
            },
        )

    # Track session's rig and VFO selection
    if value:
        rig_id = value.get("rig_id")
        rig_vfo = value.get("rig_vfo")
        rig_state = value.get("rig_state")

        if rig_id and rig_id != "none":
            session_tracker.set_session_rig(sid, rig_id)
            logger.debug(f"Session {sid} tracking rig {rig_id}")

        if rig_vfo and rig_vfo != "none":
            session_tracker.set_session_vfo(sid, rig_vfo)
            logger.debug(f"Session {sid} selected VFO {rig_vfo}")

        # Unlock VFOs when tracking stops for this SDR
        if rig_state == RigStates.STOPPED and rig_id and rig_id != "none":
            # Note: VFO locking state (lockedTransmitterId) is UI-only and managed by the frontend
            # No backend action needed when tracking stops
            logger.info(f"Tracking stopped for session {sid}")

    # Emit so that any open browsers are also informed of any change
    async with AsyncSessionLocal() as dbsession:
        await emit_tracker_data(dbsession, sio, logger, tracker_id)
        await emit_ui_tracker_values(dbsession, sio, logger, tracker_id)
    await emit_tracker_instances(sio)

    return {
        "success": result.get("success", False),
        "data": {
            "tracker_id": tracker_id,
            "value": result.get("data", {}).get("value", value),
            "command_id": command_id,
            "command_scope": command_scope,
            "requested_state": requested_state,
        },
    }


async def get_tracker_instances(
    sio: Any, data: Optional[Dict], logger: Any, sid: str
) -> Dict[str, Union[bool, dict]]:
    return {
        "success": True,
        "data": get_tracker_instances_payload(),
    }


async def fetch_next_passes(
    sio: Any, data: Optional[Dict], logger: Any, sid: str
) -> Dict[str, Union[bool, list, float]]:
    """
    Fetch next passes for a satellite.

    Args:
        sio: Socket.IO server instance
        data: NORAD ID, forecast hours, and optional force_recalculate flag
        logger: Logger instance
        sid: Socket.IO session ID

    Returns:
        Dictionary with success status and next passes
    """
    norad_id = data.get("norad_id", None) if data else None
    hours = data.get("hours", 4.0) if data else 4.0
    min_elevation = data.get("min_elevation", 0) if data else 0
    force_recalculate = data.get("force_recalculate", False) if data else False
    logger.info(
        f"Handling request from client_id={sid}, norad_id={norad_id}, hours={hours}, "
        f"min_elevation={min_elevation}, force_recalculate={force_recalculate} (get_next_passes)"
    )
    # Always calculate passes from horizon (above_el=0) to get complete pass times
    next_passes = await fetch_next_events_for_satellite(
        norad_id=norad_id, hours=hours, above_el=0, force_recalculate=force_recalculate
    )

    # Filter passes by peak elevation if min_elevation is specified
    if next_passes["success"] and min_elevation > 0:
        filtered_passes = [
            p for p in next_passes.get("data", []) if p.get("peak_altitude", 0) >= min_elevation
        ]
        next_passes["data"] = filtered_passes

    return {
        "success": next_passes["success"],
        "data": next_passes.get("data", []),
        "cached": next_passes.get("cached", False),
        "forecast_hours": next_passes.get("forecast_hours", 4.0),
    }


def register_handlers(registry):
    """Register tracking handlers with the command registry."""
    registry.register_batch(
        {
            "get-tracking-state": (get_tracking_state, "data_request"),
            "set-tracking-state": (set_tracking_state, "data_submission"),
            "get-tracker-instances": (get_tracker_instances, "data_request"),
            "fetch-next-passes": (fetch_next_passes, "data_request"),
        }
    )
