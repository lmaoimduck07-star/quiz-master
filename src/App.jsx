import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClientDashboard from "./pages/ClientDashboard";
import PracticeReview from "./pages/PracticeReview";
import MockExam from "./pages/MockExam";
import AdminDashboard from "./pages/AdminDashboard";
import CodingDashboard from "./pages/coding/CodingDashboard";
import CodingWorkspace from "./pages/coding/CodingWorkspace";
import CodingViva from "./pages/coding/CodingViva";
import CodingReview from "./pages/coding/CodingReview";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/client/dashboard" 
            element={
              <PrivateRoute allowedRoles={['Student']}>
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
