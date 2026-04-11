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


import * as React from 'react';
import Box from '@mui/material/Box';
import {DataGrid, gridClasses} from "@mui/x-data-grid";
import Stack from "@mui/material/Stack";
import {
    Alert,
    AlertTitle,
    Button,
    Checkbox,
    FormControlLabel,
    InputAdornment,
    MenuItem,
    TextField,
    Typography
} from "@mui/material";
import {useEffect, useMemo, useState} from "react";
import { useTranslation } from 'react-i18next';
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { alpha } from '@mui/material/styles';
import {useSocket} from "../common/socket.jsx";
import { toast } from '../../utils/toast-with-timestamp.jsx';
import {useDispatch, useSelector} from 'react-redux';
import {
    deleteRotators,
    fetchRotators,
    submitOrEditRotator,
    setOpenDeleteConfirm,
    setOpenAddDialog,
    setFormValues,
    resetFormValues,
} from './rotaror-slice.jsx';
import Paper from "@mui/material/Paper";
import {toRowSelectionModel, toSelectedIds} from '../../utils/datagrid-selection.js';
import SelectionActionBar from './selection-action-bar.jsx';


export default function AntennaRotatorTable() {
    const {socket} = useSocket();
    const dispatch = useDispatch();
    const [selected, setSelected] = useState([]);
    const [pageSize, setPageSize] = useState(10);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [parkPositionEnabled, setParkPositionEnabled] = useState(false);
    const { t } = useTranslation('hardware');
    const {
        loading,
        rotators,
        status,
        error,
        openAddDialog,
        openDeleteConfirm,
        formValues
    } = useSelector((state) => state.rotators);
    const rowSelectionModel = useMemo(() => toRowSelectionModel(selected), [selected]);
    const isEditing = Boolean(formValues.id);
    const requiresDeleteConfirmationText = selected.length > 1;
    const canConfirmDelete = !requiresDeleteConfirmationText || deleteConfirmText.trim() === 'DELETE';
    const formatDegrees = (value) => (value === null || value === undefined || value === '' ? '' : `${value}°`);
    const formatParkDegrees = (value) =>
        (value === null || value === undefined || value === '' ? '-' : `${value}°`);
    const isEmptyValue = (value) => value === '' || value === null || value === undefined;

    const columns = [
        {field: 'name', headerName: t('rotator.name'), flex: 1, minWidth: 150},
        {field: 'host', headerName: t('rotator.host'), flex: 1, minWidth: 150},
        {
            field: 'port',
            headerName: t('rotator.port'),
            type: 'number',
            flex: 1,
            minWidth: 80,
            align: 'right',
            headerAlign: 'right',
            valueFormatter: (value) => {
                return value;
            }
        },
        {
            field: 'minaz',
            headerName: t('rotator.min_az'),
            type: 'number',
            flex: 1,
            minWidth: 80,
            valueFormatter: (value) => formatDegrees(value)
        },
        {
            field: 'maxaz',
            headerName: t('rotator.max_az'),
            type: 'number',
            flex: 1,
            minWidth: 80,
            valueFormatter: (value) => formatDegrees(value)
        },
        {
            field: 'azimuth_mode',
            headerName: t('rotator.azimuth_range'),
            flex: 1,
            minWidth: 140,
            valueFormatter: (value) =>
                value === '-180_180'
                    ? t('rotator.azimuth_mode_neg180_180')
                    : t('rotator.azimuth_mode_0_360')
        },
        {
            field: 'minel',
            headerName: t('rotator.min_el'),
            type: 'number',
            flex: 1,
            minWidth: 80,
            valueFormatter: (value) => formatDegrees(value)
        },
        {
            field: 'maxel',
            headerName: t('rotator.max_el'),
            type: 'number',
            flex: 1,
            minWidth: 80,
            valueFormatter: (value) => formatDegrees(value)
        },
        {
            field: 'parkaz',
            headerName: t('rotator.park_az'),
            type: 'number',
            flex: 1,
            minWidth: 100,
            valueFormatter: (value) => formatParkDegrees(value)
        },
        {
            field: 'parkel',
            headerName: t('rotator.park_el'),
            type: 'number',
            flex: 1,
            minWidth: 100,
            valueFormatter: (value) => formatParkDegrees(value)
        },
        {
            field: 'aztolerance',
            headerName: t('rotator.az_tolerance'),
            type: 'number',
            flex: 1,
            minWidth: 110,
            valueFormatter: (value) => formatDegrees(value)
        },
        {
            field: 'eltolerance',
            headerName: t('rotator.el_tolerance'),
            type: 'number',
            flex: 1,
            minWidth: 110,
            valueFormatter: (value) => formatDegrees(value)
        },
    ];

    // useEffect(() => {
    //     // Only dispatch if the socket is ready
    //     if (socket) {
    //         dispatch(fetchRotators({socket}));
    //     }
    // }, [dispatch, socket]);

    const handleChange = (e) => {
        const {name, value} = e.target;
        dispatch(setFormValues({...formValues, [name]: value}));
    };

    const toOptionalNumber = (value) => {
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        return Number(value);
    };

    const preparePayload = () => ({
        ...formValues,
        port: Number(formValues.port),
        minaz: Number(formValues.minaz),
        maxaz: Number(formValues.maxaz),
        minel: Number(formValues.minel),
        maxel: Number(formValues.maxel),
        parkaz: toOptionalNumber(formValues.parkaz),
        parkel: toOptionalNumber(formValues.parkel),
        aztolerance: Number(formValues.aztolerance),
        eltolerance: Number(formValues.eltolerance),
    });

    const handleSubmit = () => {
        dispatch(submitOrEditRotator({socket, formValues: preparePayload()}))
            .unwrap()
            .then(() => {
                toast.success(t('rotator.saved_success'));
                setOpenAddDialog(false);
            })
            .catch((err) => {
                toast.error(err.message);
            });
    }

    const validationErrors = {};
    if (!formValues.name?.trim()) validationErrors.name = t('shared.required');
    if (!formValues.host?.trim()) validationErrors.host = t('shared.required');
    if (!formValues.port && formValues.port !== 0) {
        validationErrors.port = t('shared.required');
    } else if (Number(formValues.port) <= 0 || Number(formValues.port) > 65535) {
        validationErrors.port = t('shared.port_range');
    }
    if (isEmptyValue(formValues.minaz)) {
        validationErrors.minaz = t('shared.required');
    } else if (Number.isNaN(Number(formValues.minaz))) {
        validationErrors.minaz = t('shared.must_be_number');
    }
    if (isEmptyValue(formValues.maxaz)) {
        validationErrors.maxaz = t('shared.required');
    } else if (Number.isNaN(Number(formValues.maxaz))) {
        validationErrors.maxaz = t('shared.must_be_number');
    }
    if (!isEmptyValue(formValues.minaz)
        && !isEmptyValue(formValues.maxaz)
        && Number(formValues.minaz) > Number(formValues.maxaz)) {
        validationErrors.minaz = t('rotator.validation.min_az_lte_max_az');
        validationErrors.maxaz = t('rotator.validation.min_az_lte_max_az');
    }
    if (!['0_360', '-180_180'].includes(formValues.azimuth_mode ?? '0_360')) {
        validationErrors.azimuth_mode = t('rotator.validation.invalid_azimuth_mode');
    }
    if (isEmptyValue(formValues.minel)) {
        validationErrors.minel = t('shared.required');
    } else if (Number.isNaN(Number(formValues.minel))) {
        validationErrors.minel = t('shared.must_be_number');
    }
    if (isEmptyValue(formValues.maxel)) {
        validationErrors.maxel = t('shared.required');
    } else if (Number.isNaN(Number(formValues.maxel))) {
        validationErrors.maxel = t('shared.must_be_number');
    }
    if (!isEmptyValue(formValues.minel)
        && !isEmptyValue(formValues.maxel)
        && Number(formValues.minel) > Number(formValues.maxel)) {
        validationErrors.minel = t('rotator.validation.min_el_lte_max_el');
        validationErrors.maxel = t('rotator.validation.min_el_lte_max_el');
    }
    if (!isEmptyValue(formValues.parkaz) && Number.isNaN(Number(formValues.parkaz))) {
        validationErrors.parkaz = t('shared.must_be_number');
    }
    if (!isEmptyValue(formValues.parkel) && Number.isNaN(Number(formValues.parkel))) {
        validationErrors.parkel = t('shared.must_be_number');
    }
    if (isEmptyValue(formValues.parkaz) !== isEmptyValue(formValues.parkel)) {
        validationErrors.parkaz = t('rotator.validation.park_both_or_none');
        validationErrors.parkel = t('rotator.validation.park_both_or_none');
    }
    if (isEmptyValue(formValues.aztolerance)) {
        validationErrors.aztolerance = t('shared.required');
    } else if (Number.isNaN(Number(formValues.aztolerance))) {
        validationErrors.aztolerance = t('shared.must_be_number');
    } else if (Number(formValues.aztolerance) < 0) {
        validationErrors.aztolerance = t('shared.must_be_gte_zero');
    }
    if (isEmptyValue(formValues.eltolerance)) {
        validationErrors.eltolerance = t('shared.required');
    } else if (Number.isNaN(Number(formValues.eltolerance))) {
        validationErrors.eltolerance = t('shared.must_be_number');
    } else if (Number(formValues.eltolerance) < 0) {
        validationErrors.eltolerance = t('shared.must_be_gte_zero');
    }
    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    useEffect(() => {
        if (!openAddDialog) return;
        const hasParkValues = !isEmptyValue(formValues.parkaz) || !isEmptyValue(formValues.parkel);
        setParkPositionEnabled(hasParkValues);
    }, [openAddDialog]);

    const handleDelete = () => {
        dispatch(deleteRotators({socket, selectedIds: selected}))
            .unwrap()
            .then(() => {
                toast.success(t('rotator.deleted_success'));
                dispatch(setOpenDeleteConfirm(false));
            })
            .catch((err) => {
                toast.error(err.message);
            });
    };

    return (
        <Paper elevation={3} sx={{padding: 2, marginTop: 0}}>
            <Alert severity="info">
                <AlertTitle>{t('rotator.title')}</AlertTitle>
                {t('rotator.subtitle')}
            </Alert>
            <Box component="form" sx={{mt: 2}}>
                <Box sx={{width: '100%'}}>
                    <DataGrid
                        loading={loading}
                        rows={rotators}
                        columns={columns}
                        checkboxSelection
                        disableRowSelectionExcludeModel
                        onRowSelectionModelChange={(selected) => {
                            setSelected(toSelectedIds(selected));
                        }}
                        initialState={{
                            pagination: {paginationModel: {pageSize: 5}},
                            sorting: {
                                sortModel: [{field: 'name', sort: 'desc'}],
                            },
                        }}
                        rowSelectionModel={rowSelectionModel}
                        pageSize={pageSize}
                        pageSizeOptions={[5, 10, 25, {value: -1, label: t('shared.all')}]}
                        onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
                        rowsPerPageOptions={[5, 10, 25]}
                        getRowId={(row) => row.id}
                        localeText={{
                            noRowsLabel: t('rotator.no_rotators')
                        }}
                        sx={{
                            border: 0,
                            marginTop: 2,
                            [`& .${gridClasses.cell}:focus, & .${gridClasses.cell}:focus-within`]: {
                                outline: 'none',
                            },
                            [`& .${gridClasses.columnHeader}:focus, & .${gridClasses.columnHeader}:focus-within`]:
                                {
                                    outline: 'none',
                                },
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: (theme) => alpha(
                                    theme.palette.primary.main,
                                    theme.palette.mode === 'dark' ? 0.18 : 0.10
                                ),
                                borderBottom: (theme) => `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                            },
                            '& .MuiDataGrid-columnHeader': {
                                backgroundColor: 'transparent',
                            },
                            '& .MuiDataGrid-columnHeaderTitle': {
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                            },
                            '& .MuiDataGrid-overlay': {
                                fontSize: '0.875rem',
                                fontStyle: 'italic',
                                color: 'text.secondary',
                            },
                        }}
                    />
                    <SelectionActionBar
                        selectedCount={selected.length}
                        onClearSelection={() => setSelected([])}
                        primaryActions={
                            <>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        dispatch(resetFormValues());
                                        dispatch(setOpenAddDialog(true));
                                    }}
                                    disabled={loading}
                                >
                                    {t('rotator.add')}
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={selected.length !== 1 || loading}
                                    onClick={() => {
                                        const selectedRow = rotators.find(row => row.id === selected[0]);
                                        if (selectedRow) {
                                            dispatch(setFormValues(selectedRow));
                                            dispatch(setOpenAddDialog(true));
                                        }
                                    }}
                                >
                                    {t('rotator.edit')}
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={selected.length < 1 || loading}
                                    color="error"
                                    onClick={() => {
                                        setDeleteConfirmText('');
                                        dispatch(setOpenDeleteConfirm(true));
                                    }}
                                >
                                    {t('rotator.delete')}
                                </Button>
                            </>
                        }
                    />
                    <Stack direction="row" spacing={2} style={{marginTop: 15}}>
                        <Dialog
                            fullWidth={true}
                            open={openAddDialog}
                            onClose={() => dispatch(setOpenAddDialog(false))}
                            PaperProps={{
                                sx: {
                                    bgcolor: 'background.paper',
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                    borderRadius: 2,
                                }
                            }}
                        >
                            <DialogTitle
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                                    fontSize: '1.25rem',
                                    fontWeight: 'bold',
                                    py: 2.5,
                                }}
                            >
                                {isEditing ? t('rotator.edit_dialog_title') : t('rotator.add_dialog_title')}
                            </DialogTitle>
                            <DialogContent sx={{ bgcolor: 'background.paper', px: 3, py: 3, pt: '1em' }}>
                                <Stack spacing={2} sx={{ mt: 3 }}>
                                    <TextField
                                        name="name"
                                        label={t('rotator.name')}
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.name}
                                        error={Boolean(validationErrors.name)}
                                        required
                                    />
                                    <TextField
                                        name="host"
                                        label={t('rotator.host')}
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.host}
                                        error={Boolean(validationErrors.host)}
                                        required
                                    />
                                    <TextField
                                        name="port"
                                        label={t('rotator.port')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.port}
                                        error={Boolean(validationErrors.port)}
                                        required
                                    />
                                    <TextField
                                        name="minaz"
                                        label={t('rotator.min_az')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.minaz}
                                        error={Boolean(validationErrors.minaz)}
                                        required
                                        InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                                    />
                                    <TextField
                                        name="maxaz"
                                        label={t('rotator.max_az')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.maxaz}
                                        error={Boolean(validationErrors.maxaz)}
                                        required
                                        InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                                    />
                                    <TextField
                                        name="azimuth_mode"
                                        label={t('rotator.azimuth_range')}
                                        select
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.azimuth_mode ?? '0_360'}
                                        error={Boolean(validationErrors.azimuth_mode)}
                                        helperText={
                                            validationErrors.azimuth_mode
                                            || (
                                                (formValues.azimuth_mode ?? '0_360') === '-180_180'
                                                    ? t('rotator.azimuth_mode_help_neg180_180')
                                                    : t('rotator.azimuth_mode_help_0_360')
                                            )
                                        }
                                        required
                                    >
                                        <MenuItem value="0_360">{t('rotator.azimuth_mode_0_360')}</MenuItem>
                                        <MenuItem value="-180_180">{t('rotator.azimuth_mode_neg180_180')}</MenuItem>
                                    </TextField>
                                    <TextField
                                        name="minel"
                                        label={t('rotator.min_el')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.minel}
                                        error={Boolean(validationErrors.minel)}
                                        required
                                        InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                                    />
                                    <TextField
                                        name="maxel"
                                        label={t('rotator.max_el')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.maxel}
                                        error={Boolean(validationErrors.maxel)}
                                        required
                                        InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                                    />
                                    <Alert severity="warning" sx={{ mt: 0.5 }}>
                                        {t('rotator.tolerance_warning')}
                                    </Alert>
                                    <TextField
                                        name="aztolerance"
                                        label={t('rotator.az_tolerance')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.aztolerance}
                                        error={Boolean(validationErrors.aztolerance)}
                                        helperText={validationErrors.aztolerance ? validationErrors.aztolerance : t('rotator.tolerance_helper')}
                                        required
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <WarningAmberOutlinedIcon
                                                            fontSize="small"
                                                            color="warning"
                                                            sx={{ opacity: 0.7 }}
                                                        />
                                                        <span>°</span>
                                                    </Box>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                    <TextField
                                        name="eltolerance"
                                        label={t('rotator.el_tolerance')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.eltolerance}
                                        error={Boolean(validationErrors.eltolerance)}
                                        helperText={validationErrors.eltolerance ? validationErrors.eltolerance : t('rotator.tolerance_helper')}
                                        required
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <WarningAmberOutlinedIcon
                                                            fontSize="small"
                                                            color="warning"
                                                            sx={{ opacity: 0.7 }}
                                                        />
                                                        <span>°</span>
                                                    </Box>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                    <Alert severity="warning" sx={{ mt: 1 }}>
                                        {t('rotator.park_override_warning')}
                                    </Alert>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={parkPositionEnabled}
                                                onChange={(event) => {
                                                    const enabled = event.target.checked;
                                                    setParkPositionEnabled(enabled);
                                                    if (!enabled) {
                                                        dispatch(setFormValues({ parkaz: null, parkel: null }));
                                                    }
                                                }}
                                            />
                                        }
                                        label={t('rotator.enable_park_override')}
                                    />
                                    <TextField
                                        name="parkaz"
                                        label={t('rotator.park_az')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.parkaz ?? ''}
                                        error={Boolean(validationErrors.parkaz)}
                                        helperText={validationErrors.parkaz || t('rotator.park_position_helper')}
                                        disabled={!parkPositionEnabled}
                                        InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                                    />
                                    <TextField
                                        name="parkel"
                                        label={t('rotator.park_el')}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        onChange={handleChange}
                                        value={formValues.parkel ?? ''}
                                        error={Boolean(validationErrors.parkel)}
                                        helperText={validationErrors.parkel || t('rotator.park_position_helper')}
                                        disabled={!parkPositionEnabled}
                                        InputProps={{ endAdornment: <InputAdornment position="end">°</InputAdornment> }}
                                    />
                                </Stack>
                            </DialogContent>
                            <DialogActions
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                                    borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                                    px: 3,
                                    py: 2.5,
                                    gap: 2,
                                }}
                            >
                                <Button
                                    onClick={() => dispatch(setOpenAddDialog(false))}
                                    variant="outlined"
                                    sx={{
                                        borderColor: (theme) => theme.palette.mode === 'dark' ? 'grey.700' : 'grey.400',
                                        '&:hover': {
                                            borderColor: (theme) => theme.palette.mode === 'dark' ? 'grey.600' : 'grey.500',
                                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                                        },
                                    }}
                                >
                                    {t('rotator.cancel')}
                                </Button>
                                <Button
                                    color="success"
                                    variant="contained"
                                    onClick={handleSubmit}
                                    disabled={hasValidationErrors || loading}
                                >
                                    {t('rotator.submit')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                        <Dialog
                            open={openDeleteConfirm}
                            onClose={() => {
                                setDeleteConfirmText('');
                                dispatch(setOpenDeleteConfirm(false));
                            }}
                            maxWidth="sm"
                            fullWidth
                            PaperProps={{
                                sx: {
                                    bgcolor: 'background.paper',
                                    borderRadius: 2,
                                }
                            }}
                        >
                            <DialogTitle
                                sx={{
                                    bgcolor: 'error.main',
                                    color: 'error.contrastText',
                                    fontSize: '1.125rem',
                                    fontWeight: 600,
                                    py: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                }}
                            >
                                <Box
                                    component="span"
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        bgcolor: 'error.contrastText',
                                        color: 'error.main',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                    }}
                                >
                                    !
                                </Box>
                                {t('rotator.confirm_deletion')}
                            </DialogTitle>
                            <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
                                <Typography variant="body1" sx={{ mt: 2, mb: 2, color: 'text.primary' }}>
                                    {t('rotator.confirm_delete_message')}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2, fontWeight: 600, color: 'text.secondary' }}>
                                    {selected.length === 1
                                        ? t('rotator.delete_list_single')
                                        : t('rotator.delete_list_plural', { count: selected.length })}
                                </Typography>
                                {requiresDeleteConfirmationText && (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={t('common.type_delete_to_confirm', 'Type DELETE to confirm')}
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        sx={{ mb: 2 }}
                                    />
                                )}
                                <Box sx={{
                                    maxHeight: 300,
                                    overflowY: 'auto',
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                                    borderRadius: 1,
                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                }}>
                                    {selected.map((id, index) => {
                                        const rotator = rotators.find(r => r.id === id);
                                        if (!rotator) return null;
                                        return (
                                            <Box
                                                key={id}
                                                sx={{
                                                    p: 2,
                                                    borderBottom: index < selected.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : 'none',
                                                }}
                                            >
                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                                                    {rotator.name}
                                                </Typography>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, columnGap: 2 }}>
                                                    <Typography variant="body2" sx={{ fontSize: '0.813rem', color: 'text.secondary', fontWeight: 500 }}>
                                                        {t('rotator.host')}:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '0.813rem', color: 'text.primary' }}>
                                                        {rotator.host}:{rotator.port}
                                                    </Typography>

                                                    <Typography variant="body2" sx={{ fontSize: '0.813rem', color: 'text.secondary', fontWeight: 500 }}>
                                                        {t('rotator.azimuth_range')}:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '0.813rem', color: 'text.primary' }}>
                                                        {rotator.minaz}° - {rotator.maxaz}°
                                                    </Typography>

                                                    <Typography variant="body2" sx={{ fontSize: '0.813rem', color: 'text.secondary', fontWeight: 500 }}>
                                                        {t('rotator.elevation_range')}:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '0.813rem', color: 'text.primary' }}>
                                                        {rotator.minel}° - {rotator.maxel}°
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </DialogContent>
                            <DialogActions
                                sx={{
                                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                                    borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                                    px: 3,
                                    py: 2,
                                    gap: 1.5,
                                }}
                            >
                                <Button
                                    onClick={() => dispatch(setOpenDeleteConfirm(false))}
                                    variant="outlined"
                                    color="inherit"
                                    sx={{
                                        minWidth: 100,
                                        textTransform: 'none',
                                        fontWeight: 500,
                                    }}
                                >
                                    {t('rotator.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleDelete}
                                    color="error"
                                    disabled={!canConfirmDelete || loading}
                                    sx={{
                                        minWidth: 100,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                    }}
                                >
                                    {t('rotator.delete')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Stack>
                </Box>
            </Box>
        </Paper>

    );
}
