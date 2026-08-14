import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { CreditCard, Loader2, ArrowUpCircle, XCircle, RotateCcw, Receipt, ExternalLink, AlertCircle } from 'lucide-react';
import api from '../lib/api';

const PLAN_INFO = {
  FREE: { name: 'Free', price: '$0/mo' },
  STARTER: { name: 'Starter', price: '$29/mo' },
  PROFESSIONAL: { name: 'Professional', price: '$79/mo' },
  BUSINESS: { name: 'Business', price: '$149/mo' },
};
const PAID_PLANS = ['STARTER', 'PROFESSIONAL', 'BUSINESS'];

const STATUS_STYLE = {
  ACTIVE: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  TRIALING: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
  PAST_DUE: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  CANCELED: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
  INCOMPLETE: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

const BillingCard = () => {
  const [status, setStatus] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState(null); // which plan button is mid-request
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, invoicesRes] = await Promise.all([
        api.get('/billing/status'),
        api.get('/billing/invoices'),
      ]);
      setStatus(statusRes.data);
      setInvoices(invoicesRes.data);
    } catch (err) {
      toast.error('Could not load billing information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelectPlan = async (plan) => {
    setActionPlan(plan);
    try {
      const { data } = await api.post('/billing/change-plan', { plan });
      if (data.type === 'checkout') {
        window.location.href = data.url;
        return; // leaving the app -- no need to clear actionPlan
      }
      toast.success(`Switched to the ${PLAN_INFO[plan].name} plan.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not change plan. Please try again.');
    } finally {
      setActionPlan(null);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await api.post('/billing/cancel');
      toast.success('Subscription will cancel at the end of the current period.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not cancel subscription.');
    } finally {
      setCanceling(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await api.post('/billing/resume');
      toast.success('Subscription cancellation undone — you\'re staying on your current plan.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not resume subscription.');
    } finally {
      setResuming(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  const planInfo = PLAN_INFO[status.plan] || PLAN_INFO.FREE;
  const otherPlans = PAID_PLANS.filter(p => p !== status.plan);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-3">Billing</h3>

      {/* Current plan summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">{planInfo.name} Plan</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[status.status] || STATUS_STYLE.INCOMPLETE}`}>
                {status.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {status.plan === 'FREE'
                ? 'No active subscription'
                : status.cancelAtPeriodEnd && status.currentPeriodEnd
                  ? `Cancels on ${format(new Date(status.currentPeriodEnd), 'MMM dd, yyyy')}`
                  : status.currentPeriodEnd
                    ? `Renews on ${format(new Date(status.currentPeriodEnd), 'MMM dd, yyyy')}`
                    : planInfo.price}
            </p>
          </div>
        </div>

        {status.hasActiveSubscription && (
          status.cancelAtPeriodEnd ? (
            <button
              onClick={handleResume}
              disabled={resuming}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              {resuming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Resume Subscription
            </button>
          ) : (
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Cancel Subscription
            </button>
          )
        )}
      </div>

      {status.cancelAtPeriodEnd && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Your subscription is set to cancel at the end of the current billing period. You'll keep {planInfo.name} access until then.
          </p>
        </div>
      )}

      {/* Upgrade / switch plan */}
      {otherPlans.length > 0 && (
        <div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2.5">
            {status.plan === 'FREE' ? 'Upgrade your plan' : 'Switch plan'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {otherPlans.map(plan => (
              <button
                key={plan}
                onClick={() => handleSelectPlan(plan)}
                disabled={actionPlan !== null}
                className="flex flex-col items-start gap-1 p-3.5 rounded-2xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all active:scale-[0.98] disabled:opacity-50 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                  {actionPlan === plan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5 text-indigo-500" />}
                  {PLAN_INFO[plan].name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{PLAN_INFO[plan].price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div>
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5" /> Payment History
        </p>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 px-1">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${inv.status === 'paid' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">${inv.amountPaid?.toFixed(2)} {inv.currency?.toUpperCase()}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{format(new Date(inv.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                {inv.hostedInvoiceUrl && (
                  <a
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 shrink-0"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingCard;
