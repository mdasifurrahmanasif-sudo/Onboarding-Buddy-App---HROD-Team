import { redirect } from "next/navigation";

// shortcut: no dashboard yet (Phase 3), so the admin home is the People list.
export default function AdminHome() {
  redirect("/admin/people");
}
