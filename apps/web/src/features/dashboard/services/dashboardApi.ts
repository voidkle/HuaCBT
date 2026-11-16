import type { ActivityPoint, DashboardData } from "../types";

// ponytail: placeholder data until the API has attendance/notice modules. Swap this one function for an Eden call.
const DAYS = 90;

function buildActivity(): ActivityPoint[] {
  const end = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (DAYS - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      attendance: Math.round(980 + Math.sin(i / 7) * 110 + Math.sin(i / 2.3) * 25),
      logins: Math.round(760 + Math.cos(i / 9) * 90 + Math.sin(i / 3.1) * 30),
    };
  });
}

export async function getDashboard(): Promise<DashboardData> {
  return {
    stats: [
      { key: "classes", label: "Kelas Aktif", value: "24", change: 4.2, footnote: "Dibanding bulan lalu" },
      { key: "attendance", label: "Kehadiran Hari Ini", value: "92,4%", change: 1.8, footnote: "Siswa & guru terpresensi" },
      { key: "students", label: "Siswa Aktif", value: "1.248", change: 8.1, footnote: "Login dalam 7 hari terakhir" },
      { key: "exams", label: "Ujian Minggu Ini", value: "6", change: 20, footnote: "Dijadwalkan oleh guru" },
    ],
    activity: buildActivity(),
  };
}
