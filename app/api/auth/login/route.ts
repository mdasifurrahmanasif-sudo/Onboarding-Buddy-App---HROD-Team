import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deriveSyntheticEmail, MIN_PASSWORD_LENGTH } from "@/lib/auth/credentials";
import { getPeopleDeskEmployee } from "@/lib/peopledesk";
import { refreshEmployeeFromPeopleDesk } from "@/lib/peopledesk-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";

async function syncTaskProvisioning(enrollNumber: string, sbu: string | null) {
  try {
    const admin = createAdminClient();
    const { data: variantsData } = await admin.from("onboarding_variants").select("*");
    const variants = (variantsData ?? []).map(mapOnboardingVariant);
    const homeVariant = resolveVariantForSbu(sbu, variants);
    const variantIds = homeVariant.isDefault
      ? [homeVariant.id]
      : [homeVariant.id, ...variants.filter((v) => v.isDefault).map((v) => v.id)];

    const { data: tasks } = await admin.from("onboarding_tasks").select("id").in("variant_id", variantIds);
    if (!tasks || tasks.length === 0) return;

    const { data: existing } = await admin
      .from("employee_task_status")
      .select("task_id")
      .eq("employee_enroll_number", enrollNumber);
    const existingIds = new Set((existing ?? []).map((r) => r.task_id));
    const missing = tasks.filter((t) => !existingIds.has(t.id));
    if (missing.length === 0) return;

    await admin.from("employee_task_status").insert(
      missing.map((t) => ({ employee_enroll_number: enrollNumber, task_id: t.id })),
    );
  } catch {
    // self-heals on the next login
  }
}

export async function POST(req: NextRequest) {
  let body: { enrollNumber?: string; password?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "অনুরোধটি সঠিকভাবে পড়া যায়নি। আবার চেষ্টা করুন।" }, { status: 400 });
  }

  const enrollNumberRaw = String(body?.enrollNumber ?? "").trim();
  const passwordRaw = String(body?.password ?? "");

  if (!enrollNumberRaw || !passwordRaw) {
    return NextResponse.json({ ok: false, error: "এনরোল নম্বর ও পাসওয়ার্ড দিতে হবে।" }, { status: 400 });
  }
  if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ ok: false, error: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে।` }, { status: 400 });
  }

  const { email, enrollNumber } = deriveSyntheticEmail(enrollNumberRaw);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let signInError: { message: string } | null = null;
  try {
    ({ error: signInError } = await supabase.auth.signInWithPassword({ email, password: passwordRaw }));
  } catch (err) {
    signInError = { message: err instanceof Error ? err.message : "network error" };
  }

  if (signInError) {
    let peopleDeskEmployee;
    try {
      peopleDeskEmployee = await getPeopleDeskEmployee(enrollNumber);
    } catch {
      return NextResponse.json({ ok: false, error: "PeopleDesk থেকে তথ্য আনা যায়নি। একটু পর আবার চেষ্টা করুন।" }, { status: 502 });
    }

    if (!peopleDeskEmployee) {
      return NextResponse.json({ ok: false, error: "এই এনরোল নম্বর PeopleDesk-এ নিবন্ধিত নেই।" }, { status: 401 });
    }

    let signUpError: { message: string } | null = null;
    try {
      ({ error: signUpError } = await supabase.auth.signUp({ email, password: passwordRaw }));
    } catch (err) {
      signUpError = { message: err instanceof Error ? err.message : "network error" };
    }

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already registered")) {
        return NextResponse.json({ ok: false, error: "পাসওয়ার্ড ভুল হয়েছে।" }, { status: 401 });
      }
      return NextResponse.json({ ok: false, error: "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।" }, { status: 500 });
    }

    let userId: string | undefined;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData.user?.id;
    } catch {
      userId = undefined;
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।" }, { status: 500 });
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: userId, enroll_number: enrollNumber, full_name: peopleDeskEmployee.name });
    if (profileError) {
      return NextResponse.json({ ok: false, error: "প্রোফাইল তৈরি করা যায়নি। একটু পর আবার চেষ্টা করুন।" }, { status: 500 });
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
      return NextResponse.json({ ok: false, error: "প্রোফাইল তৈরি করা যায়নি। একটু পর আবার চেষ্টা করুন।" }, { status: 500 });
    }

    await syncTaskProvisioning(enrollNumber, peopleDeskEmployee.sbu);
  } else {
    const sbu = await refreshEmployeeFromPeopleDesk(enrollNumber);
    await syncTaskProvisioning(enrollNumber, sbu);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    return NextResponse.json({ ok: false, error: "লগইন করা যায়নি। একটু পর আবার চেষ্টা করুন।" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      token_type: session.token_type ?? "bearer",
    },
  });
}
