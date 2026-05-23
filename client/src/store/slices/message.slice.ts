import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { messageAPI } from "@/lib/api/message.api";
import { Message } from "@/types/api.types";
import { extractErrorMessage } from "@/lib/api/client";

interface MessageState {
    // Messages indexed by conversationId — Map-like structure in Redux
    byConversation: Record<string, Message[]>;
    cursors: Record<string, string | null>; // conversationId → nextCursor
    hasMore: Record<string, boolean>;
    loading: Record<string, boolean>;
    error: string | null;
}

const initialState: MessageState = {
    byConversation: {},
    cursors: {},
    hasMore: {},
    loading: {},
    error: null,
};

export const fetchMessages = createAsyncThunk(
    "messages/fetch",
    async ({ conversationId, before }: { conversationId: string; before?: string }, { rejectWithValue }) => {
        try {
            const res = await messageAPI.getMessages(conversationId, before);
            return { conversationId, ...res.data.data };
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const markConversationRead = createAsyncThunk(
    "messages/markRead",
    async (conversationId: string, { rejectWithValue }) => {
        try {
            await messageAPI.markAsRead(conversationId);
            return conversationId;
        } catch (err) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

const messageSlice = createSlice({
    name: "messages",
    initialState,
    reducers: {
        // Adds a new incoming real-time message
        addMessage: (state, action: PayloadAction<Message>) => {
            const { conversationId } = action.payload;
            if (!state.byConversation[conversationId]) {
                state.byConversation[conversationId] = [];
            }
            // Prevent duplicates from socket + REST overlap
            const exists = state.byConversation[conversationId]
                .some(m => m._id === action.payload._id);
            if (!exists) {
                state.byConversation[conversationId].push(action.payload);
            }
        },
        // Adds an optimistic message before server confirms
        addOptimisticMessage: (state, action: PayloadAction<Message>) => {
            const { conversationId } = action.payload;
            if (!state.byConversation[conversationId]) {
                state.byConversation[conversationId] = [];
            }
            state.byConversation[conversationId].push({ ...action.payload, isPending: true });
        },
        // Replaces an optimistic message with the server-confirmed version
        confirmMessage: (state, action: PayloadAction<{ tempId: string; message: Message }>) => {
            const { tempId, message } = action.payload;
            const msgs = state.byConversation[message.conversationId];
            if (!msgs) return;
            const idx = msgs.findIndex(m => m._id === tempId);
            if (idx >= 0) msgs[idx] = message;
        },
        // Marks an optimistic message as failed
        failMessage: (state, action: PayloadAction<{ tempId: string; conversationId: string }>) => {
            const msgs = state.byConversation[action.payload.conversationId];
            if (!msgs) return;
            const msg = msgs.find(m => m._id === action.payload.tempId);
            if (msg) { msg.isPending = false; msg.isFailed = true; }
        },
        updateMessageStatus: (state, action: PayloadAction<{
            messageId: string;
            conversationId: string;
            status: Message["status"];
        }>) => {
            const msgs = state.byConversation[action.payload.conversationId];
            if (!msgs) return;
            const msg = msgs.find(m => m._id === action.payload.messageId);
            if (msg) msg.status = action.payload.status;
        },
        setDecryptedText: (state, action: PayloadAction<{
            messageId: string;
            conversationId: string;
            text: string;
        }>) => {
            const msgs = state.byConversation[action.payload.conversationId];
            if (!msgs) return;
            const msg = msgs.find(m => m._id === action.payload.messageId);
            if (msg) msg.decryptedText = action.payload.text;
        },
        clearConversationMessages: (state, action: PayloadAction<string>) => {
            delete state.byConversation[action.payload];
            delete state.cursors[action.payload];
            delete state.hasMore[action.payload];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMessages.pending, (state, action) => {
                const convId = action.meta.arg.conversationId;
                state.loading[convId] = true;
            })
            .addCase(fetchMessages.fulfilled, (state, action) => {
                const { conversationId, messages, hasMore, nextCursor } = action.payload;
                state.loading[conversationId] = false;
                const isFirstPage = !action.meta.arg.before;
                if (isFirstPage) {
                    // Newest-first from server → reverse for display (oldest at top)
                    state.byConversation[conversationId] = [...messages].reverse();
                } else {
                    // Prepend older messages to the top
                    state.byConversation[conversationId] = [
                        ...messages.reverse(),
                        ...(state.byConversation[conversationId] ?? []),
                    ];
                }
                state.hasMore[conversationId] = hasMore;
                state.cursors[conversationId] = nextCursor;
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                const convId = action.meta.arg.conversationId;
                state.loading[convId] = false;
                state.error = action.payload as string;
            });
    },
});

export const {
    addMessage, addOptimisticMessage, confirmMessage,
    failMessage, updateMessageStatus, setDecryptedText,
    clearConversationMessages,
} = messageSlice.actions;
export default messageSlice.reducer;