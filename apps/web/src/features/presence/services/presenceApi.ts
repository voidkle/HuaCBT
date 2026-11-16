import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/browser";
import { api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { ClassroomDetail, ClassroomInput, MySession, Passkey, Person, PresenceConfig, Classroom, SessionDetail, SessionInput, SessionSummary } from "../types";

export interface Where {
  lat: number | null;
  lng: number | null;
}

export const fetchConfig = async () => unwrap<PresenceConfig>(await api.config.public.get());

export const fetchPasskeys = async () => unwrap<Passkey[]>(await api.presence.passkeys.get());
export const passkeyOptions = async () => unwrap<PublicKeyCredentialCreationOptionsJSON>(await api.presence.passkeys.options.post());
export const savePasskey = async (label: string, response: RegistrationResponseJSON) => unwrap<{ ok: true }>(await api.presence.passkeys.post({ label, response }));
export const deletePasskey = async (id: number) => unwrap<{ ok: true }>(await api.presence.passkeys({ id }).delete());

export const fetchPeople = async (q: string) => unwrap<Person[]>(await api.presence.people.get({ query: { q } }));
export const fetchClassrooms = async () => unwrap<Classroom[]>(await api.presence.classrooms.get());
export const fetchClassroom = async (id: number) => unwrap<ClassroomDetail>(await api.presence.classrooms({ id }).get());
export const createClassroom = async (input: ClassroomInput) => unwrap<{ id: number }>(await api.presence.classrooms.post(input));
export const updateClassroom = async (id: number, input: ClassroomInput) => unwrap<{ id: number }>(await api.presence.classrooms({ id }).patch(input));
export const deleteClassroom = async (id: number) => unwrap<{ ok: true }>(await api.presence.classrooms({ id }).delete());

export const fetchSessions = async (classroomId: number) => unwrap<SessionSummary[]>(await api.presence.classrooms({ id: classroomId }).sessions.get());
export const openSession = async (classroomId: number, input: SessionInput) => unwrap<{ id: number }>(await api.presence.classrooms({ id: classroomId }).sessions.post(input));
export const fetchSession = async (id: number) => unwrap<SessionDetail>(await api.presence.sessions({ id }).get());
export const closeSession = async (id: number) => unwrap<{ ok: true }>(await api.presence.sessions({ id }).close.post());
export const deleteSession = async (id: number) => unwrap<{ ok: true }>(await api.presence.sessions({ id }).delete());
export const fetchMySessions = async () => unwrap<MySession[]>(await api.presence.sessions.open.get());

export const checkInOptions = async (id: number, at: Where) => unwrap<PublicKeyCredentialRequestOptionsJSON>(await api.presence.sessions({ id })["check-in"].options.post(at));
export const checkIn = async (id: number, at: Where, response: AuthenticationResponseJSON) =>
  unwrap<{ checkedAt: Date; late: boolean }>(await api.presence.sessions({ id })["check-in"].post({ ...at, response }));
