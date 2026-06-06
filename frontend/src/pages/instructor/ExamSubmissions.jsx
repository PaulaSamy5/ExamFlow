import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { Users, User, ArrowLeft, Download, Search, Filter, TrendingUp, Calendar, Clock, Award, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const ExamSubmissions = () => {
  const { id } = useParams(); // examId
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, examRes] = await Promise.all([
          api.get(`/submissions/exam/${id}`),
          api.get(`/exams/${id}`)
        ]);
        setSubmissions(subRes.data);
        setExam(examRes.data);
      } catch (err) {
        toast.error('Failed to retrieve submission roster');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const filtered = submissions
    .filter(s => 
      s.studentName.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      s.studentEmail.toLowerCase().includes(searchTerm.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'time') {
        const timeA = new Date(a.submittedAt).getTime();
        const timeB = new Date(b.submittedAt).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      } else {
        return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
      }
    });

  const toggleSort = () => {
    if (sortBy === 'time' && sortOrder === 'desc') {
       setSortBy('time'); setSortOrder('asc');
    } else if (sortBy === 'time' && sortOrder === 'asc') {
       setSortBy('score'); setSortOrder('desc');
    } else if (sortBy === 'score' && sortOrder === 'desc') {
       setSortBy('score'); setSortOrder('asc');
    } else {
       setSortBy('time'); setSortOrder('desc');
    }
  };

  const handleSortSelect = (type, order) => {
    setSortBy(type);
    setSortOrder(order);
    setIsSortOpen(false);
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="h-12 w-12 border-t-2 border-indigo-500 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Compiling Student Roster...</p>
    </div>
  );

  const avgScore = submissions.length > 0 
    ? (submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-12 pb-24 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <header className="space-y-8 px-2 mt-8">
        <button onClick={() => navigate('/instructor/dashboard')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-500 transition-all group w-fit">
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
             {/* Text Content */}
             <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    Grade Center & Analytics
                  </span>
                </div>
                
                <div>
                  <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">
                    {exam?.title}
                  </h1>
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <span className="text-indigo-500">Official Roster</span> 
                    <span className="text-slate-300 dark:text-slate-700">•</span> 
                    Performance Overview
                  </div>
                </div>
             </div>

             {/* Right Action Bar */}
             <div className="flex flex-col sm:flex-row items-center gap-4">
               {/* Stats Matrix */}
               <div className="flex items-center gap-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="space-y-1 text-center">
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Enrolled</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{submissions.length}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1 text-center">
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Average</p>
                    <p className="text-2xl font-black text-indigo-500 leading-none">{avgScore}</p>
                  </div>
               </div>

                <button 
                  onClick={() => {
                   const timestamp = format(new Date(), 'MMM dd, yyyy hh:mm a');
                   const avgNum = submissions.length > 0 ? submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length : 0;
                   const avg = avgNum.toFixed(2);
                   
                   const tableHtml = `
                      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                      <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Results Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
                      <body>
                      <table border="1" style="border-collapse: collapse; font-family: 'Segoe UI', Tahoma, sans-serif;">
                        <tr><th colspan="6" style="background-color: #0f172a; color: #ffffff; font-size: 20px; padding: 20px;">EXAMFLOW | ASSESSMENT INTELLIGENCE REPORT</th></tr>
                        <tr>
                          <th colspan="3" style="background-color: #1e293b; color: #94a3b8; padding: 10px; text-align: left;">Assmt Title: ${exam?.title || 'Report'}</th>
                          <th colspan="3" style="background-color: #1e293b; color: #94a3b8; padding: 10px; text-align: right;">Export Timestamp: ${timestamp}</th>
                        </tr>
                        <tr style="background-color: #4f46e5; color: #ffffff;">
                          <th style="padding: 12px; width: 200px;">Student Name</th>
                          <th style="padding: 12px; width: 250px;">Internal Email</th>
                          <th style="padding: 12px; width: 180px;">Submission Link</th>
                          <th style="padding: 12px; width: 100px;">Raw Score</th>
                          <th style="padding: 12px; width: 100px;">Total Grade</th>
                          <th style="padding: 12px; width: 100px;">Performance %</th>
                        </tr>
                        ${filtered.map((s, i) => {
                          const perc = ((s.score / (exam?.totalGrade || 1)) * 100).toFixed(1);
                          const rowColor = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
                          const scoreColor = s.score >= (exam?.totalGrade || 0) * 0.5 ? '#16a34a' : '#dc2626';
                          return `
                          <tr style="background-color: ${rowColor}; color: #334155;">
                            <td style="padding: 8px;">${s.studentName}</td>
                            <td style="padding: 8px;">${s.studentEmail}</td>
                            <td style="padding: 8px;">${format(new Date(s.submittedAt), 'MM/dd/yy hh:mm a')}</td>
                            <td style="padding: 8px; text-align: center; font-weight: bold; color: ${scoreColor};">${s.score}</td>
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
                  className="flex h-[76px] items-center justify-center gap-3 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[11px] transition-all transform active:scale-95 shadow-lg shadow-indigo-500/20 w-full sm:w-auto group/btn"
                >
                  <Download className="h-4 w-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                  Export CSV
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Analytics Toolbar */}
      <section className="space-y-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-2">
           <div className="relative flex-1 w-full lg:max-w-xl group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-[2rem] blur opacity-0 group-focus-within:opacity-20 transition duration-500"></div>
              <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] h-14 flex items-center px-5 shadow-sm">
                 <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Search student by name or university email..."
                   className="w-full h-full bg-transparent border-none focus:outline-none pl-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-500 placeholder:font-medium"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
                 {searchTerm && (
                   <button onClick={() => setSearchTerm('')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                     <X className="h-4 w-4" />
                   </button>
                 )}
              </div>
           </div>

           <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/50 w-full lg:w-auto overflow-x-auto hide-scrollbar">
              <div className="px-4 py-2 flex items-center gap-2 shrink-0">
                 <Filter className="h-4 w-4 text-slate-400" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sort Matrix</span>
              </div>
              {[
                { label: 'Latest Date', type: 'time', order: 'desc' },
                { label: 'Oldest', type: 'time', order: 'asc' },
                { label: 'Highest Pts', type: 'score', order: 'desc' },
                { label: 'Lowest Pts', type: 'score', order: 'asc' }
              ].map((opt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSortBy(opt.type);
                    setSortOrder(opt.order);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                    sortBy === opt.type && sortOrder === opt.order
                      ? 'bg-white dark:bg-slate-900 text-indigo-500 shadow-md shadow-slate-200/50 dark:shadow-black/20'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
           </div>
        </div>

        {/* Submissions List */}
        <div className="grid grid-cols-1 gap-4 px-2">
           {filtered.length > 0 ? filtered.map((sub, idx) => {
             const percentage = ((sub.score / (exam?.totalGrade || 1)) * 100);
             const isPass = percentage >= 50;
             const isExcellent = percentage >= 85;

             return (
             <Link key={sub.id} to={`/submissions/${sub.id}`} className="group relative block overflow-hidden rounded-[2rem] bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 p-6 lg:p-8 transition-all hover:shadow-2xl hover:border-indigo-500/30">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-800 transition-colors group-hover:bg-indigo-500" />
                
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                   
                   {/* Student Identity */}
                   <div className="flex items-center gap-6 min-w-0 flex-1">
                      <div className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center relative z-10 group-hover:bg-indigo-500 group-hover:border-indigo-400 transition-all duration-500">
                           <User className="h-7 w-7 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                        <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                      </div>
                      <div className="space-y-1 min-w-0">
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">{sub.studentName}</h3>
                         <p className="text-sm font-medium text-slate-500 truncate">{sub.studentEmail}</p>
                      </div>
                   </div>

                   {/* Metrics Matrix */}
                   <div className="grid grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-16">
                      <div className="space-y-2">
                         <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                           <Clock className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" /> Timestamp
                         </span>
                         <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {format(new Date(sub.submittedAt), 'MMMM dd, yyyy')} <br />
                            <span className="text-xs text-slate-400 font-bold">{format(new Date(sub.submittedAt), 'hh:mm a')}</span>
                         </div>
                      </div>

                      <div className="space-y-2">
                         <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                           <Award className="h-3.5 w-3.5 text-slate-400 group-hover:text-fuchsia-400 transition-colors" /> Final Grade
                         </span>
                         <div className="flex items-end gap-3 text-slate-900 dark:text-white">
                            <span className={`text-3xl font-black tracking-tighter leading-none ${isExcellent ? 'text-emerald-500' : isPass ? 'text-indigo-400' : 'text-rose-500'}`}>
                              {sub.score}
                            </span>
                            <span className="text-sm font-bold text-slate-400 mb-1">/ {exam?.totalGrade}</span>
                         </div>
                      </div>
                   </div>

                   {/* Action End */}
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
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">No Results Directory</h3>
                <p className="text-slate-500 font-medium text-lg mx-auto max-w-sm leading-relaxed">
                  {searchTerm ? 'Your search query yielded no matching students.' : 'Awaiting student submissions for this assessment.'}
                </p>
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="mt-8 px-6 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
                    Clear Search Matrix
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
