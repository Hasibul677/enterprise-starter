import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { Breadcrumb } from "./breadcrumb";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
      <div className="flex items-center gap-3">
        <MobileNav />
        <Breadcrumb />
      </div>
      <UserMenu />
    </header>
  );
}
