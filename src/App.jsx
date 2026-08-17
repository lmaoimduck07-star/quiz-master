import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SpectatorView from "./pages/SpectatorView"; // Direct import — không lazy để mở tab tức thửời
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import PrivateRoute from "./components/PrivateRoute";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
// ─── Wrapper components (Mobile/Tablet/Desktop auto-routing) ───────────────
const ClientDashboard = lazy(() => import("./pages/ClientDashboardWrapper"));
const MockExam = lazy(() => import("./pages/MockExamWrapper"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboardWrapper"));
const LecturerDashboard = lazy(() => import("./pages/LecturerDashboardWrapper"));
const CodingWorkspace = lazy(() => import("./pages/coding/CodingWorkspaceWrapper"));
// ─── Desktop-only pages (không cần Wrapper) ──────────────────────────────
const PracticeReview = lazy(() => import("./pages/PracticeReview"));
const CodingDashboard = lazy(() => import("./pages/coding/CodingDashboard"));
const CodingViva = lazy(() => import("./pages/coding/CodingViva"));
const CodingReview = lazy(() => import("./pages/coding/CodingReview"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-bold text-slate-400 animate-pulse">Đang nạp ứng dụng Quiz Master...</p>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/client/dashboard" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']}>
                  <ClientDashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/client/review" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']}>
                  <PracticeReview />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/client/exam" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']}>
                  <MockExam />
                </PrivateRoute>
              } 
            />
            {/* URL-based session route — sessionId nằm trực tiếp trên URL */}
            <Route 
              path="/client/exam/:sessionId" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']}>
                  <MockExam />
                </PrivateRoute>
              } 
            />
            {/* Admin Spectator Route — Xem trực tiếp bài làm của học sinh (Read-Only) — Admin & Giảng viên */}
            <Route 
              path="/admin/spectate/:sessionId" 
              element={
                <PrivateRoute allowedRoles={['Admin', 'Lecturer']}>
                  <SpectatorView />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/admin/dashboard" 
              element={
                <PrivateRoute allowedRoles={['Admin']}>
                  <AdminDashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/lecturer/dashboard" 
              element={
                <PrivateRoute allowedRoles={['Lecturer', 'Admin']}>
                  <LecturerDashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/coding/dashboard" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']} requiredPermission="codingAccess">
                  <CodingDashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/coding/workspace" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']} requiredPermission="codingAccess">
                  <CodingWorkspace />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/coding/viva" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']} requiredPermission="codingAccess">
                  <CodingViva />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/coding/review" 
              element={
                <PrivateRoute allowedRoles={['Student', 'Admin']} requiredPermission="codingExam">
                  <CodingReview />
                </PrivateRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
