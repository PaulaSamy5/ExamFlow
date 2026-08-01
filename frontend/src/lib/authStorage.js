// Centralizes where the auth session (user + JWT) lives, so "Remember Me"
// is a single decision made at login time rather than scattered across
// every place that reads/writes localStorage.
//
// remember = true  -> localStorage   (survives browser restarts, until logout)
// remember = false -> sessionStorage (cleared when the browser/tab closes)
//
// The choice itself is recorded in localStorage under REMEMBER_KEY (just a
// flag, not sensitive) so a fresh page load — before any React state exists —
// knows which backend to check for an existing session.

const REMEMBER_KEY = 'examflow_remember_me';

const isRemembered = () => localStorage.getItem(REMEMBER_KEY) === 'true';
const activeStore = () => (isRemembered() ? localStorage : sessionStorage);

export const authStorage = {
  getUser() {
    const raw = activeStore().getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken() {
    return activeStore().getItem('token');
  },

  // Starts a new session, choosing which storage backend owns it.
  setSession(user, token, remember) {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    other.removeItem('user');
    other.removeItem('token');
    store.setItem('user', JSON.stringify(user));
    store.setItem('token', token);
  },

  // Re-writes user/token for an already-active session (e.g. after a
  // profile update) without changing the remember-me choice made at login.
  updateUser(user, token) {
    const store = activeStore();
    store.setItem('user', JSON.stringify(user));
    if (token) store.setItem('token', token);
  },

  clearSession() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  },
};
