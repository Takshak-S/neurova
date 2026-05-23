import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { authAPI } from "@/lib/api/auth.api";
import { User } from "@/types/api.types";
import { extractErrorMessage } from "@/lib/api/client";

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isNewUser: boolean;
    loading: boolean;
    error: string | null;
}

const initialState: AuthState = {
    user: typeof window !== "undefined"
        ? JSON.parse(localStorage.getItem("neurova_user") ?? "null")
        : null,
    token: typeof window !== "undefined"
        ? localStorage.getItem("neurova_token")
        : null,
    isAuthenticated: typeof window !== "undefined"
        ? !!localStorage.getItem("neurova_token")
        : false,
    isNewUser: false,
    loading: false,
    error: null,
};

export const sendOTP = createAsyncThunk(
    "auth/sendOTP",
    async (phone: string, { rejectWithValue }) => {
        try {
            const res = await authAPI.sendOTP(phone);
            return res.data.data;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const verifyOTP = createAsyncThunk(
    "auth/verifyOTP",
    async ({ phone, otp }: { phone: string; otp: string }, { rejectWithValue }) => {
        try {
            const res = await authAPI.verifyOTP(phone, otp);
            const { token, user, isNewUser } = res.data.data;
            localStorage.setItem("neurova_token", token);
            localStorage.setItem("neurova_user", JSON.stringify(user));
            return { token, user, isNewUser };
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const fetchMe = createAsyncThunk(
    "auth/fetchMe",
    async (_, { rejectWithValue }) => {
        try {
            const res = await authAPI.getMe();
            return res.data.data;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.isNewUser = false;
            localStorage.removeItem("neurova_token");
            localStorage.removeItem("neurova_user");
        },
        updateUser: (state, action: PayloadAction<Partial<User>>) => {
            if (state.user) {
                state.user = { ...state.user, ...action.payload };
                localStorage.setItem("neurova_user", JSON.stringify(state.user));
            }
        },
        clearError: (state) => { state.error = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sendOTP.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(sendOTP.fulfilled, (state) => { state.loading = false; })
            .addCase(sendOTP.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
            .addCase(verifyOTP.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(verifyOTP.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.isAuthenticated = true;
                state.isNewUser = action.payload.isNewUser;
            })
            .addCase(verifyOTP.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
            .addCase(fetchMe.fulfilled, (state, action) => { state.user = action.payload; });
    },
});

export const { logout, updateUser, clearError } = authSlice.actions;
export default authSlice.reducer;