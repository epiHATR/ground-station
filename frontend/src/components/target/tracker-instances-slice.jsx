import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export const fetchTrackerInstances = createAsyncThunk(
    'trackerInstances/fetchTrackerInstances',
    async ({ socket }, { rejectWithValue }) => {
        return new Promise((resolve, reject) => {
            socket.emit('data_request', 'get-tracker-instances', null, (response) => {
                if (response?.success) {
                    resolve(response?.data || {});
                } else {
                    reject(
                        rejectWithValue(
                            response?.message
                            || response?.error
                            || 'Failed to fetch tracker instances'
                        )
                    );
                }
            });
        });
    }
);

const trackerInstancesSlice = createSlice({
    name: 'trackerInstances',
    initialState: {
        instances: [],
        updatedAt: null,
        loading: false,
        error: null,
    },
    reducers: {
        setTrackerInstances(state, action) {
            const payload = action.payload || {};
            state.instances = Array.isArray(payload.instances) ? payload.instances : [];
            state.updatedAt = payload.updated_at || Date.now() / 1000;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTrackerInstances.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTrackerInstances.fulfilled, (state, action) => {
                state.loading = false;
                const payload = action.payload || {};
                state.instances = Array.isArray(payload.instances) ? payload.instances : [];
                state.updatedAt = payload.updated_at || Date.now() / 1000;
                state.error = null;
            })
            .addCase(fetchTrackerInstances.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error?.message || 'Failed to fetch tracker instances';
            });
    },
});

export const { setTrackerInstances } = trackerInstancesSlice.actions;
export default trackerInstancesSlice.reducer;

