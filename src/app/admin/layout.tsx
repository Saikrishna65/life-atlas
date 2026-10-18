import { ReactNode } from "react";
import AdminMobileGuard from "@/components/admin/AdminMobileGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminMobileGuard>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </AdminMobileGuard>
  );
}
