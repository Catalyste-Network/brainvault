import { renderHook, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useFavorites } from "./useFavorites";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
  };
});

const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetItem.mockResolvedValue(null);
});

describe("useFavorites", () => {
  it("starts with empty favorites when nothing is stored", () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite("res-1")).toBe(false);
  });

  it("loads stored favorites on mount", async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify(["res-a", "res-b"]));
    const { result } = renderHook(() => useFavorites());

    await act(async () => {});
    expect(result.current.favorites).toEqual(["res-a", "res-b"]);
    expect(result.current.isFavorite("res-a")).toBe(true);
    expect(result.current.isFavorite("res-c")).toBe(false);
  });

  it("adds a favorite and persists it", async () => {
    const { result } = renderHook(() => useFavorites());
    await act(async () => {
      await result.current.addFavorite("res-1");
    });
    expect(result.current.isFavorite("res-1")).toBe(true);
    expect(result.current.favorites).toContain("res-1");
    expect(mockedSetItem).toHaveBeenCalledWith(
      "@mindvault_favorites",
      JSON.stringify(["res-1"])
    );
  });

  it("does not add duplicate favorites", async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify(["res-1"]));
    const { result } = renderHook(() => useFavorites());
    await act(async () => {});
    await act(async () => {
      await result.current.addFavorite("res-1");
    });
    expect(result.current.favorites).toEqual(["res-1"]);
    expect(mockedSetItem).not.toHaveBeenCalled();
  });

  it("removes a favorite and persists it", async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify(["res-1", "res-2"]));
    const { result } = renderHook(() => useFavorites());
    await act(async () => {});
    await act(async () => {
      await result.current.removeFavorite("res-1");
    });
    expect(result.current.isFavorite("res-1")).toBe(false);
    expect(result.current.favorites).toEqual(["res-2"]);
    expect(mockedSetItem).toHaveBeenCalledWith(
      "@mindvault_favorites",
      JSON.stringify(["res-2"])
    );
  });

  it("toggles favorite on and off", async () => {
    const { result } = renderHook(() => useFavorites());
    await act(async () => {
      await result.current.toggleFavorite("res-1");
    });
    expect(result.current.isFavorite("res-1")).toBe(true);

    await act(async () => {
      await result.current.toggleFavorite("res-1");
    });
    expect(result.current.isFavorite("res-1")).toBe(false);
    expect(result.current.favorites).toEqual([]);
  });

  it("clears all favorites", async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify(["res-1", "res-2"]));
    const { result } = renderHook(() => useFavorites());
    await act(async () => {});
    await act(async () => {
      await result.current.clearFavorites();
    });
    expect(result.current.favorites).toEqual([]);
    expect(mockedSetItem).toHaveBeenCalledWith(
      "@mindvault_favorites",
      JSON.stringify([])
    );
  });
});
