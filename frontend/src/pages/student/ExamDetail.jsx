import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  Play, ClipboardCheck, Clock, AlertTriangle, ArrowLeft,
  ShieldCheck, Award, Info, CheckCircle2, XCircle,
  MonitorOff, Wifi, RefreshCw, Eye, BookOpen, Timer
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ExamDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const { data } = await api.get(`/exams/${id}`);
        setExam(data);
      } catch (err) {
        toast.error('Failed to load exam details');
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [id]);

  const handleStart = async () => {
    if (!agreed) { toast.error('Please confirm you have read the rules.'); return; }
    setStarting(true);
    try {
      const { data } = await api.post(`/submissions/${id}/start`);
      toast.success('Exam started! Good luck 🎯');
      navigate(`/session/${data.id}`);
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to start exam.';
      toast.error(errorMsg);
      setStarting(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
      <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Exam...</p>
    </div>
  );

  if (!exam) return (
    <div className="glass rounded-[2rem] p-20 text-center border-slate-200 dark:border-slate-800/40">
      <Info className="h-12 w-12 text-rose-500 mx-auto mb-4" />
      <h2 className="text-2xl font-black text-slate-900 dark:text-white">Exam Not Found</h2>
      <p className="text-slate-500 mt-2">This exam may have been removed or is no longer available.</p>
      <Link to="/" className="btn-primary inline-flex mt-8 px-10">Back to Dashboard</Link>
    </div>
  );

  const rules = [
    { icon: MonitorOff,  color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',   text: 'Do not close or refresh the browser tab during the exam.' },
    { icon: Eye,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',  text: 'Avoid switching tabs or opening other windows — it may be flagged.' },
    { icon: Wifi,        color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20', text: 'Ensure a stable internet connection before you start.' },
    { icon: RefreshCw,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',text: 'Your answers are saved automatically every few seconds.' },
    { icon: Timer,       color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20', text: 'The timer starts immediately — you cannot pause it once begun.' },
    { icon: CheckCircle2,color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',    text: 'Submission is final. Review your answers before submitting.' },
  ];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#040814] px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-3xl space-y-8">

      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-all group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* ── Hero Card ── */}
      <div className="glass rounded-[2rem] p-8 border-indigo-500/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-violet-600/5 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-10 bg-indigo-600 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Official Exam</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-3">{exam.title}</h1>
          {exam.description && (
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm max-w-xl">{exam.description}</p>
          )}
        </div>
      </div>

      {/* ── Specs Row ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Duration',   value: `${exam.duration} min`,                   icon: Clock,          color: 'text-indigo-400',  bg: 'bg-indigo-500/10'  },
          { label: 'Questions',  value: `${exam.questions?.length || 0}`,          icon: ClipboardCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Total Grade', value: `${exam.totalGrade} pts`,                 icon: Award,          color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
        ].map((spec, i) => (
          <div key={i} className="glass rounded-2xl p-5 border-slate-200 dark:border-slate-800/40 flex flex-col gap-3 items-center text-center">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${spec.bg}`}>
              <spec.icon className={`h-5 w-5 ${spec.color}`} />
            </div>
            <div>
              <p className={`text-lg font-black ${spec.color}`}>{spec.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{spec.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Rules ── */}
      <div className="glass rounded-[2rem] p-6 border-slate-200 dark:border-slate-800/40">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Exam Rules & Guidelines</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Please read carefully before starting</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rules.map((rule, i) => (
            <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl ${rule.bg} border ${rule.border}`}>
              <div className={`shrink-0 mt-0.5 ${rule.color}`}>
                <rule.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{rule.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agreement + Start ── */}
      <div className="glass rounded-[2rem] p-6 border-indigo-500/10 space-y-5">

        {/* Checkbox agreement */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
            agreed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-slate-100 dark:bg-slate-800 group-hover:border-indigo-500'
          }`}
            onClick={() => setAgreed(!agreed)}
          >
            {agreed && <CheckCircle2 className="h-3.5 w-3.5 text-slate-900 dark:text-white" />}
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed select-none" onClick={() => setAgreed(!agreed)}>
            I have read and understood all the exam rules. I am ready to begin and will not attempt to cheat or violate academic integrity.
          </span>
        </label>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!agreed || starting}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3
            hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-xl shadow-indigo-600/25
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          {starting ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              Starting Exam...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              Start Exam Now
            </>
          )}
        </button>

        <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          Timer begins immediately upon starting
        </p>
      </div>

    </div>
    </div>
  );
};

export default ExamDetail;
