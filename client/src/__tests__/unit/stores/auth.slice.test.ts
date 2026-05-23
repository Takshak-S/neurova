import { configureStore } from "@reduxjs/toolkit";
import authReducer, { logout, updateUser, clearError } from "@/store/slices/auth.slice";

const makeStore = (preloaded?: { auth: ReturnType<typeof authReducer> }) =>
  configureStore({ reducer: { auth: authReducer }, preloadedState: preloaded });

describe("auth.slice", () => {
  it("clears user on logout", () => {
    const store = makeStore({ auth: { user: { id: "1", phone: "+91123" }, token: "tok", isAuthenticated: true, isNewUser: false, loading: false, error: null } });
    store.dispatch(logout());
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
  });

  it("merges user updates", () => {
    const store = makeStore({ auth: { user: { id: "1", phone: "+91123", name: "Old" }, token: "tok", isAuthenticated: true, isNewUser: false, loading: false, error: null } });
    store.dispatch(updateUser({ name: "New" }));
    expect(store.getState().auth.user?.name).toBe("New");
    expect(store.getState().auth.user?.phone).toBe("+91123");
  });

  it("clears error on clearError", () => {
    const store = makeStore({ auth: { user: null, token: null, isAuthenticated: false, isNewUser: false, loading: false, error: "Test error" } });
    store.dispatch(clearError());
    expect(store.getState().auth.error).toBeNull();
  });
});