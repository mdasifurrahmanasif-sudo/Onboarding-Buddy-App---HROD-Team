import "server-only";

export interface PeopleDeskEmployee {
  name: string;
  enrollNumber: string;
  email: string | null;
  sbu: string | null;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  reportingManager: string | null;
  reportingManagerPhone: string | null;
  reportingManagerEmail: string | null;
}

interface PeopleDeskResponse {
  employeeName: string | null;
  employeeEnroll: number;
  employeeEmail: string | null;
  sbu: string | null;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  reportingManager: string | null;
  reportingManagerPhone: string | null;
  reportingManagerEmail: string | null;
}

/**
 * Looks up an employee in the company's PeopleDesk system by enroll number.
 * Returns null when PeopleDesk has no such employee (it responds 200 with all
 * fields null rather than a 404 — checked directly against the live endpoint).
 */
export async function getPeopleDeskEmployee(
  enrollNumber: string,
  timeoutMs?: number,
): Promise<PeopleDeskEmployee | null> {
  const baseUrl = process.env.PEOPLEDESK_API_URL;
  const apiKey = process.env.PEOPLEDESK_API_KEY;
  const token = process.env.PEOPLEDESK_API_TOKEN;
  if (!baseUrl || !apiKey || !token) {
    throw new Error("PeopleDesk API env vars are not configured.");
  }

  const url = `${baseUrl}?employeeId=${encodeURIComponent(enrollNumber)}`;
  const res = await fetch(url, {
    headers: { accept: "*/*", "x-api-key": apiKey, token },
    cache: "no-store",
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });

  if (!res.ok) {
    throw new Error(`PeopleDesk API error: ${res.status}`);
  }

  const data: PeopleDeskResponse = await res.json();
  if (!data.employeeName) return null;

  return {
    name: data.employeeName,
    enrollNumber: String(data.employeeEnroll),
    email: data.employeeEmail,
    sbu: data.sbu,
    department: data.department,
    designation: data.designation,
    joiningDate: data.joiningDate ? data.joiningDate.slice(0, 10) : null,
    reportingManager: data.reportingManager,
    reportingManagerPhone: data.reportingManagerPhone,
    reportingManagerEmail: data.reportingManagerEmail,
  };
}

/** Normalizes a name for loose matching (case/whitespace/punctuation-insensitive). */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}
