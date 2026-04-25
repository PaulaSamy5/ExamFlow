import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Clock, Users, Calendar, Trash2 } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  totalGrade: number;
  duration: number;
  startTime: string;
  endTime: string;
  _count: { questions: number };
}

const InstructorDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await api.get('/exams');
        setExams(res.data);
      } catch (err) {
        console.error('Failed to fetch exams');
      }
    };
    fetchExams();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold mb-1">Hello, Instructor {user?.name}!</h1>
            <p className="text-slate-500">Manage your exams and students from here.</p>
          </div>
          <div className="flex gap-4">
            <Link to="/instructor/create-exam" className="btn-primary flex items-center gap-2">
              <Plus size={20} /> Create Exam
            </Link>
            <button onClick={logout} className="px-4 py-2 text-red-500 border border-red-500 rounded-lg font-semibold hover:bg-red-500 hover:text-white transition-all">
              Logout
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam, idx) => (
            <motion.div 
              key={exam.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="premium-card group relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
                   <BookOpen size={20} />
                </div>
                <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase tracking-wider">
                  Active
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 transition-colors">{exam.title}</h3>
              <p className="text-slate-500 text-sm mb-6 line-clamp-2">{exam.description || 'No description provided'}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 mb-6">
                <div className="flex items-center gap-2">
                  <Clock size={16} /> {exam.duration} mins
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} /> {new Date(exam.startTime).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} /> {exam._count.questions} questions
                </div>
                <div className="flex items-center gap-2">
                   <span className="font-bold">{exam.totalGrade}</span> Total Pts
                </div>
              </div>

              <div className="flex gap-2">
                <Link to={`/instructor/exam/${exam.id}`} className="flex-1 py-2 text-center bg-slate-100 dark:bg-slate-800 rounded-lg font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                  View Results
                </Link>
                <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Exam">
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default InstructorDashboard;
