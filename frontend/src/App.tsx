import { Navigate, Route, Routes } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./layout/AppLayout";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { ClassesPage } from "./pages/ClassesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamPage } from "./pages/ExamPage";
import { LoginPage } from "./pages/LoginPage";
import { PromptsPage } from "./pages/PromptsPage";
import type { Role } from "./lib/types";

function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const { user, booting } = useAuth();
  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-sm text-slate-500">
          Memuat…
        </p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/soal"
          element={
            <ProtectedRoute roles={["guru", "admin"]}>
              <PromptsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/ujian" element={<AssignmentsPage />} />
        <Route
          path="/kerjakan/:id"
          element={
            <ProtectedRoute roles={["siswa"]}>
              <ExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kelas"
          element={
            <ProtectedRoute roles={["admin"]}>
              <ClassesPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
