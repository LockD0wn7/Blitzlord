import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StorageRecord = Record<string, string>;

type MockSocket = {
  auth: { token?: string; playerName?: string };
  connected: boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
};

const ioMock = vi.fn((urlOrOptions?: unknown, maybeOptions?: unknown) => {
  const options =
    typeof urlOrOptions === "string"
      ? (maybeOptions as { auth?: MockSocket["auth"] } | undefined)
      : (urlOrOptions as { auth?: MockSocket["auth"] } | undefined);

  const socket: MockSocket = {
    auth: options?.auth ?? {},
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  return socket;
});

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
const originalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);

function createStorageMock(seed: StorageRecord = {}): Storage {
  const store: StorageRecord = { ...seed };

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
    getItem(key) {
      return store[key] ?? null;
    },
    key(index) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key) {
      delete store[key];
    },
    setItem(key, value) {
      store[key] = value;
    },
  };
}

describe("socket token generation", () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockClear();

    Object.defineProperty(globalThis, "localStorage", {
      value: createStorageMock({ playerName: "Test Player" }),
      configurable: true,
    });

    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues(array: Uint8Array) {
          for (let index = 0; index < array.length; index += 1) {
            array[index] = index + 1;
          }
          return array;
        },
      } as unknown as Crypto,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalCrypto) {
      Object.defineProperty(globalThis, "crypto", originalCrypto);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }

    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("creates and stores a player id when randomUUID is unavailable", async () => {
    const { getSocket } = await import("./index");

    const socket = getSocket();
    const token = localStorage.getItem("playerId");

    expect(token).toBeTruthy();
    expect(socket.auth).toMatchObject({
      token,
      playerName: "Test Player",
    });
    expect(ioMock).toHaveBeenCalledTimes(1);
  });
});
