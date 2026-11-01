import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPeopleDeskEmployee } from "@/lib/peopledesk";

const REFRESH_TIMEOUT_MS = 4000;

/**
 * Re-pulls an existing employee's PeopleDesk-sourced fields (manager, SBU,
 * department, designation, ...) into the employees table, so changes made in
 * PeopleDesk after the account was first provisioned show up in the portal.
 *
 * Best-effort: never throws and never blocks a login — a PeopleDesk outage, a
 * timeout, or an unknown employee simply leaves the stored row as it was.
 * Only PeopleDesk-owned columns are written; HR-managed fields (buddy, team,
 * section) are left alone. Returns the employee's current sbu (refreshed if
 * possible, otherwise as stored) for task provisioning.
 */
export async function refreshEmployeeFromPeopleDesk(enrollNumber: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("employees")
    .select("name, sbu, department, designation, joining_date, reporting_manager, reporting_manager_phone, reporting_manager_email, email")
    .eq("enroll_number", enrollNumber)
    .maybeSingle();
  if (!current) return null;

  try {
    const pd = await getPeopleDeskEmployee(enrollNumber, REFRESH_TIMEOUT_MS);
    if (!pd) return current.sbu;

    const next = {
      name: pd.name,
      sbu: pd.sbu,
      department: pd.department,
      designation: pd.designation,
      joining_date: pd.joiningDate,
      reporting_manager: pd.reportingManager,
      reporting_manager_phone: pd.reportingManagerPhone,
      reporting_manager_email: pd.reportingManagerEmail,
      email: pd.email,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== current[k]);
    if (!changed) return current.sbu;

    const { error } = await admin.from("employees").update(next).eq("enroll_number", enrollNumber);
    return error ? current.sbu : next.sbu;
  } catch {
    return current.sbu;
  }
}
