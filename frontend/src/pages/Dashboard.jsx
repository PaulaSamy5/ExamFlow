import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import InstructorDashboard from './instructor/InstructorDashboard';
import StudentDashboard from './student/StudentDashboard';

const Dashboard = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return user.role === 'INSTRUCTOR' ? <InstructorDashboard /> : <StudentDashboard />;
};

export default Dashboard;
