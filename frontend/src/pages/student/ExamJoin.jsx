import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ExamJoin = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const joinExam = async () => {
      try {
        const { data } = await api.get(`/exams/access/${code}`);
        toast.success(`Exam Found: ${data.title}`);
        navigate(`/exams/${data.id}`);
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid access code or network error.');
        toast.error('Access Denied');
      }
    };

    if (code) {
      joinExam();
    }
  }, [code, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="glass rounded-[3rem] p-12 max-w-sm w-full text-center border-slate-200 dark:border-slate-800/40 animate-fade-in">
        {!error ? (
          <div className="space-y-6">
             <div className="relative mx-auto w-20 h-20">
                <Loader2 className="h-20 w-20 text-indigo-500 animate-spin opacity-20" />
                <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-indigo-400" />
             </div>
             <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic">Securing Entrance</h2>
                <p className="text-slate-500 text-xs font-medium">Validating your unique access credentials. Please hold while we bridge your session.</p>
             </div>
          </div>
        ) : (
          <div className="space-y-6">
             <div className="h-20 w-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto border border-rose-500/20">
                <AlertCircle className="h-10 w-10 text-rose-500" />
             </div>
             <div className="space-y-2">
                <h2 className="text-2xl font-black text-rose-500 tracking-tight italic">Validation Failure</h2>
                <p className="text-slate-500 text-xs font-medium">{error}</p>
             </div>
             <button 
                onClick={() => navigate('/')}
                className="btn-primary w-full h-12 rounded-2xl text-[10px] uppercase font-black tracking-widest"
             >
                Return to Command Center
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamJoin;
