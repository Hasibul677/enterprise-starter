import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the repository so validateMenuHierarchy's DB reads are stubbed -
// this lets us test the hierarchy validation logic (requirement #14/#62)
// without a live MongoDB connection.
const mockFindById = vi.fn();
vi.mock("@/repositories/menu.repository", () => ({
  menuRepository: {
    findById: (id: string) => mockFindById(id),
  },
}));

const { validateMenuHierarchy } = await import("@/lib/menu/menu-service");
const { ValidationError, NotFoundError } = await import("@/lib/errors/app-error");

describe("validateMenuHierarchy (3-level hierarchy validation, requirement #14/#62)", () => {
  beforeEach(() => {
    mockFindById.mockReset();
  });

  it("assigns level 1 to a menu with no parent", async () => {
    const result = await validateMenuHierarchy({ parentId: null });
    expect(result.level).toBe(1);
  });

  it("assigns parent.level + 1 to a menu with a valid level-1 parent", async () => {
    mockFindById.mockResolvedValue({ _id: "parent-1", level: 1, parentId: null });
    const result = await validateMenuHierarchy({ parentId: "parent-1" });
    expect(result.level).toBe(2);
  });

  it("rejects nesting past the maximum depth (a 4th level)", async () => {
    mockFindById.mockResolvedValue({ _id: "parent-3", level: 3, parentId: "parent-2" });
    await expect(validateMenuHierarchy({ parentId: "parent-3" })).rejects.toThrow(ValidationError);
  });

  it("rejects a menu being set as its own parent (self-parenting)", async () => {
    await expect(validateMenuHierarchy({ menuId: "menu-1", parentId: "menu-1" })).rejects.toThrow(ValidationError);
  });

  it("rejects a parent that does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    await expect(validateMenuHierarchy({ parentId: "does-not-exist" })).rejects.toThrow(NotFoundError);
  });

  it("rejects a circular hierarchy (proposed parent is a descendant of the menu being edited)", async () => {
    // menu-A (editing) -> would become parent of menu-B (proposed parentId)
    // but menu-B's chain walks back up to menu-A, which is a cycle.
    mockFindById.mockImplementation(async (id: string) => {
      if (id === "menu-B") return { _id: "menu-B", level: 2, parentId: "menu-A" };
      if (id === "menu-A") return { _id: "menu-A", level: 1, parentId: null };
      return null;
    });
    await expect(validateMenuHierarchy({ menuId: "menu-A", parentId: "menu-B" })).rejects.toThrow(ValidationError);
  });
});
