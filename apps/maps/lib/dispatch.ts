// Skill-based technician dispatch.
// Matches jobs (stops) to technicians by required qualifications, then balances
// workload and proximity. Pure logic — no I/O — so it can be unit-tested and
// re-used both for live auto-assignment and for preview before persisting.

export interface DispatchTechnician {
  id: string;
  name: string;
  skills: string[];
  maxStopsPerDay: number;
  active: boolean;
  homeLat?: number | null;
  homeLng?: number | null;
}

export interface DispatchJob {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  priority: number;            // 0 normal, 1 hoch, 2 dringend
  requiredSkills: string[];
  timeFrom?: string | null;    // "HH:MM"
}

export interface Assignment {
  jobId: string;
  technicianId: string | null; // null = could not be assigned
  reason: string;              // human-readable explanation (German)
}

// Common trades, offered as suggestions in the UI. Skills are free-form, so
// orgs can add their own — this list is only a convenience.
export const SKILL_CATALOG = [
  "Heizung",
  "Sanitär",
  "Klima",
  "Lüftung",
  "Elektro",
  "Kältetechnik",
  "Smart Home",
  "Solar / PV",
  "Gasgeräte",
  "Notdienst",
] as const;

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** A technician is qualified for a job if they hold every required skill. */
export function isQualified(tech: DispatchTechnician, job: DispatchJob): boolean {
  if (job.requiredSkills.length === 0) return true;
  const have = new Set(tech.skills.map(normalize));
  return job.requiredSkills.every(s => have.has(normalize(s)));
}

function missingSkills(tech: DispatchTechnician, job: DispatchJob): string[] {
  const have = new Set(tech.skills.map(normalize));
  return job.requiredSkills.filter(s => !have.has(normalize(s)));
}

// Haversine distance in km, used as a light proximity tie-breaker.
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface PlanState {
  count: number;
  // centroid of already-assigned jobs, for proximity scoring
  sumLat: number;
  sumLng: number;
  geoCount: number;
}

/**
 * Greedy assignment: highest-priority / earliest jobs first. For each job,
 * pick the qualified technician with spare capacity that minimises
 * (workload penalty + proximity penalty). Deterministic — ties break by name
 * then id, so the same input always yields the same plan.
 */
export function autoAssign(
  technicians: DispatchTechnician[],
  jobs: DispatchJob[]
): Assignment[] {
  const active = technicians
    .filter(t => t.active)
    .sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));

  const state = new Map<string, PlanState>(
    active.map(t => [t.id, { count: 0, sumLat: 0, sumLng: 0, geoCount: 0 }])
  );

  const ordered = [...jobs].sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.timeFrom ?? "99:99").localeCompare(b.timeFrom ?? "99:99") ||
      a.name.localeCompare(b.name, "de")
  );

  const assignments: Assignment[] = [];

  for (const job of ordered) {
    const qualified = active.filter(t => isQualified(t, job));

    if (qualified.length === 0) {
      const anyTech = active[0];
      const missing = anyTech ? missingSkills(anyTech, job) : job.requiredSkills;
      assignments.push({
        jobId: job.id,
        technicianId: null,
        reason:
          job.requiredSkills.length === 0
            ? "Kein aktiver Techniker verfügbar"
            : `Kein Techniker mit Qualifikation: ${job.requiredSkills.join(", ")}`,
      });
      // keep `missing` referenced for readability of the requirement
      void missing;
      continue;
    }

    const withCapacity = qualified.filter(
      t => state.get(t.id)!.count < t.maxStopsPerDay
    );
    // If everyone qualified is at capacity, fall back to qualified anyway so the
    // job still gets a tech (overbooking is better than silently dropping it).
    const pool = withCapacity.length > 0 ? withCapacity : qualified;
    const overbooked = withCapacity.length === 0;

    let best = pool[0];
    let bestScore = Infinity;
    for (const t of pool) {
      const st = state.get(t.id)!;
      const workloadPenalty = st.count * 10;
      let proximityPenalty = 0;
      if (job.lat != null && job.lng != null && st.geoCount > 0) {
        proximityPenalty = distanceKm(
          job.lat,
          job.lng,
          st.sumLat / st.geoCount,
          st.sumLng / st.geoCount
        );
      }
      const score = workloadPenalty + proximityPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }

    const st = state.get(best.id)!;
    st.count += 1;
    if (job.lat != null && job.lng != null) {
      st.sumLat += job.lat;
      st.sumLng += job.lng;
      st.geoCount += 1;
    }

    const skillNote =
      job.requiredSkills.length > 0
        ? `passende Qualifikation (${job.requiredSkills.join(", ")})`
        : "keine Spezialqualifikation nötig";
    assignments.push({
      jobId: job.id,
      technicianId: best.id,
      reason: overbooked
        ? `${best.name} – ${skillNote}, über Tageskapazität`
        : `${best.name} – ${skillNote}`,
    });
  }

  return assignments;
}

/** Per-technician workload summary derived from a set of assignments. */
export function summarize(
  technicians: DispatchTechnician[],
  assignments: Assignment[]
): Array<{ technicianId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (a.technicianId) counts.set(a.technicianId, (counts.get(a.technicianId) ?? 0) + 1);
  }
  return technicians.map(t => ({ technicianId: t.id, count: counts.get(t.id) ?? 0 }));
}
