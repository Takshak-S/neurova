import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AIFeature } from "@/types/api.types";

// UI slice manages global UI state that doesn't belong to any specific feature.
// Theme, panel visibility, modals, etc.

type Theme = "light" | "dark" | "system";

interface UIState {
    theme: Theme;
    aiPanelOpen: boolean;
    aiFeature: AIFeature | null;
    sidebarOpen: boolean;
    searchOpen: boolean;
    newChatModalOpen: boolean;
}

const initialState: UIState = {
    theme: "system",
    aiPanelOpen: false,
    aiFeature: null,
    sidebarOpen: true,
    searchOpen: false,
    newChatModalOpen: false,
};

const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
        setTheme: (state, action: PayloadAction<Theme>) => {
            state.theme = action.payload;
            if (typeof window !== "undefined") {
                localStorage.setItem("neurova_theme", action.payload);
            }
        },
        openAIPanel: (state, action: PayloadAction<AIFeature>) => {
            state.aiPanelOpen = true;
            state.aiFeature = action.payload;
        },
        closeAIPanel: (state) => {
            state.aiPanelOpen = false;
            state.aiFeature = null;
        },
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSidebarOpen: (state, action: PayloadAction<boolean>) => {
            state.sidebarOpen = action.payload;
        },
        setSearchOpen: (state, action: PayloadAction<boolean>) => {
            state.searchOpen = action.payload;
        },
        setNewChatModalOpen: (state, action: PayloadAction<boolean>) => {
            state.newChatModalOpen = action.payload;
        },
    },
});

export const {
    setTheme,
    openAIPanel,
    closeAIPanel,
    toggleSidebar,
    setSidebarOpen,
    setSearchOpen,
    setNewChatModalOpen,
} = uiSlice.actions;

export default uiSlice.reducer;