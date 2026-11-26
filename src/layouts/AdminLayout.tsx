import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import SEO from "@/components/SEO";

const AdminLayout = () => {
  return (
    <SidebarProvider>
      <SEO title="Admin" noIndex />
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-3 sm:px-4 gap-3 sticky top-0 bg-background z-30">
            <SidebarTrigger />
            <span className="font-heading font-bold text-base sm:text-lg text-foreground truncate">
              TECH<span className="text-gradient">BRIDGE</span> Admin
            </span>
          </header>
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 overflow-auto min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
