/**
 * @license
 * Copyright (c) 2025 Efstratios Goudelis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */


import {useEffect, useState} from "react";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import * as React from "react";
import {useDispatch, useSelector} from "react-redux";
import { useTranslation } from 'react-i18next';
import {
    setSatelliteGroupSelectOpen,
    setSatelliteSelectOpen,
    setSatelliteId,
    setTrackerId,
    setRotator,
    setTrackingStateInBackend,
    setAvailableTransmitters,
} from './target-slice.jsx';
import {useSocket} from "../common/socket.jsx";
import { useTargetRotatorSelectionDialog } from './use-target-rotator-selection-dialog.jsx';
import { toast } from "../../utils/toast-with-timestamp.jsx";


function SatelliteList() {
    const dispatch = useDispatch();
    const {socket} = useSocket();
    const { t } = useTranslation('target');
    const {
        satelliteData,
        groupOfSats,
        satelliteId,
        groupId,
        loading,
        satelliteSelectOpen,
        satelliteGroupSelectOpen,
        trackingState,
        uiTrackerDisabled,
        starting,
        selectedRadioRig,
        selectedRotator,
        selectedTransmitter,
        availableTransmitters,
    } = useSelector((state) => state.targetSatTrack);
    const { requestRotatorForTarget, dialog: rotatorSelectionDialog } = useTargetRotatorSelectionDialog();

    function getTransmittersForSatelliteId(satelliteId) {
        if (satelliteId && groupOfSats.length > 0) {
            const satellite = groupOfSats.find(s => s.norad_id === satelliteId);
            if (satellite) {
                return satellite.transmitters || [];
            } else {
                return [];
            }
        }
        return [];
    }

    async function setTargetSatellite(eventOrSatelliteId) {
        // Determine the satelliteId based on the input type
        const satelliteId = typeof eventOrSatelliteId === 'object'
            ? eventOrSatelliteId.target.value
            : eventOrSatelliteId;
        const selectedSatellite = groupOfSats.find((sat) => String(sat.norad_id) === String(satelliteId));
        const selectedAssignment = await requestRotatorForTarget(selectedSatellite?.name);
        if (!selectedAssignment) {
            return;
        }
        const { rotatorId, trackerId } = selectedAssignment;

        dispatch(setSatelliteId(satelliteId));
        dispatch(setRotator(rotatorId));
        dispatch(setTrackerId(trackerId));
        dispatch(setAvailableTransmitters(getTransmittersForSatelliteId(satelliteId)));

        // Set the tracking state in the backend to the new norad id and leave the state as is
        const data = {
            ...trackingState,
            tracker_id: trackerId,
            norad_id: satelliteId,
            group_id: groupId,
            rig_id: selectedRadioRig,
            rotator_id: rotatorId,
            transmitter_id: selectedTransmitter,
        };
        try {
            await dispatch(setTrackingStateInBackend({ socket, data })).unwrap();
        } catch (error) {
            toast.error(error?.message || 'Failed to set target');
        }
    }

    const handleSelectOpenEvent = (event) => {
        dispatch(setSatelliteSelectOpen(true));
    };

    const handleSelectCloseEvent = (event) => {
        dispatch(setSatelliteSelectOpen(false));
    };

    return (
        <>
        {rotatorSelectionDialog}
        <FormControl
            disabled={trackingState['rotator_state'] === "tracking" || trackingState['rig_state'] === "tracking"}
            sx={{ margin: 0 }}
            fullWidth={true}
            size="small">
            <InputLabel htmlFor="satellite-select">{t('satellite_dropdown.label')}</InputLabel>
            <Select onClose={handleSelectCloseEvent}
                    onOpen={handleSelectOpenEvent}
                    value={groupOfSats.length > 0 && groupOfSats.find(s => s.norad_id === satelliteId) ? satelliteId : ""}
                    id="satellite-select" label={t('satellite_dropdown.label')}
                    size="small"
                    onChange={setTargetSatellite}>
                {groupOfSats.map((satellite, index) => {
                    return <MenuItem value={satellite['norad_id']}
                                     key={index}>#{satellite['norad_id']} {satellite['name']}</MenuItem>;
                })}
            </Select>
        </FormControl>
        </>
    );
}

export default SatelliteList;
