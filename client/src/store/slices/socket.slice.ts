import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface SocketState {
    isConnected: boolean;
    typingUsers: Record<string, string[]>; // conversationId → userId[]
    onlineUsers: Set<string>;
}

const initialState: SocketState = {
    isConnected: false,
    typingUsers: {},
    onlineUsers: new Set(),
};

const socketSlice = createSlice({
    name: "socket",
    initialState,
    reducers: {
        setConnected: (state, action: PayloadAction<boolean>) => {
            state.isConnected = action.payload;
        },
        setUserTyping: (state, action: PayloadAction<{ conversationId: string; userId: string }>) => {
            const { conversationId, userId } = action.payload;
            if (!state.typingUsers[conversationId]) state.typingUsers[conversationId] = [];
            if (!state.typingUsers[conversationId].includes(userId)) {
                state.typingUsers[conversationId].push(userId);
            }
        },
        setUserStopTyping: (state, action: PayloadAction<{ conversationId: string; userId: string }>) => {
            const { conversationId, userId } = action.payload;
            if (state.typingUsers[conversationId]) {
                state.typingUsers[conversationId] = state.typingUsers[conversationId]
                    .filter(id => id !== userId);
            }
        },
        setUserOnline: (state, action: PayloadAction<{ userId: string; isOnline: boolean }>) => {
            if (action.payload.isOnline) state.onlineUsers.add(action.payload.userId);
            else state.onlineUsers.delete(action.payload.userId);
        },
    },
});

export const { setConnected, setUserTyping, setUserStopTyping, setUserOnline } = socketSlice.actions;
export default socketSlice.reducer;