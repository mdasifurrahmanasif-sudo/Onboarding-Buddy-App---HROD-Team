import Link from "next/link";
import { Icon, type IconName } from "@/components/icons/Icon";
import { createClient } from "@/lib/supabase/server";
import {
  getEmployee,
  getEmployeeVariant,
  getHomeVariant,
  getMySubmittedAssessmentJourneyIds,
  getPhasesForVariant,
  getProfile,
  getTaskStatuses,
  getTasks,
} from "@/lib/data/queries";
import { signOut } from "@/actions/sign-out";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { NotificationButton } from "@/components/pwa/PushPrompt";
import { linkGoogleAccount } from "@/actions/auth";
import { currentPhase, progressPercent } from "@/lib/business-rules";
import { PHASE_META, PHASE_META_BN, GROWTH_PHASE_META, GROWTH_PHASE_META_BN, type PhaseKey } from "@/lib/types";

interface BadgeDef {
  key: string;
  icon: IconName;
  name: string;
  got: boolean;
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const [{ data: profile }, { data: employee }, { data: tasks }, { data: statuses }, { data: badgeDefs }, { data: userData }, variant, homeVariant] =
    await Promise.all([
      getProfile(),
      getEmployee(),
      getTasks(),
      getTaskStatuses(),
      // Filtered below (after `variant` resolves) — see the `.filter` on badgeDefs.
      supabase.from("badges").select("*"),
      supabase.auth.getUser(),
      getEmployeeVariant(),
      getHomeVariant(),
    ]);
  const googleLinked = (userData.user?.identities ?? []).some((i) => i.provider === "google");
  const isBn = variant.navMode === "resources";
  const phaseMeta = isBn ? PHASE_META_BN : PHASE_META;
  const growthMeta = isBn ? GROWTH_PHASE_META_BN : GROWTH_PHASE_META;

  const doneTaskIds = new Set((statuses ?? []).filter((s) => s.done).map((s) => s.task_id));
  const taskByWorkNumber = new Map((tasks ?? []).map((t) => [t.work_number, t]));

  const isDone = (workNumber: number) => {
    const task = taskByWorkNumber.get(workNumber);
    return task ? doneTaskIds.has(task.id) : false;
  };

  let completed = 0;
  let total = 0;
  let pct = 0;
  let phaseLabel = "";
  // Lightweight computed-on-read badge unlock rules (BR-019 — motivational only, not persisted).
  // The first five badges are tied to specific default-variant work numbers
  // (e.g. work #1 = "first day ready") — meaningless against another
  // variant's own, differently-numbered task list, so they're only ever
  // computed for the default variant.
  const earnedByKey: Record<string, boolean> = {
    first_day_ready: variant.isDefault && isDone(1),
    system_access_hero: variant.isDefault && isDone(2),
    policy_learner: variant.isDefault && isDone(5),
    team_connector: variant.isDefault && isDone(3),
    kpi_starter: variant.isDefault && isDone(12),
    "30_days_champion": false,
    "60_days_contributor": false,
    "90_days_ready": false,
    "180_days_growth_ready": false,
  };

  if (variant.isDefault) {
    const phaseById = new Map((tasks ?? []).map((t) => [t.id, t.phase as PhaseKey]));
    const doneByPhase: Record<PhaseKey, { done: number; total: number }> = {
      "30": { done: 0, total: 0 },
      "60": { done: 0, total: 0 },
      "90": { done: 0, total: 0 },
    };
    for (const t of tasks ?? []) {
      const phase = phaseById.get(t.id);
      if (!phase) continue;
      doneByPhase[phase].total++;
      if (doneTaskIds.has(t.id)) {
        doneByPhase[phase].done++;
        completed++;
      }
    }
    total = tasks?.length ?? 50;
    pct = progressPercent(completed);
    const phase = currentPhase(doneByPhase);
    phaseLabel = phase === "180" ? growthMeta.title : phaseMeta[phase].title;
    earnedByKey["30_days_champion"] = doneByPhase["30"].total > 0 && doneByPhase["30"].done === doneByPhase["30"].total;
    earnedByKey["60_days_contributor"] = doneByPhase["60"].total > 0 && doneByPhase["60"].done === doneByPhase["60"].total;
    earnedByKey["90_days_ready"] = doneByPhase["90"].total > 0 && doneByPhase["90"].done === doneByPhase["90"].total;
    earnedByKey["180_days_growth_ready"] = completed === total && total > 0;
  } else {
    const [{ data: journeys }, submittedJourneyIds] = await Promise.all([
      getPhasesForVariant(variant.id, { activeOnly: true }),
      getMySubmittedAssessmentJourneyIds(),
    ]);
    const activeTasks = (tasks ?? []).filter((t) => t.active);
    const doneByJourney = new Map((journeys ?? []).map((j) => [j.id, { done: 0, total: 0 }]));
    for (const t of activeTasks) {
      const counts = doneByJourney.get(t.phase);
      if (!counts) continue;
      counts.total++;
      if (doneTaskIds.has(t.id)) {
        counts.done++;
        completed++;
      }
    }
    total = activeTasks.length;
    pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const currentJourney = (journeys ?? []).find((j) => {
      const counts = doneByJourney.get(j.id);
      if (!counts) return false;
      return counts.done < counts.total || !submittedJourneyIds.has(j.id);
    });
    phaseLabel = currentJourney?.name ?? (isBn ? "সম্পন্ন" : "Complete");
  }

  const badges: BadgeDef[] = (badgeDefs ?? [])
    .filter((b) => b.variant_id === variant.id)
    .map((b) => ({
    key: b.key,
    icon: b.icon as IconName,
    name: b.name,
    got: earnedByKey[b.key] ?? false,
  }));

  const name = profile?.full_name ?? "";
  const avatarLetter = name.trim().charAt(0).toUpperCase() || "?";
  const roleLine = [employee?.designation, employee?.department].filter(Boolean).join(" · ");

  const details: [string, string][] = isBn
    ? [
        ["নাম", name || "—"],
        ["এনরোল নম্বর", profile?.enroll_number ?? "—"],
        ["SBU", employee?.sbu ?? "—"],
        ["বিভাগ", employee?.department ?? "—"],
        ["পদবী", employee?.designation ?? "—"],
        ["জয়েনিং তারিখ", employee?.joining_date ?? "—"],
        ["রিপোর্টিং ম্যানেজার", employee?.reporting_manager ?? "—"],
        ["ম্যানেজার ফোন", employee?.reporting_manager_phone ?? "—"],
        ["ম্যানেজার ইমেইল", employee?.reporting_manager_email ?? "—"],
        ...(employee?.buddy
          ? ([
              ["বাডি", employee.buddy],
              ["বাডি ফোন", employee?.buddy_phone ?? "—"],
              ["বাডি ইমেইল", employee?.buddy_email ?? "—"],
            ] as [string, string][])
          : ([["বাডি", "আপনার ম্যানেজার শীঘ্রই বাডি নির্ধারণ করবেন"]] as [string, string][])),
        ["ইমেইল", employee?.email ?? "—"],
      ]
    : [
        ["Employee Name", name || "—"],
        ["Enroll Number", profile?.enroll_number ?? "—"],
        ["SBU", employee?.sbu ?? "—"],
        ["Department", employee?.department ?? "—"],
        ["Designation", employee?.designation ?? "—"],
        ["Joining Date", employee?.joining_date ?? "—"],
        ["Reporting Manager", employee?.reporting_manager ?? "—"],
        ["Manager Phone", employee?.reporting_manager_phone ?? "—"],
        ["Manager Email", employee?.reporting_manager_email ?? "—"],
        ...(employee?.buddy
          ? ([
              ["Buddy", employee.buddy],
              ["Buddy Phone", employee?.buddy_phone ?? "—"],
              ["Buddy Email", employee?.buddy_email ?? "—"],
            ] as [string, string][])
          : ([["Buddy", "Your Buddy will soon be assigned by your Manager"]] as [string, string][])),
        ["Email", employee?.email ?? "—"],
      ];

  return (
    <div>
      <div className="flex flex-col items-center px-0 pb-1 pt-2.5 text-center">
        <div className="mb-2.5 flex h-[82px] w-[82px] items-center justify-center rounded-full bg-green font-en text-3xl font-extrabold text-white">
          {avatarLetter}
        </div>
        <div className="font-en text-xl font-extrabold text-text">{name || "—"}</div>
        {roleLine && <div className="mt-0.5 text-[13px] font-medium text-muted">{roleLine}</div>}
      </div>

      <div className="my-[18px] grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <div className="font-en text-xl font-extrabold text-green-dark">
            {completed}/{total}
          </div>
          <div className="mt-[3px] text-xs font-semibold text-muted">{isBn ? "সম্পন্ন কাজ" : "Completed works"}</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <div className="font-en text-xl font-extrabold text-warn-tx">{total - completed}</div>
          <div className="mt-[3px] text-xs font-semibold text-muted">{isBn ? "বাকি কাজ" : "Pending works"}</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <div className="font-en text-xl font-extrabold text-blue-dark">{pct}%</div>
          <div className="mt-[3px] text-xs font-semibold text-muted">{isBn ? "১৮০-দিনের অগ্রগতি" : "180-day progress"}</div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <div className="font-en text-[15px] font-extrabold text-text">{phaseLabel}</div>
          <div className="mt-[3px] text-xs font-semibold text-muted">{isBn ? "বর্তমান পর্যায়" : "Current phase"}</div>
        </div>
      </div>

      <div className="mb-3 font-en text-[15px] font-bold text-text">{isBn ? "অনবোর্ডিং ব্যাজ" : "Onboarding Badges"}</div>
      <div className="mb-1 flex gap-2.5 overflow-x-auto pb-1.5">
        {badges.map((b) => (
          <div
            key={b.key}
            className={`w-24 shrink-0 rounded-2xl border border-line bg-card p-3.5 text-center shadow-card ${
              b.got ? "" : "opacity-50"
            }`}
          >
            <div
              className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full ${
                b.got ? "bg-green-light text-green-dark" : "bg-[#f0f1f3] text-[#9aa1ab]"
              }`}
            >
              <Icon name={b.icon} size={22} />
            </div>
            <div className="font-en text-[10.5px] font-semibold leading-[1.25] text-text">{b.name}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 mt-[22px] font-en text-[15px] font-bold text-text">{isBn ? "কর্মী বিবরণ" : "Employee Details"}</div>
      <div className="rounded-card border border-line bg-card px-4 shadow-card">
        {details.map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-3.5 py-3 ${
              i < details.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className="text-[13px] font-medium text-muted">{label}</span>
            <span className="font-en text-[13px] font-bold text-text">{value}</span>
          </div>
        ))}
      </div>

      <InstallAppButton bn={isBn} />
      <NotificationButton publicKey={process.env.VAPID_PUBLIC_KEY || null} bn={isBn} />

      {!googleLinked && (
        <form action={linkGoogleAccount} className="mt-5">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-button border border-line bg-card px-4 py-3.5 font-en text-sm font-bold text-text transition-transform active:scale-[0.98]"
          >
            <Icon name="paperclip" size={16} />
            {isBn ? "Google অ্যাকাউন্ট যুক্ত করুন" : "Link Google Account"}
          </button>
        </form>
      )}

      {!homeVariant.isDefault && (
        <Link
          href="/select-onboarding"
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-button border border-line bg-card px-4 py-3.5 font-en text-sm font-bold text-text transition-transform active:scale-[0.98]"
        >
          <Icon name="map" size={16} />
          {isBn ? "অনবোর্ডিং মডিউল পরিবর্তন করুন" : "Change Onboarding Module"}
        </Link>
      )}

      <form action={signOut} className="mt-5">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-button border border-[#f1b4b6] bg-err-bg px-4 py-3.5 font-en text-sm font-bold text-err-tx transition-transform active:scale-[0.98]"
        >
          <Icon name="logOut" size={16} />
          {isBn ? "সাইন আউট" : "Sign Out"}
        </button>
      </form>
    </div>
  );
}
