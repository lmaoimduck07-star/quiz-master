import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import PrivateRoute from "./components/PrivateRoute";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const PracticeReview = lazy(() => import("./pages/PracticeReview"));
const MockExam = lazy(() => import("./pages/MockExam"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CodingDashboard = lazy(() => import("./pages/coding/CodingDashboard"));
const CodingWorkspace = lazy(() => import("./pages/coding/CodingWorkspace"));
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
            <Route 
              path="/admin/dashboard" 
              element={
                <PrivateRoute allowedRoles={['Admin']}>
                  <AdminDashboard />
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
