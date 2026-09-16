// The Pregame — accounts and saved picks (Supabase)
// The publishable key below is meant to be public. Row Level Security in the
// database makes sure each person can only read and change their own picks.
(function () {
  const SUPABASE_URL = 'https://vpqdvivbrcmxttmbvjxq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_XHNQlFwNY_u_l76wtzx0lQ_R9psdIIB';
  const PENDING = 'pregame-pending-picks';

  const phone = document.getElementById('phone');
  if (!phone || !window.supabase) return;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null;
  let afterAuth = null;

  // ---------- look ----------
  const css = document.createElement('style');
  css.textContent = `
    .sheet-wrap { position: absolute; inset: 0; z-index: 10; background: rgba(8,9,11,.72); display: flex; align-items: flex-end; }
    .sheet-wrap[hidden] { display: none; }
    .sheet { width: 100%; background: #131519; border-top: 2px solid #ff4f1a; padding: 22px 20px calc(24px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; font-family: 'Saira', 'Helvetica Neue', Arial, sans-serif; color: #f2f2f0; }
    .sheet h2 { margin: 0; font-family: 'Saira Condensed', 'Arial Narrow', sans-serif; font-style: italic; font-weight: 800; font-size: 30px; line-height: 1; text-transform: uppercase; }
    .sheet p { margin: 0; color: #b5b7bb; font-size: 14px; line-height: 1.4; }
    .sheet label { display: flex; flex-direction: column; gap: 4px; font-family: 'Saira Condensed', 'Arial Narrow', sans-serif; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; color: #8a8d93; }
    .sheet input { height: 46px; background: #08090b; border: 1px solid #2a2d33; color: #f2f2f0; font: 16px 'Saira', 'Helvetica Neue', Arial, sans-serif; padding: 0 12px; border-radius: 0; outline: none; }
    .sheet input:focus { border-color: #ff4f1a; }
    .sheet .btn { height: 50px; border: 0; background: #ff4f1a; color: #08090b; font-family: 'Saira Condensed', 'Arial Narrow', sans-serif; font-style: italic; font-weight: 800; font-size: 20px; text-transform: uppercase; cursor: pointer; clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%); }
    .sheet .btn[disabled] { opacity: .5; cursor: default; }
    .sheet .btn.ghost { background: transparent; color: #f2f2f0; border: 1px solid #2a2d33; clip-path: none; font-style: normal; font-weight: 600; font-size: 16px; }
    .sheet .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .sheet .link { background: none; border: 0; padding: 8px 0; color: #ff4f1a; font: 600 14px 'Saira', 'Helvetica Neue', Arial, sans-serif; cursor: pointer; }
    .sheet .link.muted { color: #8a8d93; }
    .sheet .msg { min-height: 20px; font-size: 13px; color: #ff8a60; }
    .sheet .msg.ok { color: #7fd4a0; }
    .sheet .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .sheet .chip { border: 1px solid #2a2d33; padding: 3px 10px; font-family: 'Saira Condensed', 'Arial Narrow', sans-serif; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; }
  `;
  document.head.appendChild(css);

  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.hidden = true;
  wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"></div>';
  phone.appendChild(wrap);
  const sheet = wrap.firstElementChild;
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });

  function close() { wrap.hidden = true; afterAuth = null; }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- screens ----------
  function show(name) {
    phone.querySelectorAll('.screen').forEach(s => { s.hidden = s.dataset.screen !== name; if (!s.hidden) s.scrollTop = 0; });
    try { sessionStorage.setItem('pregame-screen', name); } catch (e) {}
  }

  // ---------- picks ----------
  const labelOf = el => (el.querySelector('span') || el).textContent.trim();
  function readPicks() {
    return {
      sports: [...phone.querySelectorAll('.tile.on')].map(labelOf),
      teams: [...phone.querySelectorAll('.team.picked')].map(labelOf),
    };
  }
  function sharePicks(p) {
    window.pregamePicks = p;
    document.dispatchEvent(new CustomEvent('pregame:picks', { detail: p }));
  }
  function applyPicks(p) {
    if (!p) return;
    sharePicks(p);
    phone.querySelectorAll('.tile').forEach(t => t.classList.toggle('on', (p.sports || []).includes(labelOf(t))));
    phone.querySelectorAll('.team').forEach(t => t.classList.toggle('picked', (p.teams || []).includes(labelOf(t))));
  }
  async function savePicks(p) {
    if (!user) return false;
    const { error } = await db.from('profiles').upsert({ id: user.id, sports: p.sports, teams: p.teams, updated_at: new Date().toISOString() });
    return !error;
  }
  async function loadPicks() {
    if (!user) return null;
    const { data } = await db.from('profiles').select('sports, teams').eq('id', user.id).maybeSingle();
    return data;
  }

  // ---------- sign in / sign up ----------
  function authSheet(mode, note) {
    const up = mode === 'up';
    sheet.innerHTML = `
      <h2 id="sheetTitle">${up ? 'Save your picks' : 'Welcome back'}</h2>
      <p>${esc(note || (up ? 'Make a free account so your sports and teams are here next time.' : 'Sign in to pick up where you left off.'))}</p>
      <form id="authForm" style="display:flex; flex-direction:column; gap:12px;">
        <label for="authEmail">Email<input id="authEmail" type="email" autocomplete="email" required></label>
        <label for="authPass">Password<input id="authPass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" required></label>
        <div class="msg" id="authMsg" role="status"></div>
        <button class="btn" type="submit">${up ? 'Create account' : 'Sign in'}</button>
      </form>
      <div class="row">
        <button class="link" type="button" id="authSwitch">${up ? 'Have an account? Sign in' : 'New here? Create an account'}</button>
        <button class="link muted" type="button" id="authSkip">Not now</button>
      </div>`;
    wrap.hidden = false;
    const msg = sheet.querySelector('#authMsg');
    sheet.querySelector('#authSwitch').onclick = () => { const next = afterAuth; authSheet(up ? 'in' : 'up'); afterAuth = next; };
    sheet.querySelector('#authSkip').onclick = () => { const next = afterAuth; close(); if (next) next(false); };
    sheet.querySelector('#authForm').onsubmit = async e => {
      e.preventDefault();
      const btn = sheet.querySelector('.btn');
      const email = sheet.querySelector('#authEmail').value.trim();
      const password = sheet.querySelector('#authPass').value;
      btn.disabled = true; msg.className = 'msg'; msg.textContent = up ? 'Creating your account…' : 'Signing in…';
      const res = up
        ? await db.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
        : await db.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (res.error) { msg.textContent = friendly(res.error.message); return; }
      if (up && !res.data.session) {
        try { localStorage.setItem(PENDING, JSON.stringify(readPicks())); } catch (err) {}
        msg.className = 'msg ok';
        msg.textContent = 'Almost there. Open the email we sent to confirm your account, then sign in here.';
        return;
      }
      user = res.data.user;
      setAvatar();
      const next = afterAuth;
      close();
      if (next) next(true);
    };
    setTimeout(() => sheet.querySelector('#authEmail').focus(), 50);
  }
  function friendly(m) {
    if (/invalid login/i.test(m)) return 'That email and password don’t match. Try again or create an account.';
    if (/already registered/i.test(m)) return 'That email already has an account. Tap “Sign in” below.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link.';
    if (/password/i.test(m)) return 'Use a password with at least 6 characters.';
    return m;
  }

  // ---------- account ----------
  function accountSheet() {
    loadPicks().then(p => {
      const chips = list => (list && list.length ? list.map(x => `<span class="chip">${esc(x)}</span>`).join('') : '<span style="color:#8a8d93;">None yet</span>');
      sheet.innerHTML = `
        <h2 id="sheetTitle">Your account</h2>
        <p>${esc(user.email)}</p>
        <label>Sports</label><div class="chips">${chips(p && p.sports)}</div>
        <label>Favorite teams</label><div class="chips">${chips(p && p.teams)}</div>
        <button class="btn" type="button" id="editPicks">Edit my picks</button>
        <button class="btn ghost" type="button" id="signOut">Sign out</button>`;
      wrap.hidden = false;
      sheet.querySelector('#editPicks').onclick = () => { close(); show('Onboarding'); };
      sheet.querySelector('#signOut').onclick = async () => { await db.auth.signOut(); user = null; setAvatar(); close(); show('Onboarding'); };
    });
  }
  function setAvatar() {
    phone.querySelectorAll('.screen[data-screen="Main"] [data-avatar]').forEach(a => { a.textContent = user ? user.email.slice(0, 2).toUpperCase() : '?'; });
  }
  // mark the avatar bubble on Home
  const homeHeader = phone.querySelector('.screen[data-screen="Main"] .root > div');
  if (homeHeader) {
    const bubbles = homeHeader.querySelectorAll(':scope > div > div');
    const av = bubbles[bubbles.length - 1];
    if (av) { av.setAttribute('data-avatar', ''); av.setAttribute('role', 'button'); av.tabIndex = 0; av.style.cursor = 'pointer'; }
  }

  // ---------- hooks (run before app.js handlers) ----------
  phone.addEventListener('click', async e => {
    const letsGo = e.target.closest('[data-go="Main"]');
    const nav = e.target.closest('[data-nav]');
    const avatar = e.target.closest('[data-avatar]');
    const isMe = nav && [...nav.parentElement.children].indexOf(nav) === 4;

    if (letsGo && letsGo.closest('.screen[data-screen="Onboarding"]')) {
      e.stopPropagation();
      const picks = readPicks();
      sharePicks(picks);
      if (user) { await savePicks(picks); show('Main'); return; }
      authSheet('up');
      afterAuth = async signedIn => { if (signedIn) await savePicks(picks); show('Main'); };
      return;
    }
    if (isMe || avatar) {
      e.stopPropagation();
      if (user) accountSheet();
      else { authSheet('in'); afterAuth = signedIn => { if (signedIn) accountSheet(); }; }
    }
  }, true);

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) close(); });

  // ---------- start ----------
  db.auth.onAuthStateChange((_event, session) => { user = session ? session.user : null; setAvatar(); });
  db.auth.getSession().then(async ({ data }) => {
    user = data.session ? data.session.user : null;
    setAvatar();
    if (!user) return;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING) || 'null'); localStorage.removeItem(PENDING); } catch (err) {}
    if (pending) await savePicks(pending);
    const picks = pending || await loadPicks();
    applyPicks(picks);
    if (picks) {
      const onOnboarding = !phone.querySelector('.screen[data-screen="Onboarding"]').hidden;
      if (onOnboarding) show('Main');
    }
  });
})();
