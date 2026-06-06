import api from './api';

const VISITOR_ID_KEY = 'examflow_visitor_id';

const getVisitorId = () => {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = 'v_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
};

// MED-003: Redact sensitive path segments before tracking
const sanitizeUrl = (url) => {
  return url
    .replace(/\/session\/[^/?#]+/, '/session/[exam]')
    .replace(/\/result\/[^/?#]+/, '/result/[submission]')
    .replace(/\/submissions\/[^/?#]+/, '/submissions/[id]');
};

export const trackPageView = async (url) => {
  const visitorId = getVisitorId();
  const referrer = document.referrer;

  try {
    api.post('/analytics/track', {
      visitorId,
      url: sanitizeUrl(url),
      referrer
    }).catch(err => console.debug('Tracking skipped:', err.message));
  } catch (e) {}
};
