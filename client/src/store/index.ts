import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import authReducer from "./slices/auth.slice";
import conversationReducer from "./slices/conversation.slice";
import messageReducer from "./slices/message.slice";
import socketReducer from "./slices/socket.slice";
import uiReducer from "./slices/ui.slice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        conversations: conversationReducer,
        messages: messageReducer,
        socket: socketReducer,
        ui: uiReducer,
    },
    // Disable serializable check for CryptoKey objects if they ever reach the store.
    // In practice, CryptoKeys live in IndexedDB, not Redux — but this prevents
    // accidental warnings if any crypto state leaks through.
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredPaths: ["messages.byConversation"],
            },
        }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks — use these everywhere instead of plain useDispatch/useSelector
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;