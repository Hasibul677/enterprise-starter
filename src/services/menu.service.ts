import { menuRepository } from "@/repositories/menu.repository";
import { userRepository } from "@/repositories/user.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { validateMenuHierarchy } from "@/lib/menu/menu-service";
import { NotFoundError, ConflictError } from "@/lib/errors/app-error";
import type { MenuCreateInput } from "@/features/menus/schemas/menu-create.schema";
import type { MenuUpdateInput } from "@/features/menus/schemas/menu-update.schema";
import type { MenuDocument } from "@/models/menu.model";

export async function createMenu(input: MenuCreateInput, actorUserId: string) {
  const { level } = await validateMenuHierarchy({ parentId: input.parentId ?? null });

  const menu = await menuRepository.create({
    ...input,
    level,
    createdBy: actorUserId,
  } as unknown as Partial<MenuDocument>).catch((err) => {
    if (err?.code === 11000) throw new ConflictError("A menu with this key or slug already exists.");
    throw err;
  });

  await auditLogRepository.record({
    actorUserId,
    action: "MENU_CREATED",
    entityType: "Menu",
    entityId: String(menu._id),
  });

  return menu;
}

export async function updateMenu(menuId: string, input: MenuUpdateInput, actorUserId: string) {
  const existing = await menuRepository.findById(menuId);
  if (!existing) throw new NotFoundError("Menu not found.");

  let level = existing.level;
  if (input.parentId !== undefined) {
    const result = await validateMenuHierarchy({ menuId, parentId: input.parentId });
    level = result.level;
  }

  const updated = await menuRepository.updateById(menuId, {
    ...input,
    level,
    updatedBy: actorUserId,
  } as unknown as Partial<MenuDocument>);

  // A menu's visibility depends on isActive/scope/resourceKey for every
  // user in the app (see buildEffectiveMenuTree()), not just one role - bump
  // everyone's permissionVersion so an already-open tab detects the change
  // (see use-permission-sync.ts). Broad on purpose: menu edits are rare
  // admin actions, and an unaffected user's next refresh is just a harmless
  // no-op since it's still scoped correctly per-user server-side.
  if (input.isActive !== undefined || input.scope !== undefined || input.resourceKey !== undefined) {
    await userRepository.incrementPermissionVersionForAll();
  }

  await auditLogRepository.record({
    actorUserId,
    action: "MENU_UPDATED",
    entityType: "Menu",
    entityId: menuId,
  });

  return updated;
}

export async function deactivateMenu(menuId: string, actorUserId: string) {
  const existing = await menuRepository.findById(menuId);
  if (!existing) throw new NotFoundError("Menu not found.");

  const updated = await menuRepository.deactivateById(menuId);
  await userRepository.incrementPermissionVersionForAll();

  await auditLogRepository.record({
    actorUserId,
    action: "MENU_DEACTIVATED",
    entityType: "Menu",
    entityId: menuId,
  });

  return updated;
}

export async function listMenus() {
  return menuRepository.list();
}
