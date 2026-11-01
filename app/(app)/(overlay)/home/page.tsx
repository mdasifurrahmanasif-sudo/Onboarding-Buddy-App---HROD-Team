import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Mascot } from "@/components/mascot/Mascot";
import { MilestoneCard, GrowthMilestoneCard } from "@/components/journey/MilestoneCard";
import { ContinueJourneyButton } from "@/components/journey/ContinueJourneyButton";
import { ViewWorkListButton } from "@/components/journey/ViewWorkListButton";
import { HrServicesGrid } from "@/components/journey/HrServicesGrid";
import { AssessmentCtaButton } from "@/components/journey/AssessmentCtaButton";
import { AssessmentListSection, type AssessmentListItem } from "@/components/journey/AssessmentListSection";
import { Icon } from "@/components/icons/Icon";
import {
  getAdminVariantId,
  getEmployee,
  getEmployeeAssessments,
  getEmployeeVariant,
  getHomeVariant,
  getIsHrAdmin,
  getMilestoneAssessments,
  getMyAssessmentScoresByJourney,
  getMySubmittedAssessmentJourneyIds,
  getPhasesForVariant,
  getProfile,
  getTaskStatuses,
  getTasks,
} from "@/lib/data/queries";
import { ONBOARDING_TRACK_COOKIE, isOnboardingTrack } from "@/lib/onboarding-track";
import { currentPhase, daysRemainingInPhase, growthReviewUnlocked, progressPercent } from "@/lib/business-rules";
import { PHASE_META, PHASE_META_BN, GROWTH_PHASE_META, GROWTH_PHASE_META_BN, type PhaseKey } from "@/lib/types";
import { bn } from "@/lib/bn";

export default async function HomePage() {
  // An employee whose home variant isn't the default (e.g. Akij Light
  // Engineering) runs two onboarding tracks side by side and must pick one
  // via /select-onboarding before reaching Home — re-asked every login
  // since signOut() clears this cookie. Lives here (not the shared (app)
  // layout) so /profile and /notifications stay reachable pre-selection —
  // e.g. the Profile button on /select-onboarding itself.
  const homeVariant = await getHomeVariant();
  if (!homeVariant.isDefault) {
    const cookieStore = await cookies();
    const track = cookieStore.get(ONBOARDING_TRACK_COOKIE)?.value;
    if (!isOnboardingTrack(track)) redirect("/select-onboarding");
  }

  const [
    { data: profile },
    { data: employee },
    { data: tasks },
    { data: statuses },
    { data: assessments },
    { data: milestoneAssessments },
    variant,
    isHrAdmin,
    adminVariantId,
  ] = await Promise.all([
    getProfile(),
    getEmployee(),
    getTasks(),
    getTaskStatuses(),
    getEmployeeAssessments(),
    getMilestoneAssessments(),
    getEmployeeVariant(),
    getIsHrAdmin(),
    getAdminVariantId(),
  ]);
  const isMirrorApp = variant.navMode === "resources";
  const phaseMeta = isMirrorApp ? PHASE_META_BN : PHASE_META;
  const growthMeta = isMirrorApp ? GROWTH_PHASE_META_BN : GROWTH_PHASE_META;
  const firstName = profile?.full_name?.trim().split(/\s+/).slice(0, 2).join(" ") ?? "";

  // Non-default variants (e.g. Light Engineering's Sales Onboarding) run
  // dynamic, HR-authored journeys instead of the fixed 30/60/90/180 —
  // see onboarding_phases. No Growth Review concept here (deferred).
  let pct: number;
  let completed: number;
  let total: number;
  let phaseTitle: string;
  let reminderText: string;
  let milestone: { key: string; title: string; sub: string; color: string; short: string; totalTasks: number; doneTasks: number } | null;
  let growthUnlocked = false;
  let phase: PhaseKey | "180" = "180";
  let hasJourneys = true;
  let assessmentCta: { state: "locked" | "ready" | "done"; journeyId: string; score: number | null } | null = null;
  let assessmentListItems: AssessmentListItem[] = [];

  if (!variant.isDefault) {
    const [{ data: journeys }, submittedJourneyIds, scoresByJourney] = await Promise.all([
      getPhasesForVariant(variant.id, { activeOnly: true }),
      getMySubmittedAssessmentJourneyIds(),
      getMyAssessmentScoresByJourney(),
    ]);
    hasJourneys = (journeys ?? []).length > 0;
    const activeTasks = (tasks ?? []).filter((t) => t.active);
    const doneTaskIds = new Set((statuses ?? []).filter((s) => s.done).map((s) => s.task_id));
    const doneByJourney = new Map((journeys ?? []).map((j) => [j.id, { done: 0, total: 0 }]));
    completed = 0;
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

    // A journey isn't "done" until its mandatory, one-time assessment is
    // also submitted — not just all tasks checked off.
    const currentJourney = (journeys ?? []).find((j) => {
      const counts = doneByJourney.get(j.id);
      if (!counts) return false;
      return counts.done < counts.total || !submittedJourneyIds.has(j.id);
    });

    if (currentJourney) {
      phase = currentJourney.id;
      const counts = doneByJourney.get(currentJourney.id)!;
      const tasksDone = counts.total > 0 && counts.done === counts.total;
      milestone = {
        key: currentJourney.id,
        title: currentJourney.name,
        sub: "",
        color: "#2CA24D",
        short: currentJourney.name.slice(0, 3).toUpperCase(),
        totalTasks: counts.total,
        doneTasks: counts.done,
      };
      phaseTitle = currentJourney.name;
      reminderText = tasksDone
        ? isMirrorApp
          ? `আপনার "${currentJourney.name}"-এর সব কাজ শেষ! এখন অ্যাসেসমেন্ট সম্পন্ন করুন।`
          : `All tasks in "${currentJourney.name}" are done! Please complete the assessment now.`
        : isMirrorApp
          ? `আপনার "${currentJourney.name}"-এর বাকি কাজ সম্পন্ন করুন।`
          : `Please complete your remaining tasks in "${currentJourney.name}".`;
    } else {
      phase = "";
      milestone = null;
      phaseTitle = isMirrorApp ? "সম্পন্ন" : "Complete";
      reminderText =
        (journeys ?? []).length === 0
          ? isMirrorApp
            ? "এখনো কোনো জার্নি যোগ করা হয়নি।"
            : "No journeys have been added yet."
          : isMirrorApp
            ? "অভিনন্দন! আপনি সব কাজ সম্পন্ন করেছেন।"
            : "Congratulations! You've completed all your tasks.";
    }

    // Assessment CTA tracks whichever journey is currently relevant — the
    // in-progress one, or (once everything's done) the last journey by
    // sequence, so the card never disappears the moment all tasks are done.
    const relevantJourney = currentJourney ?? (journeys ?? [])[(journeys ?? []).length - 1];
    if (relevantJourney) {
      const counts = doneByJourney.get(relevantJourney.id);
      const tasksDone = Boolean(counts && counts.total > 0 && counts.done === counts.total);
      const submitted = submittedJourneyIds.has(relevantJourney.id);
      assessmentCta = {
        state: !tasksDone ? "locked" : !submitted ? "ready" : "done",
        journeyId: relevantJourney.id,
        score: scoresByJourney.get(relevantJourney.id) ?? null,
      };
    }
  } else {
    const phaseById = new Map((tasks ?? []).map((t) => [t.id, t.phase as PhaseKey]));
    const doneByPhase: Record<PhaseKey, { done: number; total: number }> = {
      "30": { done: 0, total: 0 },
      "60": { done: 0, total: 0 },
      "90": { done: 0, total: 0 },
    };
    completed = 0;
    for (const s of statuses ?? []) {
      const p = phaseById.get(s.task_id);
      if (!p) continue;
      doneByPhase[p].total++;
      if (s.done) {
        doneByPhase[p].done++;
        completed++;
      }
    }

    total = tasks?.length ?? 50;
    pct = progressPercent(completed);
    phase = currentPhase(doneByPhase);

    const submittedByKey = new Map((assessments ?? []).map((a) => [a.assessment_key, Boolean(a.submitted_at)]));
    const milestoneSubmittedByKey = new Map(
      (milestoneAssessments ?? []).map((m) => [m.milestone, Boolean(m.submitted_at)]),
    );
    const fullySubmitted = (key: PhaseKey) => (submittedByKey.get(key) ?? false) && (milestoneSubmittedByKey.get(key) ?? false);
    growthUnlocked = growthReviewUnlocked(total > 0 && completed === total, {
      "30": fullySubmitted("30"),
      "60": fullySubmitted("60"),
      "90": fullySubmitted("90"),
    });

    assessmentListItems = (["30", "60", "90"] as const).map((key) => {
      const counts = doneByPhase[key];
      const tasksDone = counts.total > 0 && counts.done === counts.total;
      return {
        key,
        title: phaseMeta[key].title,
        state: !tasksDone ? "locked" : !fullySubmitted(key) ? "ready" : "done",
      };
    });

    milestone =
      phase === "180"
        ? null
        : { key: phase, ...phaseMeta[phase], totalTasks: doneByPhase[phase].total, doneTasks: doneByPhase[phase].done };
    phaseTitle = phase === "180" ? growthMeta.title : phaseMeta[phase].title;

    reminderText =
      phase === "180"
        ? isMirrorApp
          ? "অভিনন্দন! আপনি আপনার ৯০ দিনের checklist সম্পন্ন করেছেন। এবার আপনার ১৮০ দিনের Growth Review সম্পন্ন করুন।"
          : "Dear Employee, congratulations on finishing your 90-day checklist! Please complete your 180 Days Growth Review next."
        : (() => {
            const daysLeft = daysRemainingInPhase(phase, employee?.joining_date ?? null);
            return isMirrorApp
              ? `আপনার বাকি ${bn(Number(phase))} দিনের কাজ ${bn(daysLeft)} দিনের মধ্যে সম্পন্ন করুন।`
              : `Dear Employee, please complete your remaining ${phase} days task within ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
          })();
  }

  return (
    <div>
      {variant.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- variant logo path is DB-driven, not a static import next/image can optimize at build time
        <img src={variant.logoUrl} alt={variant.name} className="mb-5 mt-2 h-8 w-auto object-contain object-left" />
      )}

      <div className="mb-4 mt-0.5">
        <div className="font-en text-xl font-bold leading-tight text-text">
          আসসালামু আলাইকুম, <b>{firstName}</b>
        </div>
        <div className="mt-1 text-sm font-medium leading-snug text-muted">
          {variant.isDefault
            ? "আপনার প্রথম ১৮০ দিনের সম্পূর্ণ পথচলা শুরু হয়েছে।"
            : isMirrorApp
              ? "আপনার Sales Onboarding যাত্রা শুরু হয়েছে।"
              : "Your Sales Onboarding journey has begun."}
        </div>
      </div>

      <div className="mb-3 rounded-card border border-line bg-card p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <span className="font-en text-[15px] font-semibold text-text">
            {isMirrorApp ? "সামগ্রিক অনবোর্ডিং অগ্রগতি" : "Overall Onboarding Progress"}
          </span>
          <span className="font-en text-xl font-extrabold text-green-dark">{pct}%</span>
        </div>
        <div className="my-3 h-2.5 overflow-hidden rounded-lg bg-[#edeff2]">
          <div className="h-full rounded-lg bg-green transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[12.5px] font-medium text-muted">
          {isMirrorApp ? "বর্তমান পর্যায়" : "Current Phase"}: <b className="font-bold text-text">{phaseTitle}</b> ·{" "}
          <span>
            {isMirrorApp ? `${bn(completed)}/${bn(total)} কাজ` : `${completed}/${total} works`}
          </span>
        </div>
      </div>

      <div className="mb-3.5 flex items-start gap-2.5 rounded-card border border-[#f0d08a] bg-warn-bg p-3.5 shadow-card">
        <Icon name="bell" size={18} className="mt-0.5 shrink-0 text-warn-tx" />
        <p className="text-[13px] font-semibold leading-snug text-warn-tx">{reminderText}</p>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line bg-card p-3.5 px-4 shadow-card">
          <div className="font-en text-[22px] font-extrabold text-green-dark">{completed}</div>
          <div className="mt-0.5 text-xs font-semibold text-muted">{isMirrorApp ? "সম্পন্ন কাজ" : "Completed works"}</div>
        </div>
        <div className="rounded-card border border-line bg-card p-3.5 px-4 shadow-card">
          <div className="font-en text-[22px] font-extrabold text-warn-tx">{total - completed}</div>
          <div className="mt-0.5 text-xs font-semibold text-muted">{isMirrorApp ? "বাকি কাজ" : "Pending works"}</div>
        </div>
      </div>

      <div className="flex items-center gap-3.5 rounded-card border border-[#cde9d5] bg-green-light p-4 shadow-card">
        <div className="h-[58px] w-[58px] shrink-0">
          <Mascot variant="color" mood="happy" />
        </div>
        <div>
          <div className="mb-[3px] flex flex-wrap items-center gap-1.5 font-en text-[15px] font-extrabold text-green-dark">
            OnboardingBuddy{" "}
            <span className="whitespace-nowrap rounded-lg border border-[#cde9d5] bg-white px-1.5 py-0.5 font-en text-[9.5px] font-bold uppercase tracking-[0.04em] text-green-dark">
              {isMirrorApp ? "AI গাইড" : "AI Guide"}
            </span>
          </div>
          <p className="text-[12.5px] font-medium leading-snug text-text">
            আমি আপনাকে ধাপে ধাপে onboarding সম্পন্ন করতে সাহায্য করবো।
          </p>
        </div>
      </div>

      {phase !== "" && <ContinueJourneyButton currentPhase={phase} bn={isMirrorApp} />}
      <ViewWorkListButton variant="primary" bn={isMirrorApp} />
      {assessmentCta && (
        <AssessmentCtaButton
          state={assessmentCta.state}
          journeyId={assessmentCta.journeyId}
          score={assessmentCta.score}
          bn={isMirrorApp}
        />
      )}

      {isHrAdmin && (
        <div className="mt-3 flex gap-3">
          <Link
            href="/admin/tasks"
            className="flex-1 rounded-button bg-green px-4 py-3.5 text-center font-en text-sm font-bold text-white"
          >
            {isMirrorApp ? "+ টাস্ক যোগ করুন" : "+ Add Task"}
          </Link>
          <Link
            href="/admin/resources"
            className="flex-1 rounded-button bg-green px-4 py-3.5 text-center font-en text-sm font-bold text-white"
          >
            {isMirrorApp ? "+ রিসোর্স যোগ করুন" : "+ Add Resource"}
          </Link>
        </div>
      )}

      {isHrAdmin && isMirrorApp && (
        <Link
          href="/admin/notifications"
          className="mt-3 block rounded-button border border-line bg-card px-4 py-3.5 text-center font-en text-sm font-bold text-text"
        >
          নোটিফিকেশন পাঠান
        </Link>
      )}

      {variant.isDefault && <AssessmentListSection items={assessmentListItems} bn={isMirrorApp} />}

      <div className="mb-3 mt-[22px] font-en text-[15px] font-bold text-text">{isMirrorApp ? "HR সেবা" : "HR Services"}</div>
      <HrServicesGrid
        managerPhone={employee?.reporting_manager_phone}
        buddyPhone={employee?.buddy_phone}
        buddyAssigned={Boolean(employee?.buddy)}
        showEmployeesCard={Boolean(adminVariantId)}
        bn={isMirrorApp}
      />

      <div className="mb-3 mt-[22px] font-en text-[15px] font-bold text-text">
        {isMirrorApp ? "বর্তমান মাইলফলক" : "Current Milestone"}
      </div>
      {milestone ? (
        <MilestoneCard phase={milestone} bn={isMirrorApp} />
      ) : variant.isDefault ? (
        <GrowthMilestoneCard phase={{ key: "180", ...growthMeta, unlocked: growthUnlocked }} bn={isMirrorApp} />
      ) : (
        <div className="rounded-card border border-[#cde9d5] bg-[#fafdf9] p-4 text-center text-sm font-semibold text-green-dark shadow-card">
          {hasJourneys
            ? isMirrorApp
              ? "সব জার্নি সম্পন্ন!"
              : "All journeys complete!"
            : isMirrorApp
              ? "এখনো কোনো জার্নি যোগ করা হয়নি।"
              : "No journeys have been added yet."}
        </div>
      )}

      <p className="mt-8 text-center font-en text-xs font-medium text-muted">
        An Initiative of Akij Resource Human Capital Team
      </p>
    </div>
  );
}
