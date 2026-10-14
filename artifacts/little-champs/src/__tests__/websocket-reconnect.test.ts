// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient } from "@/lib/queryClient";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.onclose?.();
  }
}

describe("family WebSocket lifecycle", () => {
  const originalWebSocket = globalThis.WebSocket;
  let refetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);
  });

  afterEach(() => {
    refetch.mockRestore();
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("does not refetch everything on first connect or reconnect after unmount", () => {
    const { unmount } = renderHook(() => useWebSocket("family"));
    const socket = FakeWebSocket.instances[0];
    act(() => socket.onopen?.());
    expect(socket.sent).toHaveLength(1);
    expect(refetch).not.toHaveBeenCalled();

    unmount();
    act(() => vi.advanceTimersByTime(4000));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconciles once after a genuine disconnect", () => {
    const { unmount } = renderHook(() => useWebSocket("family"));
    act(() => FakeWebSocket.instances[0].close());
    act(() => vi.advanceTimersByTime(3000));
    expect(FakeWebSocket.instances).toHaveLength(2);
    act(() => FakeWebSocket.instances[1].onopen?.());
    expect(refetch).toHaveBeenCalledOnce();
    unmount();
  });

  it("does not revive a socket for the previous family", () => {
    const { rerender, unmount } = renderHook(
      ({ family }) => useWebSocket(family),
      { initialProps: { family: "old" } },
    );
    const oldSocket = FakeWebSocket.instances[0];
    rerender({ family: "new" });
    expect(FakeWebSocket.instances).toHaveLength(2);
    act(() => oldSocket.onopen?.());
    expect(oldSocket.sent).toHaveLength(0);
    act(() => vi.advanceTimersByTime(4000));
    expect(FakeWebSocket.instances).toHaveLength(2);
    unmount();
  });
});