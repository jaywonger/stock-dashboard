import { ScreenerConfig } from "../screener/ScreenerConfig";

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  return (
    <aside className={`${collapsed ? "hidden" : "flex"} h-full w-[240px] flex-col p-3`}>
      <div className="min-h-0 flex-1">
        <ScreenerConfig collapsed={collapsed} />
      </div>
    </aside>
  );
}
