import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import InstructorDashboard from './pages/InstructorDashboard';
import CreateExam from './pages/CreateExam';
import StudentDashboard from './pages/StudentDashboard';
import ExamTaking from './pages/ExamTaking';

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role?: string }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center font-bold">Initializing Application...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to={user.role === 'INSTRUCTOR' ? '/instructor' : '/student'} />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/instructor" element={<ProtectedRoute role="INSTRUCTOR"><InstructorDashboard /></ProtectedRoute>} />
          <Route path="/instructor/create-exam" element={<ProtectedRoute role="INSTRUCTOR"><CreateExam /></ProtectedRoute>} />
          <Route path="/student" element={<ProtectedRoute role="STUDENT"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/exam/:id/start" element={<ProtectedRoute role="STUDENT"><ExamTaking /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
