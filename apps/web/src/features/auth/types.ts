export type Role = "admin" | "operator" | "teacher" | "staff" | "student";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: Role;
}

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  operator: "Operator",
  teacher: "Guru",
  staff: "Staf",
  student: "Siswa",
};
