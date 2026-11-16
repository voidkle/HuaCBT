import { api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { ClassDetail, ClassInput, ClassSystem, ClassSummary, LessonInput, Room, ScheduleLesson, Subject, Teacher } from "../types";

/** The school-wide mode lives in Config; everyone may read it. */
export const fetchMode = async () => {
  const c = unwrap<{ classSystem: ClassSystem; movingClass: boolean }>(await api.config.public.get());
  return { system: c.classSystem, moving: c.movingClass };
};

export const fetchTeachers = async () => unwrap<Teacher[]>(await api.classes.teachers.get());

export const fetchSubjects = async () => unwrap<Subject[]>(await api.classes.subjects.get());
export const createSubject = async (name: string) => unwrap<{ id: number }>(await api.classes.subjects.post({ name }));
export const renameSubject = async (id: number, name: string) => unwrap<{ id: number }>(await api.classes.subjects({ id }).patch({ name }));
export const deleteSubject = async (id: number) => unwrap<{ ok: true }>(await api.classes.subjects({ id }).delete());

export const fetchRooms = async () => unwrap<Room[]>(await api.classes.rooms.get());
export const createRoom = async (name: string, ownerId: number | null) => unwrap<{ id: number }>(await api.classes.rooms.post({ name, ownerId }));
export const updateRoom = async (id: number, name: string, ownerId: number | null) => unwrap<{ id: number }>(await api.classes.rooms({ id }).patch({ name, ownerId }));
export const deleteRoom = async (id: number) => unwrap<{ ok: true }>(await api.classes.rooms({ id }).delete());

export const fetchClasses = async () => unwrap<ClassSummary[]>(await api.classes.get());
export const fetchClass = async (id: number) => unwrap<ClassDetail>(await api.classes({ id }).get());
export const createClass = async (input: ClassInput) => unwrap<{ id: number }>(await api.classes.post(input));
export const updateClass = async (id: number, input: ClassInput) => unwrap<{ id: number }>(await api.classes({ id }).patch(input));

export const assignSubject = async (id: number, subjectId: number, teacherId: number | null) => unwrap<{ ok: true }>(await api.classes({ id }).subjects({ subjectId }).put({ teacherId }));
export const unassignSubject = async (id: number, subjectId: number) => unwrap<{ ok: true }>(await api.classes({ id }).subjects({ subjectId }).delete());

export const addLesson = async (id: number, subjectId: number, input: LessonInput) => unwrap<{ id: number }>(await api.classes({ id }).subjects({ subjectId }).lessons.post(input));
export const updateLesson = async (id: number, lessonId: number, input: LessonInput) => unwrap<{ id: number }>(await api.classes({ id }).lessons({ lessonId }).patch(input));
export const removeLesson = async (id: number, lessonId: number) => unwrap<{ ok: true }>(await api.classes({ id }).lessons({ lessonId }).delete());

export const fetchMySchedule = async () => unwrap<ScheduleLesson[]>(await api.classes.schedule.mine.get());
