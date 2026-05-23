import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { conversationAPI } from "@/lib/api/conversation.api";
import { Conversation } from "@/types/api.types";
import { extractErrorMessage } from "@/lib/api/client";

interface ConversationState {
    conversations: Conversation[];
    activeConversationId: string | null;
    loading: boolean;
    error: string | null;
}

const initialState: ConversationState = {
    conversations: [],
    activeConversationId: null,
    loading: false,
    error: null,
};

export const fetchConversations = createAsyncThunk(
    "conversations/fetchAll",
    async (_, { rejectWithValue }) => {
        try {
            const res = await conversationAPI.getAll();
            return res.data.data;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const createConversation = createAsyncThunk(
    "conversations/create",
    async (targetUserId: string, { rejectWithValue }) => {
        try {
            const res = await conversationAPI.create(targetUserId);
            return res.data.data;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const acceptRequest = createAsyncThunk(
    "conversations/accept",
    async (id: string, { rejectWithValue }) => {
        try {
            const res = await conversationAPI.accept(id);
            return res.data.data;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const rejectRequest = createAsyncThunk(
    "conversations/reject",
    async (id: string, { rejectWithValue }) => {
        try {
            await conversationAPI.reject(id);
            return id;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

const conversationSlice = createSlice({
    name: "conversations",
    initialState,
    reducers: {
        setActiveConversation: (state, action: PayloadAction<string | null>) => {
            state.activeConversationId = action.payload;
        },
        upsertConversation: (state, action: PayloadAction<Conversation>) => {
            const idx = state.conversations.findIndex(c => c._id === action.payload._id);
            if (idx >= 0) state.conversations[idx] = action.payload;
            else state.conversations.unshift(action.payload);
        },
        updateLastMessage: (state, action: PayloadAction<{
            conversationId: string;
            encryptedPreview: string;
            senderId: string;
            createdAt: string;
        }>) => {
            const conv = state.conversations.find(c => c._id === action.payload.conversationId);
            if (conv) {
                conv.lastMessage = {
                    encryptedPreview: action.payload.encryptedPreview,
                    senderId: action.payload.senderId,
                    createdAt: action.payload.createdAt,
                };
                // Bubble conversation to top of list
                const idx = state.conversations.indexOf(conv);
                state.conversations.splice(idx, 1);
                state.conversations.unshift(conv);
            }
        },
        updateMemberOnlineStatus: (state, action: PayloadAction<{ userId: string; isOnline: boolean }>) => {
            state.conversations.forEach(conv => {
                const member = conv.members.find(m => m.id === action.payload.userId);
                if (member) member.isOnline = action.payload.isOnline;
            });
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchConversations.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchConversations.fulfilled, (state, action) => { state.loading = false; state.conversations = action.payload; })
            .addCase(fetchConversations.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
            .addCase(createConversation.fulfilled, (state, action) => {
                const exists = state.conversations.find(c => c._id === action.payload._id);
                if (!exists) state.conversations.unshift(action.payload);
            })
            .addCase(acceptRequest.fulfilled, (state, action) => {
                const idx = state.conversations.findIndex(c => c._id === action.payload._id);
                if (idx >= 0) state.conversations[idx] = action.payload;
            })
            .addCase(rejectRequest.fulfilled, (state, action) => {
                state.conversations = state.conversations.filter(c => c._id !== action.payload);
            });
    },
});

export const {
    setActiveConversation, upsertConversation,
    updateLastMessage, updateMemberOnlineStatus
} = conversationSlice.actions;
export default conversationSlice.reducer;