import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  Shield, Users, BookOpen, FileText, Activity, Server, Trash2, 
  ChevronDown, BarChart3, UserCheck, UserX, GraduationCap, Award,
  TrendingUp, TrendingDown, MousePointer2, Clock, Globe, Download,
  AlertTriangle, CheckCircle2, MoreVertical, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Loader2 } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Platform Overview', icon: BarChart3 },
  { id: 'analytics', label: 'Site Traffic', icon: Globe },
  { id: 'users', label: 'User Directory', icon: Users },
  { id: 'activity', label: 'User Activity', icon: Activity },
  { id: 'system', label: 'System Health', icon: Server },
];

const StatCard = ({ icon: Icon, label, value, trend, trendValue, sub, colorName = 'indigo' }) => {
  const colorMap = {
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  };
  
  const colors = colorMap[colorName] || colorMap.indigo;

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 group flex justify-between items-start">
      <div>
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 mb-2">
          <span className="text-[28px] leading-none font-semibold text-slate-900 dark:text-white tracking-tight">{value}</span>
        </div>
        {(trend || sub) && (
          <div className="flex items-center gap-1.5">
            {trend && (
              <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-slate-500'}`}>
                {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                {trendValue}
              </span>
            )}
            {sub && <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{sub}</span>}
          </div>
        )}
      </div>

      {Icon && (
        <div className={`p-2.5 rounded-[14px] border ${colors} group-hover:rotate-6 group-hover:scale-110 transition-all duration-300 shadow-sm`}>
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
};

const ChartTooltip = ({ active, payload, label, isPie = false }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-md border border-slate-700/50 dark:border-slate-600/50 rounded-2xl p-4 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5 min-w-[160px]">
        {!isPie && label && (
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700/50 pb-2">
            {new Date(label).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <div className="space-y-2.5">
          {payload.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.payload.fill || item.color || item.stroke }}></div>
                <span className="text-[11px] font-bold text-slate-300 capitalize">
                  {isPie ? item.name : item.name.replace(/([A-Z])/g, ' $1')}
                </span>
              </div>
              <span className="text-[11px] font-black text-white tracking-tight">
                {item.value.toLocaleString()}
                {isPie && ' Users'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [sysInfo, setSysInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Deletion States
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const closeModal = () => {
    if (isDeleting) return;
    setIsClosing(true);
    setTimeout(() => {
      setUserToDelete(null);
      setIsClosing(false);
    }, 250);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes, sysRes, analyticsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users'),
        api.get('/admin/system'),
        api.get('/analytics/stats')
      ]);
      setStats(dashRes.data);
      setUsers(usersRes.data);
      setSysInfo(sysRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      toast.error('Failed to synchronize dashboard data');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (!user || user.role !== 'ADMIN') return <Navigate to="/login" replace />;

  const handleExport = async (type) => {
    try {
      const response = await api.get(`/analytics/export?type=${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      toast.success(`${type} report exported successfully`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || isDeleting) return;
    if (userToDelete.id === user.id) {
      toast.error("You cannot delete your own account.");
      setUserToDelete(null);
      return;
    }
    
    setIsDeleting(true);
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      setUsers(users.filter(u => u.id !== userToDelete.id));
      toast.success(`${userToDelete.name}'s account has been securely removed.`);
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user.');
    }
    setIsDeleting(false);
  };

  const roleBadge = (role) => {
    const variants = {
      ADMIN: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      INSTRUCTOR: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      STUDENT: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
    return <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${variants[role] || variants.STUDENT}`}>{role}</span>;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-indigo-500 animate-spin"></div>
        <Zap className="h-6 w-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Insights...</p>
    </div>
  );

  const o = stats?.overview || {};
  const a = analytics?.stats || {};

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* ─── Header Section ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-4 rounded-3xl shadow-2xl shadow-indigo-500/20 group hover:rotate-6 transition-transform">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Admin Console</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Overview</span>
              <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Real-time Active
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleExport('visitors')}
            className="group flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-indigo-500/40 hover:text-indigo-500 transition-all shadow-sm btn-lift"
          >
            <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            Export Intel
          </button>
          <button 
            onClick={loadData}
            className="p-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all active:scale-95 btn-lift"
          >
            <Activity className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ─── Smart Flags (Insights) ─── */}
      {analytics?.flags?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.flags.map((flag, idx) => (
            <div key={idx} className="flex items-start gap-4 p-4 rounded-3xl bg-amber-500/5 border border-amber-500/10 group hover:border-amber-500/30 transition-all">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Business Intelligence</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{flag.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Custom Tabs UI ─── */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-2 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap btn-lift ${tab === t.id ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <t.icon className={`h-4 w-4 ${tab === t.id ? 'text-indigo-500' : 'text-slate-400'}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Content Areas ─── */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* ── PERFORMANCE OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-8">
            <div className="mb-6 flex flex-col gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Platform Performance</h2>
              <p className="text-sm text-slate-500 font-medium">Real-time insights into user engagement, academic progress, and system growth.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 flex flex-col justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Registrations</p>
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 group-hover:rotate-6 transition-all"><Users className="h-5 w-5" /></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{o.totalUsers}</h3>
                  <p className="text-xs text-slate-400 font-bold">Total Accounts Created</p>
                </div>
                {/* Health Indicator */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                   <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                     <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                     Active Growth
                   </span>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 flex flex-col justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Exams</p>
                    <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500 group-hover:scale-110 group-hover:rotate-6 transition-all"><BookOpen className="h-5 w-5" /></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{o.totalExams}</h3>
                  <p className="text-xs text-slate-400 font-bold">Total Assessments Created</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                   <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                     Course Content
                   </span>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 flex flex-col justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Submissions</p>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-110 group-hover:rotate-6 transition-all"><FileText className="h-5 w-5" /></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{o.totalSubmissions}</h3>
                  <p className="text-xs text-slate-400 font-bold">Total Exam Attempts</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                   <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${o.totalSubmissions > 0 ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-500/10' : 'text-amber-600 dark:text-amber-500 bg-amber-500/10'}`}>
                     {o.totalSubmissions > 0 ? 'Consistent Participation' : 'Low Activity'}
                   </span>
                </div>
              </div>

              <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] p-6 flex flex-col justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Grades</p>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 group-hover:rotate-6 transition-all"><Award className="h-5 w-5" /></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{o.averageScore}%</h3>
                  <p className="text-xs text-slate-400 font-bold">Average Student Score</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                   <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${o.averageScore >= 70 ? 'text-emerald-600 dark:text-emerald-500 bg-emerald-500/10' : o.averageScore >= 50 ? 'text-amber-600 dark:text-amber-500 bg-amber-500/10' : 'text-rose-600 dark:text-rose-500 bg-rose-500/10'}`}>
                     {o.averageScore >= 70 ? 'High Achievement' : o.averageScore >= 50 ? 'Stable' : 'Needs Review'}
                   </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Left Column: Engagement Funnel */}
              <div className="flex flex-col gap-10">
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 flex flex-col h-full">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-2">User Conversion Funnel</h3>
                  <p className="text-xs text-slate-500 font-medium mb-8">Comparing site visitors to actual active participants</p>
                  
                  <div className="space-y-6 flex-1 flex flex-col justify-center">
                      {(() => {
                       const maxFunnelValue = Math.max(a.uniqueVisitors || 0, o.totalUsers || 0, o.activeStudents || 0, 1);
                       const wVisitors = (a.uniqueVisitors * 100) / maxFunnelValue;
                       const wUsers = (o.totalUsers * 100) / maxFunnelValue;
                       const wActive = (o.activeStudents * 100) / maxFunnelValue;
                       const activeRate = o.totalUsers > 0 ? Math.min(100, Math.round((o.activeStudents * 100) / o.totalUsers)) : 0;
                       
                       return (
                         <>
                           {/* Step 1: Visitors */}
                           <div className="relative group">
                              <div className="flex justify-between items-end mb-2.5">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 group-hover:scale-110 group-hover:-rotate-6 transition-transform"><Globe className="h-5 w-5" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Website Visitors</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total people who opened the site</p>
                                  </div>
                                </div>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{a.uniqueVisitors}</p>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-slate-400 dark:bg-slate-600 rounded-full transition-all duration-1000" style={{ width: wVisitors + '%' }}></div>
                              </div>
                           </div>

                           {/* Step 2: Registered */}
                           <div className="relative group">
                              <div className="absolute -top-5 left-[22px] h-5 w-[2px] bg-slate-100 dark:bg-slate-800"></div>
                              <div className="flex justify-between items-end mb-2.5">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl group-hover:scale-110 group-hover:-rotate-6 transition-transform"><UserCheck className="h-5 w-5" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Created Accounts</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">People who signed up</p>
                                  </div>
                                </div>
                                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{o.totalUsers}</p>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: wUsers + '%' }}></div>
                              </div>
                           </div>

                           {/* Step 3: Active Students */}
                           <div className="relative group">
                              <div className="absolute -top-5 left-[22px] h-5 w-[2px] bg-slate-100 dark:bg-slate-800"></div>
                              <div className="flex justify-between items-end mb-2.5">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:scale-110 group-hover:-rotate-6 transition-transform"><Zap className="h-5 w-5" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Active Exam Takers</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">People who submitted at least one exam</p>
                                  </div>
                                </div>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{o.activeStudents}</p>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: wActive + '%' }}></div>
                              </div>
                           </div>
                         
                         <div className="mt-12 pt-6 border-t border-slate-100 dark:border-slate-800/60">
                           <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center justify-between">
                             <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-0.5">
                                   <Activity className="h-4 w-4 text-emerald-500" />
                                   <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Active User Percentage</span>
                                </div>
                                <span className="text-[9px] text-emerald-600/70 dark:text-emerald-500/70 font-bold">Ratio of registered users who are actively taking exams</span>
                             </div>
                             <span className="text-2xl font-black text-emerald-600 dark:text-emerald-500">
                               {activeRate}%
                             </span>
                           </div>
                         </div>
                       </>
                       );
                      })()}
                  </div>
                </div>
              </div>

              {/* Right Column: Traffic Trend Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 flex flex-col h-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Daily Traffic Trend</h3>
                    <p className="text-xs text-slate-500 font-medium">Total interactions vs individual visitors</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-[4px] bg-indigo-500/20 border border-indigo-500"></div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Total Interactions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-[4px] bg-emerald-500"></div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Individual Visitors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-[4px] bg-violet-500"></div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Logged In Users</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 h-[280px] w-full mt-2 relative outline-none focus:outline-none ring-0">
                  {(() => {
                    const trendData = analytics?.dailyTrend || [];
                    
                    if (trendData.length === 0) {
                      return (
                         <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800/20 rounded-[1.5rem] border border-dashed border-slate-200 dark:border-slate-700 p-8">
                           <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
                             <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                           </div>
                           <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Not enough analytics data yet</p>
                           <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 max-w-[250px] text-center leading-relaxed">Active usage trends will appear here automatically as users visit the platform.</p>
                         </div>
                      );
                    }

                    // Pad single data point with a zero-point for yesterday so the chart draws a visible line
                    let chartData = [...trendData];
                    if (chartData.length === 1) {
                      const today = new Date(chartData[0].date);
                      const yesterday = new Date(today);
                      yesterday.setDate(today.getDate() - 1);
                      chartData = [
                        { date: yesterday.toISOString(), visitors: 0, loggedInUsers: 0, pageViews: 0 },
                        chartData[0]
                      ];
                    }


                    return (
                       <ResponsiveContainer width="100%" height={280} className="outline-none focus:outline-none ring-0 select-none border-none">
                         <AreaChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
                           <defs>
                             <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                             </linearGradient>
                             {/* Glow Filter for Active Users */}
                             <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                               <feGaussianBlur stdDeviation="3" result="blur" />
                               <feComposite in="SourceGraphic" in2="blur" operator="over" />
                             </filter>
                           </defs>
                           
                           <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" opacity={0.1} />
                           
                           <XAxis 
                             dataKey="date" 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} 
                             dy={10} 
                             tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} 
                           />
                           
                           {/* Primary Axis: Visits (Large Scale) */}
                             <YAxis 
                               yAxisId="left"
                               axisLine={false} 
                               tickLine={false} 
                               tick={{fontSize: 10, fill: '#6366f1', fontWeight: 700}} 
                             />
                             
                             {/* Secondary Axis: People (Small Scale) - Hidden but active for scaling */}
                             <YAxis 
                               yAxisId="right"
                               orientation="right"
                               hide={true}
                               domain={[0, 'dataMax + 2']}
                             />

                             <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.4 }} />
                             
                             {/* High-volume line: Total Interactions (Left Axis) */}
                             <Area 
                               yAxisId="left"
                               type="monotone" 
                               name="Total Interactions" 
                               dataKey="pageViews" 
                               stroke="#6366f1" 
                               strokeWidth={4} 
                               fillOpacity={1} 
                               fill="url(#colorViews)" 
                               activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} 
                             />
                           
                           {/* Low-volume lines: People (Right Axis) */}
                           <Area 
                             yAxisId="right"
                             type="monotone" 
                             name="Individual Visitors" 
                             dataKey="visitors" 
                             stroke="#10b981" 
                             strokeWidth={4} 
                             strokeDasharray="5 5" 
                             fillOpacity={0} 
                             activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} 
                           />
                           
                           <Area 
                             yAxisId="right"
                             type="monotone" 
                             name="Logged In Users" 
                             dataKey="loggedInUsers" 
                             stroke="#8b5cf6" 
                             strokeWidth={4} 
                             fillOpacity={0.1} 
                             fill="url(#colorUsers)" 
                             activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: '#8b5cf6' }}
                             style={{ filter: 'url(#glow)' }}
                           />
                         </AreaChart>
                       </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VISITOR ANALYTICS ── */}
        {tab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <StatCard icon={Globe} colorName="blue" label="Individual Visitors" value={a.uniqueVisitors} sub="Past 30 Days" />
               <StatCard icon={MousePointer2} colorName="indigo" label="Total Website Visits" value={a.totalViews} sub="Past 30 Days" />
               <StatCard icon={Clock} colorName="emerald" label="Average Time Spent" value={`${a.avgDuration}s`} sub="Session Quality" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Popular Pages */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                      <MousePointer2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Most Visited Pages</h3>
                      <p className="text-xs text-slate-500 font-medium">Which parts of the website are most popular</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  {analytics?.topPages?.map((page, i) => {
                    const maxViews = analytics?.topPages?.length > 0 ? Math.max(...analytics.topPages.map(p => p.views)) : 1;
                    const percentage = (page.views / maxViews) * 100;
                    const isTop = i === 0;
                    const isTrending = i === 1 || i === 2;

                    return (
                      <div key={i} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[1.5rem] hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-300 gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`h-10 w-10 shrink-0 rounded-[14px] flex items-center justify-center text-xs font-black transition-colors ${isTop ? 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                            {i + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-xl tracking-tight font-mono truncate max-w-[200px] sm:max-w-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {page.url}
                              </span>
                              {isTop && (
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 dark:text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg uppercase tracking-widest">
                                  🔥 Most Visited
                                </span>
                              )}
                              {!isTop && isTrending && (
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg uppercase tracking-widest">
                                  ↑ Trending
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 w-full max-w-[240px]">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 sm:gap-10 sm:justify-end shrink-0 pl-14 sm:pl-0">
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{page.uniqueViews.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unique</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{page.views.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-widest">Views</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!analytics?.topPages || analytics.topPages.length === 0) && (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                      <Activity className="h-8 w-8 mb-3 opacity-20" />
                      <p className="text-sm font-medium">No page views recorded yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Returning Visitor Chart */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8">
                 <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-2">Visitor Retention</h3>
                 <p className="text-xs text-slate-500 font-medium mb-8">New vs Returning breakdown</p>
                 <div className="h-[300px] flex items-center justify-center relative">
                    {a.newVisitors > 0 || a.returningVisitors > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'New', value: a.newVisitors || 0 },
                                { name: 'Returning', value: a.returningVisitors || 0 }
                              ]}
                              innerRadius={80}
                              outerRadius={110}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#6366f1" />
                              <Cell fill="#10b981" />
                            </Pie>
                            <Tooltip content={<ChartTooltip isPie={true} />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <p className="text-2xl font-black text-slate-900 dark:text-white">{Math.round((a.returningVisitors / (a.newVisitors + a.returningVisitors || 1)) * 100)}%</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Returning</p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-slate-400 dark:text-slate-500">
                        <p className="text-sm font-bold">No retention data yet</p>
                        <p className="text-xs mt-1">Requires visits from new/returning users.</p>
                      </div>
                    )}
                 </div>
                 <div className="flex justify-center gap-8 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-indigo-500"></div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">New Visitors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Returning</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USER MANAGEMENT ── */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {['ALL', 'STUDENT', 'INSTRUCTOR', 'ADMIN'].map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${roleFilter === r ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-indigo-500/30'}`}>
                    {r} {r !== 'ALL' && `(${users.filter(u => u.role === r).length})`}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleExport('users')}
                className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Download className="h-3 w-3" /> Export List
              </button>
            </div>
            
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Profile</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                      <th className="hidden sm:table-cell px-4 sm:px-8 py-4 sm:py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified</th>
                      <th className="hidden md:table-cell px-4 sm:px-8 py-4 sm:py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.filter(u => roleFilter === 'ALL' || u.role === roleFilter).map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-4 sm:px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-400 text-xs uppercase shrink-0">
                              {u.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-none">{u.name}</p>
                              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[120px] sm:max-w-none">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-8 py-4">{roleBadge(u.role)}</td>
                        <td className="hidden sm:table-cell px-4 sm:px-8 py-4">
                          {u.isVerified ? (
                            <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-wider">
                              <CheckCircle2 className="h-4 w-4" /> Verified
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-wider">
                              <AlertTriangle className="h-4 w-4" /> Pending
                            </div>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-4 sm:px-8 py-4 text-xs font-medium text-slate-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                        <td className="px-4 sm:px-8 py-4 text-right">
                          {u.id !== user.id ? (
                            <div className="flex items-center justify-end gap-2">
                               <button className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5 transition-all">
                                 <MoreVertical className="h-4 w-4" />
                               </button>
                               <button 
                                onClick={() => setUserToDelete(u)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 transition-all"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-3 py-1 bg-indigo-500/5 rounded-lg border border-indigo-500/10">Master Admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ENGAGEMENT & ACTIVITY ── */}
        {tab === 'activity' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Instructors */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 flex flex-col">
                <div className="mb-8 flex items-start justify-between">
                   <div>
                     <div className="flex items-center gap-2 mb-1">
                       <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Top Instructors</h3>
                       <div className="group relative flex items-center">
                         <div className="h-4 w-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-help">
                           <span className="text-[10px] font-bold text-slate-500">i</span>
                         </div>
                         <div className="absolute left-6 w-48 p-2.5 bg-slate-800 dark:bg-slate-700 rounded-xl text-[10px] font-medium text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl pointer-events-none">
                           Ranking based on the number of exams created by each instructor.
                         </div>
                       </div>
                     </div>
                     <p className="text-xs text-slate-500 font-medium">Ranked by number of exams created</p>
                   </div>
                </div>
                
                <div className="space-y-3">
                  {(stats?.instructorActivity || []).map((inst, i) => {
                    const maxExams = stats?.instructorActivity?.length > 0 ? Math.max(...stats.instructorActivity.map(x => x.examCount)) : 1;
                    const activityPercentage = (inst.examCount / maxExams) * 100;
                    
                    return (
                      <div key={i} className="flex flex-col p-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-300 group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 shrink-0 rounded-[12px] flex items-center justify-center text-xs font-black transition-colors ${i === 0 ? 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20' : i === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                              #{i + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{inst.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{inst.email}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-4">
                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-none">{inst.examCount}</p>
                            <p className="text-[9px] font-bold text-indigo-400/70 uppercase tracking-widest mt-1.5">Total Exams</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[4.5rem]">Activity Vol.</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${activityPercentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!stats?.instructorActivity || stats.instructorActivity.length === 0) && (
                    <div className="py-8 text-center text-slate-400 text-sm font-medium">No active instructors</div>
                  )}
                </div>
              </div>

              {/* Student Activity Feed */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 flex flex-col">
                <div className="mb-8 flex items-start justify-between">
                   <div>
                     <div className="flex items-center gap-2 mb-1">
                       <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Top Performing Students</h3>
                       <div className="group relative flex items-center">
                         <div className="h-4 w-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-help">
                           <span className="text-[10px] font-bold text-slate-500">i</span>
                         </div>
                         <div className="absolute left-6 w-56 p-2.5 bg-slate-800 dark:bg-slate-700 rounded-xl text-[10px] font-medium text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl pointer-events-none">
                           Ranking based on exam activity. Average Grade shows overall success across all completed assessments.
                         </div>
                       </div>
                     </div>
                     <p className="text-xs text-slate-500 font-medium">Ranked by exam activity and scores</p>
                   </div>
                </div>
                
                <div className="space-y-3">
                  {(stats?.studentActivity || []).slice(0, 6).map((s, i) => {
                     const avgScore = Math.round(s.avgScore || 0);
                     return (
                      <div key={i} className="flex flex-col p-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50 transition-all duration-300 group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-black text-xs transition-colors group-hover:bg-emerald-500/20">
                              {s.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate mb-1">{s.name}</p>
                              <span className="inline-flex items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                {s.submissionCount} Submissions Completed
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-4">
                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">{avgScore}%</p>
                            <p className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-widest mt-1.5">Average Grade</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest w-[4.5rem]">Performance</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${avgScore}%` }}></div>
                          </div>
                        </div>
                      </div>
                     );
                  })}
                  {(!stats?.studentActivity || stats.studentActivity.length === 0) && (
                    <div className="py-8 text-center text-slate-400 text-sm font-medium">No active students</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SYSTEM HEALTH ── */}
        {tab === 'system' && (
          <div className="space-y-8">
            <div className="mb-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">System Health</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Application-level status — updated on each page load.</p>
            </div>

            {/* ── Service Status Badges ── */}
            {sysInfo && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Backend API',
                    status: sysInfo.services?.backend,
                    icon: Server,
                    desc: 'Node.js / Express',
                  },
                  {
                    label: 'Database',
                    status: sysInfo.services?.database,
                    icon: Activity,
                    desc: 'PostgreSQL / Neon',
                  },
                  {
                    label: 'AI Service',
                    status: sysInfo.services?.aiService,
                    icon: Zap,
                    desc: 'FastAPI / Python',
                  },
                  {
                    label: 'Email Service',
                    status: sysInfo.services?.emailService,
                    icon: CheckCircle2,
                    desc: 'Brevo HTTP API',
                  },
                ].map(({ label, status, icon: Icon, desc }) => {
                  const isOnline = status === 'online' || status === 'configured';
                  const isOffline = status === 'offline';
                  const isDegraded = status === 'degraded';
                  const isUnknown = !status || status === 'unknown' || status === 'not_configured';

                  const colorClass = isOnline
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : isOffline
                    ? 'border-rose-500/20 bg-rose-500/5'
                    : isDegraded
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40';

                  const dotClass = isOnline
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : isOffline
                    ? 'bg-rose-500'
                    : isDegraded
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-slate-400';

                  const labelClass = isOnline
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isOffline
                    ? 'text-rose-600 dark:text-rose-400'
                    : isDegraded
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-500';

                  const statusLabel = isOnline
                    ? 'Operational'
                    : isOffline
                    ? 'Offline'
                    : isDegraded
                    ? 'Degraded'
                    : 'Not Configured';

                  return (
                    <div key={label} className={`rounded-2xl border p-5 flex flex-col gap-3 ${colorClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50">
                          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${dotClass} ${isOnline ? 'animate-pulse' : ''}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${labelClass}`}>{statusLabel}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{label}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* ── Platform Stats ── */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Platform Stats</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Live counts from the database</p>
                  </div>
                </div>
                {[
                  { k: 'Total Users', v: sysInfo?.platform?.totalUsers ?? '—', color: 'text-indigo-600 dark:text-indigo-400' },
                  { k: 'Total Exams', v: sysInfo?.platform?.totalExams ?? '—', color: 'text-violet-600 dark:text-violet-400' },
                  { k: 'Online Exams', v: sysInfo?.platform?.onlineExams ?? '—', color: 'text-blue-600 dark:text-blue-400' },
                  { k: 'Printable Exams', v: sysInfo?.platform?.printableExams ?? '—', color: 'text-amber-600 dark:text-amber-400' },
                  { k: 'Total Submissions', v: sysInfo?.platform?.totalSubmissions ?? '—', color: 'text-emerald-600 dark:text-emerald-400' },
                ].map((item) => (
                  <div key={item.k} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.k}</span>
                    <span className={`text-sm font-black ${item.color}`}>{item.v}</span>
                  </div>
                ))}
              </div>

               {/* ── Database Health ── */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Database Health</h3>
                    <p className="text-[11px] text-slate-500 font-medium">PostgreSQL on Neon (free tier)</p>
                  </div>
                </div>
                {[
                  { k: 'DB Engine', v: sysInfo?.database?.version || '—' },
                  { k: 'Active Tables', v: sysInfo?.database?.tables ? `${sysInfo.database.tables} tables` : '—' },
                  { 
                    k: 'Database Size', 
                    v: sysInfo?.database?.sizeFormatted || '—',
                    alertStyle: sysInfo?.database?.storageAlert?.alert ? 'text-rose-500 dark:text-rose-400 font-bold' : ''
                  },
                  { k: 'Connection', v: 'SSL / Encrypted' },
                  { k: 'Status', v: sysInfo?.database?.status === 'online' ? '✓ Connected' : '✗ Offline' },
                ].map((item) => (
                  <div key={item.k} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.k}</span>
                    <span className={`text-sm ${item.alertStyle || 'font-black text-slate-900 dark:text-white'}`}>{item.v}</span>
                  </div>
                ))}
              </div>

              {/* ── Server Info ── */}
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Backend Engine</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Node.js on Railway</p>
                  </div>
                </div>

                {/* Response Time Gauge */}
                {sysInfo?.server?.apiResponseTimeMs !== undefined && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Response Time</span>
                      <span className={`text-xs font-black ${sysInfo.server.apiResponseTimeMs < 300 ? 'text-emerald-500' : sysInfo.server.apiResponseTimeMs < 800 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {sysInfo.server.apiResponseTimeMs}ms
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${sysInfo.server.apiResponseTimeMs < 300 ? 'bg-emerald-500' : sysInfo.server.apiResponseTimeMs < 800 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, (sysInfo.server.apiResponseTimeMs / 2000) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                      {sysInfo.server.apiResponseTimeMs < 300 ? 'Excellent' : sysInfo.server.apiResponseTimeMs < 800 ? 'Acceptable' : 'Slow — check Railway logs'}
                    </p>
                  </div>
                )}

                {[
                  { k: 'Node Version', v: sysInfo?.server?.nodeVersion || '—' },
                  { k: 'Platform', v: sysInfo?.server?.platform || '—' },
                  { k: 'Environment', v: sysInfo?.server?.environment || '—' },
                  { k: 'Server Uptime', v: sysInfo?.server?.uptime || '—' },
                  { k: 'Heap Memory', v: sysInfo?.server?.memoryUsageMB ? `${sysInfo.server.memoryUsageMB} MB used` : '—' },
                ].map((item) => (
                  <div key={item.k} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.k}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white capitalize">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Database Low Space Warning ── */}
            {sysInfo?.database?.storageAlert?.alert && (
              <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex items-start gap-4 animate-pulse mb-6">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0 mt-0.5 animate-bounce">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-rose-600 dark:text-rose-400">CRITICAL: Database Storage Low!</p>
                  <p className="text-xs text-rose-500/80 dark:text-rose-400/80 font-medium mt-1 leading-relaxed">
                    Remaining storage: <strong className="text-rose-700 dark:text-rose-300">{sysInfo.database.storageAlert.remainingMB} MB</strong> / 512 MB.
                    The database is approaching its capacity limit. Please clean up old submissions/analytics or contact administration immediately.
                  </p>
                </div>
              </div>
            )}

            {/* ── Capacity Warning Banner ── */}
            {sysInfo?.database?.sizeFormatted && (
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex items-start gap-4">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">Free Tier Capacity Notice</p>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    Current DB size: <strong className="text-slate-700 dark:text-slate-300">{sysInfo.database.sizeFormatted}</strong> / 512 MB (Neon free tier limit).
                    Email service: <strong className="text-slate-700 dark:text-slate-300">300 emails/day</strong> (Brevo free tier).
                    Upgrade these services before scaling beyond ~100 concurrent users.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Delete Confirmation Modal ── */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'modal-overlay-exit' : 'modal-overlay-enter'}`} 
            onClick={closeModal} 
          />
          <div 
            className={`relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl shadow-black/20 p-8 max-w-sm w-full ${isClosing ? 'modal-exit' : 'modal-enter'}`}
          >
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Delete Account?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                You are about to permanently delete <strong>{userToDelete.name}</strong>. This action cannot be undone and will remove all their access.
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={closeModal} 
                  disabled={isDeleting}
                  className="flex-1 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 disabled:opacity-50 active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteUser} 
                  disabled={isDeleting}
                  className="flex-1 h-12 rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-500 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 active:scale-[0.97]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
