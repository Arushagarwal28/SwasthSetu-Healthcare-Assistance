import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';

import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

import PatientDashboard from './pages/patient/PatientDashboard';
import PatientProfilePage from './pages/patient/PatientProfilePage';
import AssessmentPage from './pages/patient/assessment/AssessmentPage';

import HelperDashboard from './pages/helper/HelperDashboard';

import HospitalDashboard from './pages/hospital/HospitalDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

import { AssistedPatientProvider } from './context/AssistedPatientContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* Authentication */}
          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/register"
            element={<RegisterPage />}
          />


          {/* ================= PATIENT ================= */}

          <Route
            path="/patient/*"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/patient/profile"
            element={
              <ProtectedRoute allowedRoles={['PATIENT']}>
                <PatientProfilePage />
              </ProtectedRoute>
            }
          />


          {/* ================= HELPER ================= */}

          {/* Helper assessment for an assisted patient */}
          <Route
            path="/helper/assessment/new"
            element={
              <ProtectedRoute allowedRoles={['HELPER']}>
                <AssistedPatientProvider>
                  <AssessmentPage />
                </AssistedPatientProvider>
              </ProtectedRoute>
            }
          />

          {/* Helper dashboard */}
          <Route
            path="/helper/*"
            element={
              <ProtectedRoute allowedRoles={['HELPER']}>
                <AssistedPatientProvider>
                  <HelperDashboard />
                </AssistedPatientProvider>
              </ProtectedRoute>
            }
          />


          {/* ================= HOSPITAL ================= */}

          <Route
            path="/hospital/*"
            element={
              <ProtectedRoute allowedRoles={['HOSPITAL_STAFF']}>
                <HospitalDashboard />
              </ProtectedRoute>
            }
          />


          {/* ================= ADMIN ================= */}

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;