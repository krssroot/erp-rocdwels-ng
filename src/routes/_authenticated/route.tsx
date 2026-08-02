import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderKanban, FileSpreadsheet, Layers, ClipboardList,
  Truck, ShoppingCart, FileText, Users, ClipboardCheck, GitBranch, Flag,
  Contact as ContactIcon, Bell, Trash2, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { userId: data.session.user.id };
  },
  component: AuthedLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: any;
  allowedRoles: AppRole[];
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allowedRoles: ["admin", "project_manager", "site_manager", "accountant", "procurement_officer"] },
  { to: "/projects", label: "Projects", icon: FolderKanban, allowedRoles: ["admin", "project_manager", "site_manager"] },
  { to: "/cost-sheets", label: "Job Cost Sheets", icon: FileSpreadsheet, allowedRoles: ["admin", "project_manager", "accountant"] },
  { to: "/cost-codes", label: "Cost Codes", icon: Layers, allowedRoles: ["admin", "accountant"] },
  { to: "/requisitions", label: "Requisitions", icon: ClipboardList, allowedRoles: ["admin", "project_manager", "site_manager", "procurement_officer"] },
  { to: "/suppliers", label: "Suppliers", icon: Truck, allowedRoles: ["admin", "accountant", "procurement_officer"] },
  { to: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, allowedRoles: ["admin", "procurement_officer"] },
  { to: "/documents", label: "Documents", icon: FileText, allowedRoles: ["admin", "project_manager", "site_manager", "accountant"] },
  { to: "/site-reports", label: "Daily Site Reports", icon: ClipboardCheck, allowedRoles: ["admin", "site_manager"] },
  { to: "/milestones", label: "Milestones", icon: Flag, allowedRoles: ["admin", "project_manager"] },
  { to: "/staff", label: "Staff", icon: Users, allowedRoles: ["admin"] },
  { to: "/contacts", label: "Contacts", icon: ContactIcon, allowedRoles: ["admin", "project_manager"] },
  { to: "/variations", label: "Variation Orders", icon: GitBranch, allowedRoles: ["admin", "project_manager"] },
  { to: "/notifications", label: "Notifications", icon: Bell, allowedRoles: ["admin", "project_manager", "site_manager", "accountant", "procurement_officer"] },
  { to: "/recently-deleted", label: "Recently Deleted", icon: Trash2, allowedRoles: ["admin"] },
];

function AuthedLayout() {
  const { user, roles, primaryRole } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/auth", replace: true });
  }

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  // Filter navigation items based on user roles
  const visibleNav = NAV.filter((item) =>
    item.allowedRoles.some((role) => roles.includes(role))
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">R</div>
              <div className="min-w-0">
                <div className="font-semibold truncate">Rocdwels</div>
                <div className="text-xs text-sidebar-foreground/70 truncate">Nigeria Ltd</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNav.map((n) => (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={pathname === n.to || pathname.startsWith(n.to + "/")}>
                        <Link to={n.to}>
                          <n.icon className="h-4 w-4" />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-3 text-xs text-sidebar-foreground/60">
            © {new Date().getFullYear()} Rocdwels
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b flex items-center justify-between px-4 gap-3 bg-card">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="font-medium text-sm text-muted-foreground">
                Rocdwels Nigeria Ltd · Construction ERP
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlobalSearch />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                      {initials}
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm leading-none">{user?.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {primaryRole ? ROLE_LABELS[primaryRole] : "No role"}
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(", ") : "No role assigned"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
