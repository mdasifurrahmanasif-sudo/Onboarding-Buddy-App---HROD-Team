import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOnboardingVariants, getPhasesForVariant, getTasksForVariant } from "@/lib/data/queries";
import { canSeeEmployee, getAdminAccess } from "@/lib/auth/admin";
import { mapOnboardingVariant, resolveVariantForSbu } from "@/lib/onboarding-variant";
import { createAdminClient } from "@/lib/supabase/admin";
import { Icon } from "@/components/icons/Icon";
import { BuddyAssignForm } from "@/components/team/BuddyAssignForm";
import { assignBuddyAsHrAdmin } from "@/actions/admin-employees";
import { progressPercent } from "@/lib/business-rules";
import type { PhaseKey } from "@/lib/types";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ enrollNumber: string }> }) {
  const { enrollNumber } = await params;
  const access = await getAdminAccess();
  if (!access) redirect("/home");

  // Service role: an HRBP has no RLS read on other employees; canSeeEmployee
  // below is the gate.
  const supabase = createAdminClient();
  const [{ data: employee }, { data: variantsData }] = await Promise.all([
    supabase.from("employees").select("*").eq("enroll_number", enrollNumber).single(),
    getOnboardingVariants(),
  ]);
  if (!employee) notFound();

  // Defense against a variant-scoped HR admin guessing another variant's
  // enroll number by URL — RLS alone would let this read through (is_hr_admin
  // grants company-wide SELECT), so this app-layer check is what actually
  // keeps variants apart here.
  const variants = (variantsData ?? []).map(mapOnboardingVariant);
  const employeeVariant = resolveVariantForSbu(employee.sbu, variants);
  if (!canSeeEmployee(access, employee, employeeVariant.id)) notFound();
  const isBn = employeeVariant.navMode === "resources";

  const [{ data: tasks }, { data: statuses }, { data: tickets }] = await Promise.all([
    getTasksForVariant(employeeVariant.id),
    supabase.from("employee_task_status").select("task_id, done").eq("employee_enroll_number", enrollNumber),
    supabase
      .from("help_requests")
      .select("ticket_id, issue_type, status, created_at")
      .eq("employee_enroll_number", enrollNumber)
      .order("created_at", { ascending: false }),
  ]);

  const doneTaskIds = new Set((statuses ?? []).filter((s) => s.done).map((s) => s.task_id));

  // Dynamic journeys (non-default variants) — no fixed 30/60/90 grid.
  const journeys = employeeVariant.isDefault
    ? null
    : (await getPhasesForVariant(employeeVariant.id, { activeOnly: true })).data;

  let completed = 0;
  let total = 0;
  let doneByPhase: Record<PhaseKey, { done: number; total: number }> = { "30": { done: 0, total: 0 }, "60": { done: 0, total: 0 }, "90": { done: 0, total: 0 } };
  let doneByJourney = new Map<string, { done: number; total: number }>();

  if (journeys) {
    const activeTasks = (tasks ?? []).filter((t) => t.active);
    doneByJourney = new Map(journeys.map((j) => [j.id, { done: 0, total: 0 }]));
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
  } else {
    const phaseById = new Map((tasks ?? []).map((t) => [t.id, t.phase as PhaseKey]));
    for (const t of tasks ?? []) {
      const phase = phaseById.get(t.id);
      if (!phase) continue;
      doneByPhase[phase].total++;
      if (doneTaskIds.has(t.id)) {
        doneByPhase[phase].done++;
        completed++;
      }
    }
    total = tasks?.length ?? 0;
  }
  const pct = journeys ? (total > 0 ? Math.round((completed / total) * 100) : 0) : progressPercent(completed);

  // Assessment review — dynamic-journey variants only, and only for
  // journeys this employee has actually submitted (answer key never
  // fetched via the authenticated client, same as everywhere else that
  // touches journey_assessment_questions — service-role client only).
  interface AnswerReview {
    questionText: string;
    type: "mcq" | "open";
    yourAnswer: string;
    correctAnswer?: string;
    correct: boolean;
    marks: number;
  }
  interface SubmissionReview {
    journeyName: string;
    score: number;
    submittedAt: string;
    answers: AnswerReview[];
  }
  let assessmentReviews: SubmissionReview[] = [];

  if (journeys && journeys.length > 0) {
    const admin = createAdminClient();
    const journeyIds = journeys.map((j) => j.id);
    const journeyNameById = new Map(journeys.map((j) => [j.id, j.name]));

    const { data: assessments } = await admin.from("journey_assessments").select("id, journey_id").in("journey_id", journeyIds);
    const assessmentIds = (assessments ?? []).map((a) => a.id);
    const journeyIdByAssessmentId = new Map((assessments ?? []).map((a) => [a.id, a.journey_id]));

    if (assessmentIds.length > 0) {
      const { data: submissions } = await admin
        .from("journey_assessment_submissions")
        .select("id, assessment_id, score, submitted_at")
        .eq("employee_enroll_number", enrollNumber)
        .in("assessment_id", assessmentIds);

      if (submissions && submissions.length > 0) {
        const submissionIds = submissions.map((s) => s.id);
        const [{ data: answers }, { data: questions }] = await Promise.all([
          admin
            .from("journey_assessment_answers")
            .select("submission_id, question_id, answer_text, selected_option_key, marks_awarded")
            .in("submission_id", submissionIds),
          admin
            .from("journey_assessment_questions")
            .select("id, question_text, type, options, correct_option_key")
            .in("assessment_id", assessmentIds),
        ]);
        const questionById = new Map((questions ?? []).map((q) => [q.id, q]));

        assessmentReviews = submissions.map((sub) => {
          const journeyId = journeyIdByAssessmentId.get(sub.assessment_id) ?? "";
          const subAnswers = (answers ?? []).filter((a) => a.submission_id === sub.id);
          return {
            journeyName: journeyNameById.get(journeyId) ?? "",
            score: Number(sub.score),
            submittedAt: sub.submitted_at,
            answers: subAnswers.map((a): AnswerReview => {
              const q = questionById.get(a.question_id);
              const options = (q?.options as { key: string; text: string }[] | null) ?? null;
              const yourAnswer =
                q?.type === "mcq"
                  ? (options?.find((o) => o.key === a.selected_option_key)?.text ?? a.selected_option_key ?? "")
                  : (a.answer_text ?? "");
              const correctAnswer =
                q?.type === "mcq" ? options?.find((o) => o.key === q.correct_option_key)?.text : undefined;
              return {
                questionText: q?.question_text ?? "",
                type: (q?.type as "mcq" | "open") ?? "mcq",
                yourAnswer,
                correctAnswer,
                correct: a.marks_awarded > 0,
                marks: a.marks_awarded,
              };
            }),
          };
        });
      }
    }
  }

  return (
    <div>
      <div className="mb-4 mt-0.5 flex items-center gap-3">
        <Link
          href={access.role === "journey_admin" ? "/employees" : "/admin/people"}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-bg text-text"
        >
          <Icon name="chevronLeft" size={18} />
        </Link>
        <div className="min-w-0">
          <div className="truncate font-en text-lg font-extrabold text-text">{employee.name}</div>
          <div className="truncate text-xs font-medium text-muted">
            {[employee.designation, employee.department].filter(Boolean).join(" · ") || employee.enroll_number}
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-card border border-line bg-card p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <span className="font-en text-[15px] font-semibold text-text">
            {isBn ? "অনবোর্ডিং অগ্রগতি" : "Onboarding Progress"}
          </span>
          <span className="font-en text-xl font-extrabold text-green-dark">{pct}%</span>
        </div>
        <div className="my-3 h-2.5 overflow-hidden rounded-lg bg-[#edeff2]">
          <div className="h-full rounded-lg bg-green transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className={`grid gap-2 text-center ${journeys ? "grid-cols-2" : "grid-cols-3"}`}>
          {journeys
            ? journeys.map((j) => {
                const counts = doneByJourney.get(j.id) ?? { done: 0, total: 0 };
                return (
                  <div key={j.id} className="rounded-xl bg-bg px-2 py-2.5">
                    <div className="font-en text-sm font-extrabold text-text">
                      {counts.done}/{counts.total}
                    </div>
                    <div className="mt-0.5 truncate text-[10.5px] font-semibold text-muted">{j.name}</div>
                  </div>
                );
              })
            : (["30", "60", "90"] as PhaseKey[]).map((phase) => (
                <div key={phase} className="rounded-xl bg-bg px-2 py-2.5">
                  <div className="font-en text-sm font-extrabold text-text">
                    {doneByPhase[phase].done}/{doneByPhase[phase].total}
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-semibold text-muted">
                    {isBn ? `${phase} দিন` : `${phase} Days`}
                  </div>
                </div>
              ))}
        </div>
        <div className="mt-2 text-[12.5px] font-medium text-muted">
          {isBn ? `মোট: ${completed}/${total} কাজ সম্পন্ন` : `Total: ${completed}/${total} works completed`}
        </div>
      </div>

      <div className="mb-3 mt-[22px] font-en text-[15px] font-bold text-text">
        {isBn ? "বাডি নির্ধারণ" : "Buddy Assignment"}
      </div>
      <div className="mb-4 rounded-card border border-line bg-card p-4 shadow-card">
        {employee.buddy && (
          <div className="mb-3 rounded-xl bg-green-light px-3.5 py-2.5 text-[12.5px] font-semibold text-green-dark">
            {isBn ? `বর্তমানে নির্ধারিত: ${employee.buddy}` : `Currently assigned: ${employee.buddy}`}
          </div>
        )}
        {access.role !== "hrbp" && (
          <BuddyAssignForm
            enrollNumber={employee.enroll_number}
            initialBuddy={employee.buddy ?? ""}
            initialPhone={employee.buddy_phone ?? ""}
            initialEmail={employee.buddy_email ?? ""}
            action={assignBuddyAsHrAdmin}
          />
        )}
      </div>

      {assessmentReviews.length > 0 && (
        <>
          <div className="mb-3 mt-[22px] font-en text-[15px] font-bold text-text">
            {isBn ? "অ্যাসেসমেন্টের উত্তর" : "Assessment Answers"}
          </div>
          <div className="mb-4 flex flex-col gap-3">
            {assessmentReviews.map((review) => (
              <div key={review.journeyName} className="rounded-card border border-line bg-card p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-en text-[13.5px] font-bold text-text">{review.journeyName}</div>
                    <div className="text-[11px] font-medium text-muted">
                      {new Date(review.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="font-en text-lg font-extrabold text-green-dark">{review.score}</div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {review.answers.map((a, i) => (
                    <div key={i} className="rounded-xl bg-bg p-3">
                      <div className="mb-1 text-[12.5px] font-bold text-text">
                        {i + 1}. {a.questionText}
                      </div>
                      <div className={`text-[12px] font-semibold ${a.correct ? "text-green-dark" : "text-err-tx"}`}>
                        {isBn ? "উত্তর" : "Answer"}: {a.yourAnswer || (isBn ? "(খালি)" : "(blank)")}
                        {a.correct ? " ✓" : " ✗"}
                      </div>
                      {!a.correct && a.correctAnswer && (
                        <div className="mt-0.5 text-[12px] font-medium text-muted">
                          {isBn ? "সঠিক উত্তর" : "Correct answer"}: {a.correctAnswer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mb-3 mt-[22px] font-en text-[15px] font-bold text-text">
        {isBn ? "জমা দেওয়া টিকেট" : "Submitted Tickets"}
      </div>
      <div className="flex flex-col gap-2">
        {(tickets ?? []).map((t) => (
          <div key={t.ticket_id} className="rounded-card border border-line bg-card p-3.5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="font-en text-[12.5px] font-bold text-text">{t.ticket_id}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-en text-[10.5px] font-bold ${
                  t.status === "open" ? "bg-warn-bg text-warn-tx" : "bg-ok-bg text-ok-tx"
                }`}
              >
                {t.status}
              </span>
            </div>
            <div className="mt-1 text-[12.5px] font-medium text-muted">
              {t.issue_type} · {new Date(t.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
        {(tickets ?? []).length === 0 && (
          <div className="rounded-card border border-line bg-card p-4 text-center text-sm font-medium text-muted shadow-card">
            {isBn ? "কোনো টিকেট জমা দেওয়া হয়নি।" : "No tickets submitted."}
          </div>
        )}
      </div>
    </div>
  );
}
