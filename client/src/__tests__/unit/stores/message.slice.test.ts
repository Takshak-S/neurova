import { configureStore } from "@reduxjs/toolkit";
import messageReducer, { addMessage, addOptimisticMessage, confirmMessage, failMessage, updateMessageStatus, setDecryptedText } from "@/store/slices/message.slice";
import { Message } from "@/types/api.types";

const makeStore = () => configureStore({ reducer: { messages: messageReducer } });
const makeMessage = (overrides: Partial<Message> = {}): Message => ({
    _id: "msg-1", conversationId: "conv-1", senderId: "user-1",
    encryptedText: "encrypted", iv: "iv", type: "text", status: "sent",
    readBy: [], isDeleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides,
});

describe("message.slice", () => {
    it("adds message to conversation", () => {
        const store = makeStore();
        store.dispatch(addMessage(makeMessage()));
        expect(store.getState().messages.byConversation["conv-1"]).toHaveLength(1);
    });

    it("prevents duplicate messages", () => {
        const store = makeStore();
        const msg = makeMessage();
        store.dispatch(addMessage(msg));
        store.dispatch(addMessage(msg));
        expect(store.getState().messages.byConversation["conv-1"]).toHaveLength(1);
    });

    it("marks optimistic messages as pending", () => {
        const store = makeStore();
        store.dispatch(addOptimisticMessage(makeMessage({ _id: "temp_123" })));
        expect(store.getState().messages.byConversation["conv-1"][0].isPending).toBe(true);
    });

    it("replaces optimistic with confirmed message", () => {
        const store = makeStore();
        store.dispatch(addOptimisticMessage(makeMessage({ _id: "temp_123" })));
        store.dispatch(confirmMessage({ tempId: "temp_123", message: makeMessage({ _id: "real-id" }) }));
        expect(store.getState().messages.byConversation["conv-1"][0]._id).toBe("real-id");
    });

    it("marks message as failed", () => {
        const store = makeStore();
        store.dispatch(addOptimisticMessage(makeMessage({ _id: "temp_123" })));
        store.dispatch(failMessage({ tempId: "temp_123", conversationId: "conv-1" }));
        expect(store.getState().messages.byConversation["conv-1"][0].isFailed).toBe(true);
    });

    it("updates message status", () => {
        const store = makeStore();
        store.dispatch(addMessage(makeMessage({ status: "sent" })));
        store.dispatch(updateMessageStatus({ messageId: "msg-1", conversationId: "conv-1", status: "read" }));
        expect(store.getState().messages.byConversation["conv-1"][0].status).toBe("read");
    });

    it("sets decrypted text", () => {
        const store = makeStore();
        store.dispatch(addMessage(makeMessage()));
        store.dispatch(setDecryptedText({ messageId: "msg-1", conversationId: "conv-1", text: "Hello!" }));
        expect(store.getState().messages.byConversation["conv-1"][0].decryptedText).toBe("Hello!");
    });
});
