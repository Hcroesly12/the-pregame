// The Pregame — screen switching, polls, likes and clips
(function () {
  const phone = document.getElementById('phone');
  const order = ['Home', 'Clips', 'Takes', 'Scores', 'Me'];
  const map = { Home: 'Main', Clips: 'Clips', Takes: 'Takes', Scores: 'Scores' };
  const toastEl = document.getElementById('toast');
  let tt;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 1800); }
  function show(name) {
    phone.querySelectorAll('.screen').forEach(s => { s.hidden = s.dataset.screen !== name; if (!s.hidden) s.scrollTop = 0; });
    try { sessionStorage.setItem('pregame-screen', name); } catch (e) {}
  }
  try { const saved = sessionStorage.getItem('pregame-screen'); if (saved) show(saved); } catch (e) {}

  // clips (live.js fills window.pregameClips with real items)
  let playing = false, prog = 0, timer;
  const bar = document.getElementById('clipBar');
  const playBtn = document.getElementById('clipPlay');
  const playSvg = playBtn ? playBtn.innerHTML : '';
  window.pregameToast = toast;
  const pauseSvg = '<svg width="32" height="32" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="#fff"/></svg>';
  function setPlaying(p) {
    playing = p; playBtn.innerHTML = p ? pauseSvg : playSvg; clearInterval(timer);
    if (p) timer = setInterval(() => { prog += 1; if (prog >= 100) nextClip(); bar.style.width = prog + '%'; }, 80);
  }
  function nextClip() {
    prog = 0; bar.style.width = '0%';
    if (window.pregameClips) window.pregameClips.next();
  }

  function act(t) {
    let el;
    if ((el = t.closest('[data-nav]'))) {
      const i = [...el.parentElement.children].indexOf(el);
      const name = order[i];
      if (map[name]) show(map[name]); else toast('Profiles are coming soon');
      document.dispatchEvent(new CustomEvent('pregame:screen', { detail: map[name] }));
      if (map[name] !== 'Clips' && playing) setPlaying(false);
      return;
    }
    if ((el = t.closest('[data-go]'))) { show(el.dataset.go); return; }
    if ((el = t.closest('[data-soon]'))) { toast(el.dataset.soon + ' is coming soon'); return; }
    if ((el = t.closest('[data-follow]'))) { const on = el.textContent === 'Follow'; el.textContent = on ? 'Following' : 'Follow'; toast(on ? 'Following the Hawks' : 'Unfollowed the Hawks'); return; }
    if ((el = t.closest('.tile'))) { el.classList.toggle('on'); return; }
    if ((el = t.closest('.team'))) { el.classList.toggle('picked'); return; }
    if ((el = t.closest('[data-poll]'))) {
      el.parentElement.querySelectorAll('[data-poll]').forEach(r => r.classList.toggle('voted', r === el));
      toast('Vote counted'); return;
    }
    if ((el = t.closest('[data-pick]'))) {
      el.parentElement.querySelectorAll('[data-pick]').forEach(r => r.classList.toggle('sel', r === el));
      toast('Vote counted'); return;
    }
    if ((el = t.closest('[data-like]'))) { el.classList.toggle('liked'); return; }
    if ((el = t.closest('.tabs > div'))) {
      const tabs = [...el.parentElement.children];
      const active = tabs.find(x => /#f2f2f0; color:#08090b/.test(x.getAttribute('style')));
      if (active && active !== el) { const a = active.getAttribute('style'); active.setAttribute('style', el.getAttribute('style')); el.setAttribute('style', a); }
      document.dispatchEvent(new CustomEvent('pregame:tab', { detail: { row: el.parentElement.id, label: el.textContent.trim() } }));
      return;
    }
    if (t.closest('#clipPlay')) { setPlaying(!playing); return; }
    if (t.closest('#clipLink')) return;
    if (t.closest('#clipStage')) { nextClip(); if (!playing) setPlaying(true); return; }
  }
  phone.addEventListener('click', e => act(e.target));
  phone.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); act(e.target); } });
  phone.querySelectorAll('.tabs > div').forEach(x => { x.setAttribute('role', 'button'); x.tabIndex = 0; });
})();
