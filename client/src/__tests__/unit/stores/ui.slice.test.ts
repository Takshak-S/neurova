import { configureStore } from "@reduxjs/toolkit";
import uiReducer, { setTheme, openAIPanel, closeAIPanel, setNewChatModalOpen } from "@/store/slices/ui.slice";

const makeStore = () => configureStore({ reducer: { ui: uiReducer } });

describe("ui.slice", () => {
    it("sets theme", () => {
        const s = makeStore();
        s.dispatch(setTheme("dark"));
        expect(s.getState().ui.theme).toBe("dark");
    });

    it("opens AI panel", () => {
        const s = makeStore();
        s.dispatch(openAIPanel("summarize"));
        expect(s.getState().ui.aiPanelOpen).toBe(true);
    });

    it("closes AI panel", () => {
        const s = makeStore();
        s.dispatch(openAIPanel("tasks"));
        s.dispatch(closeAIPanel());
        expect(s.getState().ui.aiPanelOpen).toBe(false);
    });

    it("toggles new chat modal", () => {
        const s = makeStore();
        s.dispatch(setNewChatModalOpen(true));
        expect(s.getState().ui.newChatModalOpen).toBe(true);
        s.dispatch(setNewChatModalOpen(false));
        expect(s.getState().ui.newChatModalOpen).toBe(false);
    });
});