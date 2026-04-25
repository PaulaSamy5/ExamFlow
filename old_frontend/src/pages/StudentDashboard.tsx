import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Book, AlertCircle, Play, CheckCircle, Search, Filter } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  totalGrade: number;
  duration: number;
  startTime: string;
  endTime: string;
}

const StudentDashboard: React.FC = () => {
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await api.get('/exams');
        setAvailableExams(res.data);
      } catch (err) {
        console.error('Failed to fetch exams');
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const filteredExams = availableExams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    exam.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Simulation or Header */}
      <header className="bg-white dark:bg-slate-900 border-b p-4 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-lg">
             <Book size={20} />
          </div>
          <h2 className="text-xl font-bold hidden md:block">ExamPortal</h2>
        </div>

        <div className="flex-1 max-w-lg mx-8 hidden md:relative md:block">
           <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           <input 
            type="text" 
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-full focus:ring-2 focus:ring-primary-500 transition-all outline-none bg-slate-50 dark:bg-slate-800"
           />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold">{user?.name}</p>
            <p className="text-xs text-slate-500 uppercase">{user?.role}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-500 hover:text-red-500 rounded-full hover:bg-red-50 transition-all">
             Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2">Available Exams</h1>
          <p className="text-slate-500">Pick an exam to start your evaluation. Good luck!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="animate-pulse bg-white dark:bg-slate-800 rounded-2xl h-64 p-6 shadow-sm">
                  <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-lg mb-4" />
                  <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-8" />
                  <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))
            ) : filteredExams.length > 0 ? (
              filteredExams.map((exam, idx) => (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:shadow-2xl hover:shadow-primary-500/10 transition-all group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                      <Book size={64} className="text-primary-600" />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-primary-600">
                    <CheckCircle size={14} /> Available
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-3 dark:text-white">{exam.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-8 line-clamp-2 text-sm leading-relaxed">
                    {exam.description || 'Access and complete this evaluation within the given time limit.'}
                  </p>
                  
                  <div className="space-y-4 mb-8">
                     <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary-600">
                           <Clock size={16} />
                        </span>
                        {exam.duration} Minutes Duration
                     </div>
                     <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary-600">
                           <AlertCircle size={16} />
                        </span>
                        Total Grade: {exam.totalGrade}
                     </div>
                  </div>

                  <Link 
                    to={`/student/exam/${exam.id}/start`}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold rounded-2xl hover:scale-[1.02] transition-all shadow-xl active:scale-95"
                  >
                     <Play size={18} fill="currentColor" /> Start Exam
                  </Link>
                </motion.div>
              ))
            ) : (
                <div className="col-span-full py-20 text-center">
                   <div className="inline-flex h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center text-slate-400 mb-6">
                      <Filter size={32} />
                   </div>
                   <h3 className="text-xl font-bold mb-2">No Exams Found</h3>
                   <p className="text-slate-500">Try searching for something else or contact your instructor.</p>
                </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
