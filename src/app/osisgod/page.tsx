import type { Metadata } from "next";
import { currentAdmin } from "@/lib/admin-auth";
import AdminLogin from "./admin-login";
import AdminDashboard from "./admin-dashboard";

export const metadata: Metadata = { title: "Admin — Pemilihan Ketua OSIS" };

export default async function AdminPage() {
  const loggedIn = (await currentAdmin()) !== null;
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      {loggedIn ? <AdminDashboard /> : <AdminLogin />}
    </main>
  );
}
