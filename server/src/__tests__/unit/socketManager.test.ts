import { socketManager } from "../../socket/socketManager";

// These tests verify the user-socket map logic in complete isolation.
// No Socket.IO server, no DB, no network — pure in-memory data structure tests.
// This is the most important data structure in the real-time layer,
// so we test every edge case: multiple devices, clean removal, online detection.

describe("socketManager — user-socket mapping", () => {
  // Reset the internal map between tests by removing all sockets we added.
  // We do this manually rather than mocking the module because we want to
  // test the real implementation, not a mock.
  afterEach(() => {
    // Remove all test sockets
    socketManager.removeSocket("user-1", "socket-1");
    socketManager.removeSocket("user-1", "socket-2");
    socketManager.removeSocket("user-2", "socket-3");
    socketManager.removeSocket("user-3", "socket-4");
  });

  describe("addSocket / getSockets", () => {
    it("should register a socket for a user", () => {
      socketManager.addSocket("user-1", "socket-1");
      expect(socketManager.getSockets("user-1")).toContain("socket-1");
    });

    it("should register multiple sockets for the same user (multi-device)", () => {
      socketManager.addSocket("user-1", "socket-1");
      socketManager.addSocket("user-1", "socket-2");

      const sockets = socketManager.getSockets("user-1");
      expect(sockets).toContain("socket-1");
      expect(sockets).toContain("socket-2");
      expect(sockets).toHaveLength(2);
    });

    it("should register sockets for different users independently", () => {
      socketManager.addSocket("user-1", "socket-1");
      socketManager.addSocket("user-2", "socket-3");

      expect(socketManager.getSockets("user-1")).toContain("socket-1");
      expect(socketManager.getSockets("user-2")).toContain("socket-3");
      expect(socketManager.getSockets("user-1")).not.toContain("socket-3");
    });

    it("should return empty array for unknown users", () => {
      expect(socketManager.getSockets("nonexistent-user")).toEqual([]);
    });
  });

  describe("removeSocket", () => {
    it("should remove a specific socket without affecting other sockets", () => {
      socketManager.addSocket("user-1", "socket-1");
      socketManager.addSocket("user-1", "socket-2");

      socketManager.removeSocket("user-1", "socket-1");

      const sockets = socketManager.getSockets("user-1");
      expect(sockets).not.toContain("socket-1");
      expect(sockets).toContain("socket-2"); // other device still connected
    });

    it("should clean up the map entry when the last socket is removed", () => {
      socketManager.addSocket("user-1", "socket-1");
      socketManager.removeSocket("user-1", "socket-1");

      // User entry should be fully gone — no empty Set lingering
      expect(socketManager.getSockets("user-1")).toEqual([]);
      expect(socketManager.isOnline("user-1")).toBe(false);
    });

    it("should handle removing a socket that does not exist gracefully", () => {
      expect(() => {
        socketManager.removeSocket("nonexistent-user", "nonexistent-socket");
      }).not.toThrow();
    });
  });

  describe("isOnline", () => {
    it("should return true when a user has at least one socket", () => {
      socketManager.addSocket("user-1", "socket-1");
      expect(socketManager.isOnline("user-1")).toBe(true);
    });

    it("should return false when a user has no sockets", () => {
      expect(socketManager.isOnline("user-1")).toBe(false);
    });

    it("should return true with multiple sockets and false after all are removed", () => {
      socketManager.addSocket("user-1", "socket-1");
      socketManager.addSocket("user-1", "socket-2");

      expect(socketManager.isOnline("user-1")).toBe(true);

      socketManager.removeSocket("user-1", "socket-1");
      expect(socketManager.isOnline("user-1")).toBe(true); // still has socket-2

      socketManager.removeSocket("user-1", "socket-2");
      expect(socketManager.isOnline("user-1")).toBe(false); // now fully offline
    });
  });

  describe("getOnlineUsers", () => {
    it("should return all users with active sockets", () => {
      socketManager.addSocket("user-1", "socket-1");
      socketManager.addSocket("user-2", "socket-3");

      const online = socketManager.getOnlineUsers();
      expect(online).toContain("user-1");
      expect(online).toContain("user-2");
    });

    it("should not include users who have disconnected", () => {
      socketManager.addSocket("user-3", "socket-4");
      socketManager.removeSocket("user-3", "socket-4");

      const online = socketManager.getOnlineUsers();
      expect(online).not.toContain("user-3");
    });
  });
});