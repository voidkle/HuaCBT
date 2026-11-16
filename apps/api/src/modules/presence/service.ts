import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { attendanceRecords, attendanceSessions, classroomMembers, classrooms, type Role, users } from "../../db/schema";
import { getSettings, type Settings } from "../config/service";
import { distanceMeters } from "./geo";
import { checkInOptions, hasPasskey, verifyCheckIn } from "./webauthn";

/** Who takes part in presence at all (staff are not involved). */
export const PARTICIPANTS = ["admin", "operator", "teacher", "student"] as const satisfies readonly Role[];
/** Who may run classrooms and sessions (a teacher only their own). */
export const MANAGERS = ["admin", "operator", "teacher"] as const satisfies readonly Role[];
const ADMINS: readonly Role[] = ["admin", "operator"];
const MEMBER_ROLES: readonly Role[] = ["student", "teacher"];

export interface Viewer {
  id: number;
  role: Role;
}

type Failure = { ok: false; code: 400 | 403 | 404 | 409; message: string };
type Result<T> = { ok: true; value: T } | Failure;
const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const noClass = fail(404, "Kelas tidak ditemukan");
const noSession = fail(404, "Sesi tidak ditemukan");

const isOpen = (s: { closedAt: Date | null; closesAt: Date | null }, now: Date) => !s.closedAt && (!s.closesAt || s.closesAt > now);
/** Admin/operator, the class owner, or its homeroom teacher (guru kelas / wali kelas, who handles attendance). */
const canManage = (v: Viewer, ownerId: number, homeroomTeacherId: number | null = null) => ADMINS.includes(v.role) || (v.role === "teacher" && (v.id === ownerId || v.id === homeroomTeacherId));

// ---------- people & classrooms ----------

/** Candidates for a class roster. */
export const searchPeople = (q: string) =>
  db
    .select({ id: users.id, name: users.name, username: users.username, role: users.role })
    .from(users)
    .where(and(inArray(users.role, [...MEMBER_ROLES]), q ? or(ilike(users.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(users.username, `%${q.replace(/[%_\\]/g, "\\$&")}%`)) : undefined))
    .orderBy(users.name)
    .limit(30);

const classroomRows = () =>
  db
    .select({ id: classrooms.id, name: classrooms.name, ownerId: classrooms.ownerId, ownerName: users.name, homeroomTeacherId: classrooms.homeroomTeacherId })
    .from(classrooms)
    .innerJoin(users, eq(classrooms.ownerId, users.id));

const memberCounts = async (ids: number[]) =>
  new Map(
    ids.length === 0
      ? []
      : (await db.select({ id: classroomMembers.classroomId, n: count() }).from(classroomMembers).where(inArray(classroomMembers.classroomId, ids)).groupBy(classroomMembers.classroomId)).map((r) => [r.id, r.n]),
  );

async function openSessions(ids: number[]) {
  if (ids.length === 0) return new Map<number, { id: number; title: string; startedAt: Date; closesAt: Date | null }>();
  const now = new Date();
  const rows = await db.select().from(attendanceSessions).where(inArray(attendanceSessions.classroomId, ids)).orderBy(desc(attendanceSessions.startedAt));
  const out = new Map<number, { id: number; title: string; startedAt: Date; closesAt: Date | null }>();
  for (const s of rows) if (isOpen(s, now) && !out.has(s.classroomId)) out.set(s.classroomId, { id: s.id, title: s.title, startedAt: s.startedAt, closesAt: s.closesAt });
  return out;
}

export async function listClassrooms(v: Viewer) {
  const mine = db.select({ id: classroomMembers.classroomId }).from(classroomMembers).where(eq(classroomMembers.userId, v.id));
  const rows = await classroomRows()
    .where(ADMINS.includes(v.role) ? undefined : or(eq(classrooms.ownerId, v.id), eq(classrooms.homeroomTeacherId, v.id), inArray(classrooms.id, mine)))
    .orderBy(classrooms.name);
  const ids = rows.map((r) => r.id);
  const [counts, open] = await Promise.all([memberCounts(ids), openSessions(ids)]);
  return rows.map((r) => ({ ...r, memberCount: counts.get(r.id) ?? 0, canManage: canManage(v, r.ownerId, r.homeroomTeacherId), openSession: open.get(r.id) ?? null }));
}

const membersOf = (classroomId: number) =>
  db
    .select({ id: users.id, name: users.name, username: users.username, role: users.role })
    .from(classroomMembers)
    .innerJoin(users, eq(classroomMembers.userId, users.id))
    .where(eq(classroomMembers.classroomId, classroomId))
    .orderBy(users.name);

const isMember = async (classroomId: number, userId: number) =>
  (await db.select({ n: count() }).from(classroomMembers).where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, userId))))[0]!.n > 0;

/** Managers of the class see its roster; members see that it exists (their own listing). Others get 404. */
export async function getClassroom(v: Viewer, id: number): Promise<Result<Awaited<ReturnType<typeof listClassrooms>>[number] & { members: Awaited<ReturnType<typeof membersOf>> }>> {
  const [row] = await classroomRows().where(eq(classrooms.id, id));
  if (!row) return noClass;
  const manage = canManage(v, row.ownerId, row.homeroomTeacherId);
  if (!manage && !(await isMember(id, v.id))) return noClass;
  const [counts, open, members] = await Promise.all([memberCounts([id]), openSessions([id]), manage ? membersOf(id) : Promise.resolve([])]);
  return ok({ ...row, memberCount: counts.get(id) ?? 0, canManage: manage, openSession: open.get(id) ?? null, members });
}

/** Only students and teachers may be enrolled; unknown or other ids are refused instead of silently dropped. */
async function validMembers(ids: number[]): Promise<number[] | null> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return unique;
  const found = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, unique), inArray(users.role, [...MEMBER_ROLES])));
  return found.length === unique.length ? unique : null;
}

async function setMembers(classroomId: number, ids: number[]) {
  await db.delete(classroomMembers).where(eq(classroomMembers.classroomId, classroomId));
  if (ids.length) await db.insert(classroomMembers).values(ids.map((userId) => ({ classroomId, userId })));
}

export async function createClassroom(v: Viewer, input: { name: string; memberIds: number[] }): Promise<Result<{ id: number }>> {
  const members = await validMembers(input.memberIds);
  if (!members) return fail(400, "Anggota harus siswa atau guru yang terdaftar");
  const [row] = await db.insert(classrooms).values({ name: input.name.trim(), ownerId: v.id }).returning({ id: classrooms.id });
  await setMembers(row!.id, members);
  return ok({ id: row!.id });
}

async function ownedClassroom(v: Viewer, id: number): Promise<Result<{ id: number; ownerId: number }>> {
  const [row] = await db.select({ id: classrooms.id, ownerId: classrooms.ownerId, homeroomTeacherId: classrooms.homeroomTeacherId }).from(classrooms).where(eq(classrooms.id, id));
  if (!row) return noClass;
  if (canManage(v, row.ownerId, row.homeroomTeacherId)) return ok(row);
  return (await isMember(id, v.id)) ? fail(403, "Tidak diizinkan") : noClass;
}

export async function updateClassroom(v: Viewer, id: number, input: { name: string; memberIds: number[] }): Promise<Result<{ id: number }>> {
  const c = await ownedClassroom(v, id);
  if (!c.ok) return c;
  const members = await validMembers(input.memberIds);
  if (!members) return fail(400, "Anggota harus siswa atau guru yang terdaftar");
  await db.update(classrooms).set({ name: input.name.trim() }).where(eq(classrooms.id, id));
  await setMembers(id, members);
  return ok({ id });
}

export async function deleteClassroom(v: Viewer, id: number): Promise<Result<true>> {
  const c = await ownedClassroom(v, id);
  if (!c.ok) return c;
  await db.delete(classrooms).where(eq(classrooms.id, id)); // members, sessions and records cascade
  return ok(true);
}

// ---------- sessions ----------

const sessionShape = (s: typeof attendanceSessions.$inferSelect, now: Date) => ({
  id: s.id,
  classroomId: s.classroomId,
  title: s.title,
  startedAt: s.startedAt,
  closesAt: s.closesAt,
  closedAt: s.closedAt,
  lateAfterMinutes: s.lateAfterMinutes,
  open: isOpen(s, now),
});

export async function openSession(v: Viewer, classroomId: number, input: { title: string; durationMinutes?: number; lateAfterMinutes?: number }): Promise<Result<{ id: number }>> {
  const c = await ownedClassroom(v, classroomId);
  if (!c.ok) return c;
  if ((await openSessions([classroomId])).has(classroomId)) return fail(409, "Masih ada sesi yang terbuka di kelas ini");
  const now = new Date();
  const [row] = await db
    .insert(attendanceSessions)
    .values({
      classroomId,
      title: input.title.trim(),
      openedBy: v.id,
      startedAt: now,
      closesAt: input.durationMinutes ? new Date(now.getTime() + input.durationMinutes * 60_000) : null,
      lateAfterMinutes: input.lateAfterMinutes ?? null,
    })
    .returning({ id: attendanceSessions.id });
  return ok({ id: row!.id });
}

async function loadSession(id: number) {
  const [row] = await db
    .select({ s: attendanceSessions, ownerId: classrooms.ownerId, homeroomId: classrooms.homeroomTeacherId, classroomName: classrooms.name })
    .from(attendanceSessions)
    .innerJoin(classrooms, eq(attendanceSessions.classroomId, classrooms.id))
    .where(eq(attendanceSessions.id, id));
  return row ?? null;
}

export async function closeSession(v: Viewer, id: number): Promise<Result<true>> {
  const row = await loadSession(id);
  if (!row) return noSession;
  if (!canManage(v, row.ownerId, row.homeroomId)) return (await isMember(row.s.classroomId, v.id)) ? fail(403, "Tidak diizinkan") : noSession;
  if (!isOpen(row.s, new Date())) return fail(409, "Sesi sudah ditutup");
  await db.update(attendanceSessions).set({ closedAt: new Date() }).where(eq(attendanceSessions.id, id));
  return ok(true);
}

export async function deleteSession(v: Viewer, id: number): Promise<Result<true>> {
  const row = await loadSession(id);
  if (!row) return noSession;
  if (!canManage(v, row.ownerId, row.homeroomId)) return (await isMember(row.s.classroomId, v.id)) ? fail(403, "Tidak diizinkan") : noSession;
  await db.delete(attendanceSessions).where(eq(attendanceSessions.id, id));
  return ok(true);
}

/** Newest first. Managers get counts per session; members get only their own record. */
export async function listSessions(v: Viewer, classroomId: number): Promise<Result<unknown[]>> {
  const [c] = await db.select({ ownerId: classrooms.ownerId, homeroomTeacherId: classrooms.homeroomTeacherId }).from(classrooms).where(eq(classrooms.id, classroomId));
  if (!c) return noClass;
  const manage = canManage(v, c.ownerId, c.homeroomTeacherId);
  if (!manage && !(await isMember(classroomId, v.id))) return noClass;
  const rows = await db.select().from(attendanceSessions).where(eq(attendanceSessions.classroomId, classroomId)).orderBy(desc(attendanceSessions.startedAt)).limit(100);
  const ids = rows.map((r) => r.id);
  const now = new Date();
  const [counts, mine, total] = await Promise.all([
    manage && ids.length
      ? db.select({ id: attendanceRecords.sessionId, present: count(), late: sql<number>`count(*) filter (where ${attendanceRecords.late})`.mapWith(Number) }).from(attendanceRecords).where(inArray(attendanceRecords.sessionId, ids)).groupBy(attendanceRecords.sessionId)
      : Promise.resolve([]),
    ids.length ? db.select().from(attendanceRecords).where(and(inArray(attendanceRecords.sessionId, ids), eq(attendanceRecords.userId, v.id))) : Promise.resolve([]),
    memberCounts([classroomId]),
  ]);
  const byCount = new Map(counts.map((r) => [r.id, r]));
  const byMine = new Map(mine.map((r) => [r.sessionId, r]));
  return ok(
    rows.map((s) => ({
      ...sessionShape(s, now),
      mine: byMine.has(s.id) ? { checkedAt: byMine.get(s.id)!.checkedAt, late: byMine.get(s.id)!.late } : null,
      stats: manage ? { present: byCount.get(s.id)?.present ?? 0, late: byCount.get(s.id)?.late ?? 0, total: total.get(classroomId) ?? 0 } : null,
    })),
  );
}

/** Managers get the whole roster (absent members included); a member gets the session and their own record. */
export async function getSession(v: Viewer, id: number) {
  const row = await loadSession(id);
  if (!row) return noSession;
  const manage = canManage(v, row.ownerId, row.homeroomId);
  if (!manage && !(await isMember(row.s.classroomId, v.id))) return noSession;
  const now = new Date();
  const base = { ...sessionShape(row.s, now), classroomName: row.classroomName };
  if (!manage) {
    const [mine] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.sessionId, id), eq(attendanceRecords.userId, v.id)));
    return ok({ ...base, roster: null, mine: mine ? { checkedAt: mine.checkedAt, late: mine.late } : null });
  }
  const roster = await db
    .select({ id: users.id, name: users.name, username: users.username, role: users.role, checkedAt: attendanceRecords.checkedAt, late: attendanceRecords.late, distanceM: attendanceRecords.distanceM })
    .from(classroomMembers)
    .innerJoin(users, eq(classroomMembers.userId, users.id))
    .leftJoin(attendanceRecords, and(eq(attendanceRecords.sessionId, id), eq(attendanceRecords.userId, classroomMembers.userId)))
    .where(eq(classroomMembers.classroomId, row.s.classroomId))
    .orderBy(users.name);
  return ok({ ...base, roster, mine: null });
}

/** Open sessions of classes the viewer belongs to, with whether they already checked in. */
export async function openForMe(v: Viewer) {
  const now = new Date();
  const rows = await db
    .select({ s: attendanceSessions, classroomName: classrooms.name, checkedAt: attendanceRecords.checkedAt, late: attendanceRecords.late })
    .from(classroomMembers)
    .innerJoin(attendanceSessions, eq(attendanceSessions.classroomId, classroomMembers.classroomId))
    .innerJoin(classrooms, eq(classrooms.id, classroomMembers.classroomId))
    .leftJoin(attendanceRecords, and(eq(attendanceRecords.sessionId, attendanceSessions.id), eq(attendanceRecords.userId, v.id)))
    .where(eq(classroomMembers.userId, v.id))
    .orderBy(desc(attendanceSessions.startedAt))
    .limit(50);
  return rows
    .filter((r) => isOpen(r.s, now))
    .map((r) => ({ ...sessionShape(r.s, now), classroomName: r.classroomName, mine: r.checkedAt ? { checkedAt: r.checkedAt, late: r.late ?? false } : null }));
}

// ---------- check-in ----------

interface Where {
  lat?: number | null;
  lng?: number | null;
}

/** null = fine; otherwise the refusal. No school location in Config = no check. Coordinates come from the browser, so this deters, it does not prove. */
function locationProblem(s: Settings, at: Where): { failure: Failure } | { distance: number | null } {
  if (s.schoolLat === null || s.schoolLng === null) return { distance: null };
  if (at.lat == null || at.lng == null) return { failure: fail(400, "Lokasi diperlukan. Izinkan akses lokasi di browser.") };
  const distance = Math.round(distanceMeters({ lat: s.schoolLat, lng: s.schoolLng }, { lat: at.lat, lng: at.lng }));
  return distance > s.schoolRadiusM ? { failure: fail(403, `Anda berada ${distance} m dari sekolah (maksimal ${s.schoolRadiusM} m)`) } : { distance };
}

/** Everything that must hold before a biometric prompt makes sense (also re-checked on the real check-in). */
async function checkInGate(v: Viewer, sessionId: number, at: Where): Promise<Result<{ session: typeof attendanceSessions.$inferSelect; distance: number | null }>> {
  const settings = await getSettings();
  if (!settings.biometricsEnabled) return fail(403, "Presensi biometrik dinonaktifkan oleh admin");
  const row = await loadSession(sessionId);
  if (!row || !(await isMember(row.s.classroomId, v.id))) return noSession;
  if (!isOpen(row.s, new Date())) return fail(409, "Sesi presensi sudah ditutup");
  const [done] = await db.select({ n: count() }).from(attendanceRecords).where(and(eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.userId, v.id)));
  if (done!.n > 0) return fail(409, "Anda sudah presensi di sesi ini");
  if (!(await hasPasskey(v.id))) return fail(400, "Daftarkan perangkat biometrik Anda dulu");
  const loc = locationProblem(settings, at);
  if ("failure" in loc) return loc.failure;
  return ok({ session: row.s, distance: loc.distance });
}

export async function startCheckIn(v: Viewer, sessionId: number, at: Where) {
  const gate = await checkInGate(v, sessionId, at);
  if (!gate.ok) return gate;
  return ok(await checkInOptions(v.id, sessionId));
}

export async function finishCheckIn(v: Viewer, sessionId: number, at: Where, response: AuthenticationResponseJSON) {
  const gate = await checkInGate(v, sessionId, at);
  if (!gate.ok) return gate;
  let verified = false;
  try {
    verified = await verifyCheckIn(v.id, sessionId, response);
  } catch {
    verified = false; // malformed or tampered response
  }
  if (!verified) return fail(400, "Verifikasi biometrik gagal. Coba lagi.");
  const now = new Date();
  const { session, distance } = gate.value;
  const late = session.lateAfterMinutes != null && now.getTime() > session.startedAt.getTime() + session.lateAfterMinutes * 60_000;
  const inserted = await db
    .insert(attendanceRecords)
    .values({ sessionId, userId: v.id, checkedAt: now, late, method: "webauthn", latitude: at.lat ?? null, longitude: at.lng ?? null, distanceM: distance })
    .onConflictDoNothing()
    .returning({ sessionId: attendanceRecords.sessionId });
  if (inserted.length === 0) return fail(409, "Anda sudah presensi di sesi ini"); // double tap raced past the gate
  return ok({ checkedAt: now, late });
}
