import { describe, expect, it } from "vitest";
import {
  formatDuplicateDisplayNames,
  stripDisplayName,
} from "@/lib/displayName";

describe("lib/displayName", () => {
  it("stripDisplayName은 suffix를 제거한다", () => {
    expect(stripDisplayName("player#abcd")).toBe("player");
  });

  it("중복되지 않은 이름은 그대로 유지한다", () => {
    expect(
      formatDuplicateDisplayNames(
        [{ name: "player#aaaa" }, { name: "guest#bbbb" }],
        (entry) => entry.name
      )
    ).toEqual(["player", "guest"]);
  });

  it("같은 표시 이름은 순서대로 번호를 붙인다", () => {
    expect(
      formatDuplicateDisplayNames(
        [
          { name: "player#aaaa" },
          { name: "player#bbbb" },
          { name: "guest#cccc" },
          { name: "player#dddd" },
        ],
        (entry) => entry.name
      )
    ).toEqual(["player (1)", "player (2)", "guest", "player (3)"]);
  });
});
