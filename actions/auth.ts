"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { deriveSyntheticEmail, MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";
import { getPeopleDeskEmployee } from "@/lib/peopledesk";
import { refreshEmployeeFromPeopleDesk } from "@/lib/peopledesk-sync";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";

/**
 * Ensures an employee has an employee_task_status row for every task in
 * their current onboarding variant(s). Self-healing: covers first-time
 * signup, and also re-syncs an existing account whose sbu was reassigned
 * after their initial signup (variant membership can change; task rows
 * from signup time don't update themselves otherwise).
 */
async function syncTaskProvisioning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollNumber: string,
  sbu: string | null,
) {
  const { data: variantsData } = await supabase.from("onboarding_variants").select("*");
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const homeVariant = resolveVariantForSbu(sbu, variants);
  const variantIds = homeVariant.isDefault
    ? [homeVariant.id]
    : [homeVariant.id, ...variants.filter((v) => v.isDefault).map((v) => v.id)];

  const { data: tasks } = await supabase.from("onboarding_tasks").select("id").in("variant_id", variantIds);
  if (!tasks || tasks.length === 0) return;

  const { data: existing } = await supabase
    .from("employee_task_status")
    .select("task_id")
    .eq("employee_enroll_number", enrollNumber);
  const existingIds = new Set((existing ?? []).map((r) => r.task_id));
  const missing = tasks.filter((t) => !existingIds.has(t.id));
  if (missing.length === 0) return;

  await supabase.from("employee_task_status").insert(
    missing.map((t) => ({ employee_enroll_number: enrollNumber, task_id: t.id })),
  );
}

async function siteOrigin() {
  // Always derive from the actual request, never an env var override — this
  // app has moved hosts more than once (Vercel, then ibos), and a stale
  // NEXT_PUBLIC_SITE_URL sent Google OAuth back to a now-paused deployment
  // instead of wherever the app is actually being served from.
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/**
 * Starts Google OAuth for login. Only useful for accounts that already linked
 * a Google identity via `linkGoogleAccount` below — a fresh, unlinked Google
 * sign-in has no way to know which enroll number it belongs to (the app's
 * synthetic email scheme means the account's real email is never on record
 * as its auth email), so the callback route rejects those.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google_start_failed");
  redirect(data.url);
}

/** Links a Google identity to the currently signed-in (enroll-number) account. */
export async function linkGoogleAccount() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback?linked=1` },
  });
  if (error || !data.url) redirect("/profile?error=google_link_failed");
  redirect(data.url);
}

export interface LoginState {
  error?: string;
}

export async function loginOrCreateProfile(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const enrollNumberRaw = String(formData.get("enrollNumber") ?? "").trim();
  const passwordRaw = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!enrollNumberRaw || !passwordRaw) {
    return { error: "এনরোল নম্বর ও পাসওয়ার্ড দিতে হবে।" };
  }
  if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
    return { error: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে।` };
  }

  const { email, enrollNumber } = deriveSyntheticEmail(enrollNumberRaw);
  const supabase = await createClient({ remember });

  // Fast path: an existing account with the correct password never touches
  // PeopleDesk — logins stay quick and don't depend on that API's uptime.
  // Network blips can make auth-js THROW (AuthRetryableFetchError) instead of
  // returning an error — catch it so a flaky connection shows a friendly
  // message instead of a blank 500.
  let signInError: { message: string } | null = null;
  try {
    ({ error: signInError } = await supabase.auth.signInWithPassword({ email, password: passwordRaw }));
  } catch (err) {
    signInError = { message: err instanceof Error ? err.message : "network error" };
  }

  if (signInError) {
    // Could be (a) a brand-new enroll number (first-time setup) or (b) an
    // existing account with the wrong password. Only PeopleDesk tells us which:
    // if it isn't registered there at all, this can never be a valid account.
    let peopleDeskEmployee;
    try {
      peopleDeskEmployee = await getPeopleDeskEmployee(enrollNumber);
    } catch {
      return { error: "PeopleDesk থেকে তথ্য আনা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    }

    if (!peopleDeskEmployee) {
      return { error: "এই এনরোল নম্বর PeopleDesk-এ নিবন্ধিত নেই।" };
    }

    let signUpError: { message: string } | null = null;
    try {
      ({ error: signUpError } = await supabase.auth.signUp({ email, password: passwordRaw }));
    } catch (err) {
      signUpError = { message: err instanceof Error ? err.message : "network error" };
    }

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already registered")) {
        return { error: "পাসওয়ার্ড ভুল হয়েছে।" };
      }
      return { error: "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    }

    // New account: provision profile, employee record (from PeopleDesk, not
    // typed input), and the 50-task checklist.
    let userId: string | undefined;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData.user?.id;
    } catch {
      userId = undefined;
    }
    if (!userId) {
      return { error: "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: userId, enroll_number: enrollNumber, full_name: peopleDeskEmployee.name });
    if (profileError) {
      return { error: "প্রোফাইল তৈরি করা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    }

    const { error: employeeError } = await supabase.from("employees").insert({
      enroll_number: enrollNumber,
      name: peopleDeskEmployee.name,
      sbu: peopleDeskEmployee.sbu,
      department: peopleDeskEmployee.department,
      designation: peopleDeskEmployee.designation,
      joining_date: peopleDeskEmployee.joiningDate,
      reporting_manager: peopleDeskEmployee.reportingManager,
      reporting_manager_phone: peopleDeskEmployee.reportingManagerPhone,
      reporting_manager_email: peopleDeskEmployee.reportingManagerEmail,
      email: peopleDeskEmployee.email,
      profile_id: userId,
    });
    if (employeeError) {
      return { error: "প্রোফাইল তৈরি করা যায়নি। একটু পর আবার চেষ্টা করুন।" };
    }

    // Provisioned for this employee's own onboarding variant (resolved from
    // their PeopleDesk sbu). If that variant isn't the default one, they
    // also run the normal/default onboarding alongside it (see
    // /select-onboarding) and need status rows for both task sets — a
    // default-variant employee only ever gets the one.
    try {
      await syncTaskProvisioning(supabase, enrollNumber, peopleDeskEmployee.sbu);
    } catch {
      // Provisioning is self-healing on the next login; a failed sync here
      // must not block the login itself.
    }
  } else {
    // Existing account, fast path: re-sync in case their sbu was reassigned
    // (e.g. moved to a different variant) since their last provisioning —
    // otherwise they'd be stuck with a stale/wrong task set forever.
    // Also pull the latest PeopleDesk data (manager, department, ...) so
    // changes made there since the last login show up here.
    try {
      const sbu = await refreshEmployeeFromPeopleDesk(enrollNumber);
      await syncTaskProvisioning(supabase, enrollNumber, sbu);
    } catch {
      // Same as above — never let a sync failure block login.
    }
  }

  redirect("/home");
}
