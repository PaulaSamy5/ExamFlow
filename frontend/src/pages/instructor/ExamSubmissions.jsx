import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import {
  Users, User, ArrowLeft, Download, Search, Filter,
  TrendingUp, Clock, Award, ChevronRight, X, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const ExamSubmissions = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (!id) {
      setFetchError('No exam ID was provided in the URL.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setFetchError(null);
        const [subRes, examRes] = await Promise.all([
          api.get(`/submissions/exam/${id}`),
          api.get(`/exams/${id}`)
        ]);

        const rawSubs = Array.isArray(subRes.data) ? subRes.data : [];
        // Data-integrity guard: every submission must have a student name since
        // only authenticated students can submit. Log broken records so they
        // are immediately visible during debugging.
        const broken = rawSubs.filter(s => !s.studentName);
        if (broken.length > 0) {
          console.error(
            `[ExamSubmissions] ${broken.length} submission(s) are missing studentName — ` +
            `possible JOIN/camelCase issue in the backend. Submission IDs: ` +
            broken.map(s => s.id).join(', ')
          );
        }
        setSubmissions(rawSubs);
        setExam(examRes.data ?? null);
      } catch (err) {
        console.error('[ExamSubmissions] fetch error:', err);
        const status = err?.response?.status;
        if (status === 404) {
          setFetchError('This exam could not be found. It may have been deleted.');
        } else if (status === 403) {
          setFetchError('You do not have permission to view submissions for this exam.');
        } else {
          setFetchError('Failed to load submissions. Please check your connection and try again.');
        }
        toast.error('Failed to retrieve submission roster');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 border-t-2 border-indigo-500 rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
          Compiling Student Roster...
        </p>
      </div>
    );
  }

  // ── Error state ──
  if (fetchError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 text-center animate-fade-in">
        <div className="p-5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
          <AlertCircle className="h-10 w-10 text-rose-500" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Something went wrong</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{fetchError}</p>
        </div>
        <button
          onClick={() => navigate('/instructor/dashboard')}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ── Derived data ──
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];

  const filtered = safeSubmissions
    .filter(s => {
      const name = s.studentName ?? '';
      const email = s.studentEmail ?? '';
      const q = searchTerm.trim().toLowerCase();
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'time') {
        const tA = new Date(a.submittedAt).getTime() || 0;
        const tB = new Date(b.submittedAt).getTime() || 0;
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      }
      const sA = a.score ?? 0;
      const sB = b.score ?? 0;
      return sortOrder === 'desc' ? sB - sA : sA - sB;
    });

  const avgScore = safeSubmissions.length > 0
    ? (safeSubmissions.reduce((acc, s) => acc + (s.score ?? 0), 0) / safeSubmissions.length).toFixed(1)
    : '—';

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'MMMM dd, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  const formatTime = (dateStr) => {
    try {
      return format(new Date(dateStr), 'hh:mm a');
    } catch {
      return '';
    }
  };

  // ── Main render ──
  return (
    <div className="space-y-12 pb-24 animate-fade-in max-w-6xl mx-auto">

      {/* Header */}
      <header className="space-y-8 px-2 mt-8">
        <button
          onClick={() => navigate('/instructor/dashboard')}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-500 transition-all group w-fit"
        >
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 group-hover:bg-indigo-500/10 border border-slate-200 dark:border-slate-800 group-hover:border-indigo-500/30 transition-all">
            <ArrowLeft className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 group-hover:text-indigo-500 group-hover:-translate-x-0.5 transition-all" />
          </div>
          Return to Dashboard
        </button>

        <div className="relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800/60 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl overflow-hidden group">
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none dark:from-indigo-500/10" />
          <div className="absolute -right-8 -top-8 opacity-[0.03] pointer-events-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-1000">
            <TrendingUp className="h-[250px] w-[250px] text-slate-900 dark:text-white" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            {/* Title */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Grade Center &amp; Analytics
                </span>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">
                  {exam?.title ?? 'Exam Submissions'}
                </h1>
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <span className="text-indigo-500">Official Roster</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  Performance Overview
                </div>
              </div>
            </div>

            {/* Stats + Export */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm w-full sm:w-auto mt-4 sm:mt-0">
                <div className="space-y-1 text-center">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Enrolled</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{safeSubmissions.length}</p>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1 text-center">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Average</p>
                  <p className="text-2xl font-black text-indigo-500 leading-none">{avgScore}</p>
                </div>
              </div>

              <button
                disabled={safeSubmissions.length === 0}
                onClick={() => {
                  const timestamp = format(new Date(), 'MMM dd, yyyy hh:mm a');
                  const avgNum = safeSubmissions.length > 0
                    ? safeSubmissions.reduce((acc, s) => acc + (s.score ?? 0), 0) / safeSubmissions.length
                    : 0;
                  const avg = avgNum.toFixed(2);

                  const tableHtml = `
                    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                    <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Results Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
                    <body>
                    <table border="1" style="border-collapse: collapse; font-family: 'Segoe UI', Tahoma, sans-serif;">
                      <tr><th colspan="6" style="background-color: #0f172a; color: #ffffff; font-size: 20px; padding: 20px;">EXAMFLOW | ASSESSMENT INTELLIGENCE REPORT</th></tr>
                      <tr>
                        <th colspan="3" style="background-color: #1e293b; color: #94a3b8; padding: 10px; text-align: left;">Assmt Title: ${exam?.title || 'Report'}</th>
                        <th colspan="3" style="background-color: #1e293b; color: #94a3b8; padding: 10px; text-align: right;">Export: ${timestamp} · Avg: ${avg}</th>
                      </tr>
                      <tr style="background-color: #4f46e5; color: #ffffff;">
                        <th style="padding: 12px;">Student Name</th>
                        <th style="padding: 12px;">Email</th>
                        <th style="padding: 12px;">Submitted At</th>
                        <th style="padding: 12px;">Score</th>
                        <th style="padding: 12px;">Total</th>
                        <th style="padding: 12px;">%</th>
                      </tr>
                      ${filtered.map((s, i) => {
                        const perc = ((( s.score ?? 0) / (exam?.totalGrade || 1)) * 100).toFixed(1);
                        const rowColor = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
                        const scoreColor = (s.score ?? 0) >= (exam?.totalGrade || 0) * 0.5 ? '#16a34a' : '#dc2626';
                        return `
                        <tr style="background-color: ${rowColor}; color: #334155;">
                          <td style="padding: 8px;">${s.studentName ?? ''}</td>
                          <td style="padding: 8px;">${s.studentEmail ?? ''}</td>
                          <td style="padding: 8px;">${formatDate(s.submittedAt)} ${formatTime(s.submittedAt)}</td>
                          <td style="padding: 8px; text-align: center; font-weight: bold; color: ${scoreColor};">${s.score ?? 0}</td>
                          <td style="padding: 8px; text-align: center;">${exam?.totalGrade || 0}</td>
                          <td style="padding: 8px; text-align: center; font-weight: 800; background-color: #e0e7ff;">${perc}%</td>
                        </tr>`;
                      }).join('')}
                    </table>
                    </body></html>
                  `;

                  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Grades_Export_${exam?.title || 'Exam'}.xls`;
                  a.click();
                  toast.success('Official Grades Exported', { icon: '📊' });
                }}
                className="flex h-[76px] items-center justify-center gap-3 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[11px] transition-all transform active:scale-95 shadow-lg shadow-indigo-500/20 w-full sm:w-auto group/btn"
              >
                <Download className="h-4 w-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar + List */}
      <section className="space-y-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-2">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-xl group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-[2rem] blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] h-14 flex items-center px-5 shadow-sm">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors shrink-0" />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="w-full h-full bg-transparent border-none focus:outline-none pl-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-500 placeholder:font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/50 w-full lg:w-auto overflow-x-auto">
            {/* Label — non-interactive, clearly a section label */}
            <div className="flex items-center gap-1.5 pl-3 pr-2 shrink-0 opacity-50">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sort by</span>
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 shrink-0" />
            {[
              { label: 'Latest', type: 'time', order: 'desc' },
              { label: 'Oldest', type: 'time', order: 'asc' },
              { label: 'Highest', type: 'score', order: 'desc' },
              { label: 'Lowest', type: 'score', order: 'asc' }
            ].map((opt, i) => (
              <button
                key={i}
                onClick={() => { setSortBy(opt.type); setSortOrder(opt.order); }}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                  sortBy === opt.type && sortOrder === opt.order
                    ? 'bg-white dark:bg-slate-900 text-indigo-500 shadow-md'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions list */}
        <div className="grid grid-cols-1 gap-4 px-2">
          {filtered.length > 0 ? filtered.map((sub) => {
            const score = sub.score ?? 0;
            const total = exam?.totalGrade || 1;
            const percentage = (score / total) * 100;
            const isExcellent = percentage >= 85;
            const isPass = percentage >= 50;

            return (
              <Link
                key={sub.id}
                to={`/submissions/${sub.id}`}
                className="group relative block overflow-hidden rounded-[2rem] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 p-6 lg:p-8 transition-all hover:shadow-2xl hover:border-indigo-500/30"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-800 transition-colors group-hover:bg-indigo-500" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  {/* Student Identity */}
                  <div className="flex items-center gap-6 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center relative z-10 group-hover:bg-indigo-500 group-hover:border-indigo-400 transition-all duration-500">
                        <User className="h-7 w-7 text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      {sub.studentName ? (
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">
                            {sub.studentName}
                          </h3>
                          {sub.terminationReason && (
                            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
                              Terminated
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-rose-500 truncate">
                            [Student data missing]
                          </h3>
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded-full">
                            Data Error
                          </span>
                        </div>
                      )}
                      <p className="text-sm font-medium text-slate-500 truncate">
                        {sub.studentEmail ?? <span className="text-rose-400 italic text-xs">No email returned</span>}
                      </p>
                      {sub.terminationReason && (
                        <div className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider bg-rose-500/10 dark:bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/10">Violation:</span>
                          <span>{sub.terminationReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-8 lg:gap-16">
                    <div className="space-y-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Clock className="h-3.5 w-3.5" /> Submitted
                      </span>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatDate(sub.submittedAt)}<br />
                        <span className="text-xs text-slate-400 font-bold">{formatTime(sub.submittedAt)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Award className="h-3.5 w-3.5" /> Final Grade
                      </span>
                      <div className="flex items-end gap-3">
                        <span className={`text-3xl font-black tracking-tighter leading-none ${
                          isExcellent ? 'text-emerald-500' : isPass ? 'text-indigo-400' : 'text-rose-500'
                        }`}>
                          {score}
                        </span>
                        <span className="text-sm font-bold text-slate-400 mb-1">/ {exam?.totalGrade ?? '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="hidden lg:flex items-center justify-end pl-8 border-l border-slate-100 dark:border-slate-800">
                    <div className="h-12 w-12 rounded-[1rem] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 group-hover:border-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                      <ChevronRight className="h-6 w-6 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          }) : (
            <div className="rounded-[3rem] bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm border-2 border-dashed border-slate-200 dark:border-slate-800 p-24 text-center mt-8">
              <div className="h-24 w-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center p-6 border-8 border-white dark:border-slate-950 shadow-inner">
                <Users className="h-full w-full text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                {searchTerm ? 'No Matching Students' : 'No Submissions Yet'}
              </h3>
              <p className="text-slate-500 font-medium text-lg mx-auto max-w-sm leading-relaxed">
                {searchTerm
                  ? 'Your search yielded no matching students. Try a different name or email.'
                  : 'No students have submitted this exam yet. Check back later.'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-8 px-6 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ExamSubmissions;
