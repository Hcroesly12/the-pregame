// The Pregame — real teams, scores and news from ESPN's public feeds.
(function () {
  const API = 'https://site.api.espn.com/apis/site/v2/sports/football/';
  const LEAGUES = { NFL: 'nfl', College: 'college-football' };
  const phone = document.getElementById('phone');
  if (!phone) return;

  // ---------- look (matches the rest of the app) ----------
  const D = "font-family:'Saira Condensed','Arial Narrow',sans-serif; font-weight:800; font-style:italic;";
  const L = "font-family:'Saira Condensed','Arial Narrow',sans-serif; font-weight:600; letter-spacing:1px; text-transform:uppercase;";
  const PANEL = 'background:#131519; border-top:1px solid #2a2d33; clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));';
  const CUT = 'clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%);';
  const LIVE = `<span style="display:inline-flex; align-items:center; gap:4px; color:#ff4f1a; ${L} font-size:11px;"><span style="width:6px; height:6px; border-radius:50%; background:#ff4f1a; animation:pulse 1.4s infinite;"></span>Live</span>`;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => (/^https:\/\//.test(u || '') ? u : '');
  const logo = (src, size) => src
    ? `<img src="${esc(safeUrl(src))}" alt="" loading="lazy" style="width:${size}px; height:${size}px; object-fit:contain; flex-shrink:0;">`
    : `<div style="width:${size}px; height:${size}px; background:#2a2d33; border-radius:50%; flex-shrink:0;"></div>`;
  const note = text => `<div style="${PANEL} padding:14px; font-size:13px; color:#b5b7bb; line-height:1.4;">${esc(text)}</div>`;

  const pickCss = document.createElement('style');
  pickCss.textContent = `
    #teamPicker .team { opacity: 1 !important; border-radius: 6px; }
    #teamPicker .team img { opacity: .55; transition: opacity .15s, transform .15s; }
    #teamPicker .team.picked { background: rgba(255,79,26,.14); box-shadow: inset 0 0 0 2px #ff4f1a; }
    #teamPicker .team.picked img { opacity: 1; transform: scale(1.06); }
    #teamPicker .team.picked span { color: #f2f2f0 !important; }
    #teamPicker .team.picked::after { content: '✓'; position: absolute; top: 2px; right: 4px; width: 18px; height: 18px; border-radius: 50%; background: #ff4f1a; color: #08090b; font: 700 12px/18px Saira, Arial, sans-serif; text-align: center; }
  `;
  document.head.appendChild(pickCss);

  // ---------- data ----------
  const cache = {};
  function getJSON(path) {
    if (!cache[path]) cache[path] = fetch(API + path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[path];
  }
  const state = { games: { NFL: [], College: [] }, news: { NFL: [], College: [] }, teams: [], week: '', homeTab: 'For You', scoresTab: 'NFL' };
  const picks = () => ((window.pregamePicks && window.pregamePicks.teams) || []).map(k => (k.includes(':') ? k : 'NFL:' + k));
  const keyOf = (league, abbr) => `${league === 'College' ? 'CFB' : 'NFL'}:${abbr}`;

  function parseGames(data, league) {
    return (data.events || []).map(ev => {
      const comp = (ev.competitions || [])[0] || {};
      const side = ha => {
        const c = (comp.competitors || []).find(x => x.homeAway === ha) || {};
        const t = c.team || {};
        return { abbr: t.abbreviation || '', name: t.shortDisplayName || t.displayName || '', logo: t.logo || '', score: c.score, record: ((c.records || [])[0] || {}).summary || '', rank: (c.curatedRank || {}).current };
      };
      const st = (ev.status || {}).type || {};
      return { id: ev.id, league, date: new Date(ev.date), state: st.state || 'pre', detail: st.shortDetail || '', away: side('away'), home: side('home'), venue: ((comp.venue || {}).fullName) || '', link: ((ev.links || [])[0] || {}).href || '' };
    });
  }
  function parseNews(data, league) {
    return (data.articles || []).filter(a => a.headline).map(a => ({
      id: String(a.id || ''), league, title: a.headline, blurb: a.description || '', byline: a.byline || '',
      image: ((a.images || [])[0] || {}).url || '',
      link: ((a.links || {}).web || {}).href || '',
      when: a.published ? new Date(a.published) : null,
      video: a.type === 'Media',
      teams: (a.categories || []).filter(c => c.type === 'team' && c.team).map(c => String(c.team.id)),
    }));
  }

  const timeText = d => d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const ago = d => { if (!d) return ''; const m = Math.round((Date.now() - d) / 60000); return m < 60 ? `${Math.max(m, 1)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
  const teamLabel = s => (s.rank && s.rank <= 25 ? `<span style="color:#8a8d93; font-size:11px;">${s.rank}</span> ` : '') + esc(s.abbr);
  const hasPick = g => picks().includes(keyOf(g.league, g.away.abbr)) || picks().includes(keyOf(g.league, g.home.abbr));
  const statusRank = g => (g.state === 'in' ? 0 : g.state === 'pre' ? 1 : 2);


  // ---------- in-app story / video viewer ----------
  const stories = [];
  function storyRef(a) { let i = stories.indexOf(a); if (i < 0) { stories.push(a); i = stories.length - 1; } return i; }
  const viewer = document.createElement('div');
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.style.cssText = 'position:absolute; inset:0; z-index:12; background:#08090b; overflow-y:auto; font-family:Saira, Helvetica Neue, Arial, sans-serif; color:#f2f2f0;';
  phone.appendChild(viewer);
  const embedUrl = a => (a.video && /^\d+$/.test(a.id) ? `https://www.espn.com/core/video/iframe?id=${a.id}&endcard=false` : '');
  function openStory(a) {
    const vid = embedUrl(a);
    const media = vid
      ? `<div style="position:relative; width:100%; aspect-ratio:16/9; background:#000;"><iframe src="${esc(vid)}" title="${esc(a.title)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen style="position:absolute; inset:0; width:100%; height:100%; border:0;"></iframe></div>`
      : (a.image ? `<div style="width:100%; aspect-ratio:16/9; background:#1b1e23 url('${esc(safeUrl(a.image))}') center/cover no-repeat;"></div>` : '');
    viewer.innerHTML = `
      <div style="position:sticky; top:0; z-index:1; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#08090b; border-bottom:1px solid #2a2d33;">
        <button type="button" data-close style="display:flex; align-items:center; gap:6px; background:none; border:0; color:#f2f2f0; ${L} font-size:14px; cursor:pointer; min-height:44px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f2f2f0" stroke-width="2"><path d="m15 5-7 7 7 7"/></svg>Back</button>
        <span style="${L} font-size:12px; color:#8a8d93;">${esc(a.league)} · ESPN</span></div>
      ${media}
      <div style="padding:16px 18px 28px; display:flex; flex-direction:column; gap:12px;">
        <div style="color:#ff4f1a; ${L} font-size:12px;">${a.video ? 'Video' : 'Story'} · ${esc(ago(a.when))} ago</div>
        <h2 style="margin:0; ${D} font-size:30px; line-height:1; text-wrap:balance;">${esc(a.title)}</h2>
        ${a.byline ? `<div style="font-size:13px; color:#8a8d93;">By ${esc(a.byline)}</div>` : ''}
        ${a.blurb ? `<p style="margin:0; font-size:16px; line-height:1.5; color:#d8d9db;">${esc(a.blurb)}</p>` : ''}
        ${vid ? '' : `<p style="margin:0; font-size:13px; line-height:1.5; color:#8a8d93;">This is ESPN’s summary. The full story lives on ESPN.</p>`}
        <a href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener" style="align-self:flex-start; ${L} font-size:14px; color:#08090b; background:#f2f2f0; ${CUT} padding:10px 16px; text-decoration:none;">${a.video ? 'Video not playing? Watch on ESPN' : 'Read the full story on ESPN'}</a>
        ${relatedHtml(a)}
      </div>`;
    viewer.hidden = false;
    viewer.scrollTop = 0;
  }
  function relatedHtml(a) {
    const more = [...state.news.NFL, ...state.news.College].filter(x => x !== a && x.league === a.league).slice(0, 4);
    if (!more.length) return '';
    return `<div style="margin-top:12px; ${L} font-size:13px; color:#ff4f1a;">More ${esc(a.league)}</div>` + more.map(x => `
      <div role="button" tabindex="0" data-story="${storyRef(x)}" style="display:flex; gap:10px; align-items:center; cursor:pointer; ${PANEL} padding:8px;">
        <div style="width:72px; height:48px; flex-shrink:0; background:#1b1e23 url('${esc(safeUrl(x.image))}') center/cover no-repeat;"></div>
        <div style="flex:1; min-width:0; font-size:13px; font-weight:600; line-height:1.3;">${esc(x.title)}</div></div>`).join('');
  }
  function closeStory() { viewer.hidden = true; viewer.innerHTML = ''; }
  viewer.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return closeStory();
    const s = e.target.closest('[data-story]');
    if (s) openStory(stories[+s.dataset.story]);
  });
  phone.addEventListener('click', e => {
    const s = e.target.closest('[data-story]');
    if (s && !viewer.contains(s)) { e.stopPropagation(); openStory(stories[+s.dataset.story]); }
  }, true);
  phone.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !viewer.hidden) closeStory();
    const s = e.target.closest && e.target.closest('[data-story]');
    if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openStory(stories[+s.dataset.story]); }
  });

  // ---------- home ----------
  function renderStrip() {
    const all = [...state.games.NFL, ...state.games.College].sort((a, b) => statusRank(a) - statusRank(b) || (hasPick(b) - hasPick(a)) || (a.state === 'post' ? b.date - a.date : a.date - b.date));
    const list = all.slice(0, 8);
    if (!list.length) { $('liveStrip').innerHTML = `<div style="flex:1;">${note('No games on the schedule right now.')}</div>`; return; }
    $('liveStrip').innerHTML = list.map(g => {
      const top = g.state === 'in' ? LIVE : `<span style="${L} font-size:11px; color:#8a8d93;">${g.state === 'post' ? 'Final' : esc(g.league)}</span>`;
      const right = g.state === 'pre' ? timeText(g.date) : g.detail;
      const row = (s, other) => {
        const win = g.state !== 'pre' && Number(s.score) > Number(other.score);
        const score = g.state === 'pre' ? '' : esc(s.score);
        return `<div style="display:flex; align-items:center; gap:6px;">${logo(s.logo, 20)}<span style="${L} font-size:13px; flex:1;">${teamLabel(s)}</span><span style="${D} font-size:20px; color:${win ? '#ff4f1a' : '#f2f2f0'};">${score}</span></div>`;
      };
      return `<div style="flex:0 0 156px; ${PANEL} padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">${top}<span style="font-size:10px; color:#8a8d93; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(right)}</span></div>
        ${row(g.away, g.home)}${row(g.home, g.away)}</div>`;
    }).join('');
  }

  function feedFor(tab) {
    const all = [...state.news.NFL, ...state.news.College].sort((a, b) => (b.when || 0) - (a.when || 0));
    if (tab === 'NFL') return state.news.NFL;
    if (tab === 'College') return state.news.College;
    if (tab === 'Teams') {
      const mine = state.teams.filter(t => picks().includes(t.key));
      return [...state.news.NFL, ...state.news.College].filter(a => mine.some(t => t.league === a.league && a.teams.includes(t.id)));
    }
    return all;
  }
  function renderHomeFeed() {
    const tab = state.homeTab;
    if (tab === 'HS') {
      $('topStory').innerHTML = note('High school coverage is coming soon: clips, news and takes from schools near you.');
      $('latestList').innerHTML = '';
      return;
    }
    const items = feedFor(tab);
    if (!items.length) {
      $('topStory').innerHTML = note(tab === 'Teams' ? 'Pick favorite teams to see their news here. Tap Me, then Edit my picks.' : 'No stories right now. Check back soon.');
      $('latestList').innerHTML = '';
      return;
    }
    const top = items.find(a => a.image) || items[0];
    $('topStory').innerHTML = `<div role="button" tabindex="0" data-story="${storyRef(top)}" style="display:block; cursor:pointer; position:relative; height:230px; overflow:hidden; color:inherit; text-decoration:none; background:#1b1e23 url('${esc(safeUrl(top.image))}') center/cover no-repeat;">
      <div style="position:absolute; inset:0; background:linear-gradient(180deg,transparent 30%,rgba(8,9,11,.95));"></div>
      <div style="position:absolute; top:10px; left:10px; background:#ff4f1a; color:#08090b; ${CUT} padding:2px 8px; ${L} font-size:12px;">Top story · ${esc(top.league)}</div>
      <div style="position:absolute; left:14px; right:14px; bottom:12px; display:flex; flex-direction:column; gap:4px;">
        <div style="${D} font-size:24px; line-height:1.02; color:#f2f2f0; text-wrap:balance;">${esc(top.title)}</div>
        <div style="font-size:12px; color:#b5b7bb;">${esc(ago(top.when))} ago · ESPN${top.video ? ' · Video' : ''}</div></div></div>`;
    $('latestList').innerHTML = items.filter(a => a !== top).slice(0, 5).map(a => `
      <div role="button" tabindex="0" data-story="${storyRef(a)}" style="display:flex; gap:10px; align-items:center; cursor:pointer; ${PANEL} padding:8px;">
        <div style="width:84px; height:56px; flex-shrink:0; background:#1b1e23 url('${esc(safeUrl(a.image))}') center/cover no-repeat;"></div>
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;">
          <div style="font-size:13px; line-height:1.3; font-weight:600; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(a.title)}</div>
          <div style="font-size:11px; color:#8a8d93;">${esc(a.league)} · ${esc(ago(a.when))} ago${a.video ? ' · Video' : ''}</div></div></div>`).join('');
  }

  function pollGame() {
    const upcoming = [...state.games.NFL, ...state.games.College].filter(g => g.state === 'pre').sort((a, b) => hasPick(b) - hasPick(a) || a.date - b.date);
    return upcoming[0] || state.games.NFL[0] || state.games.College[0];
  }
  function renderPolls() {
    const g = pollGame();
    if (!g) { $('homePoll').innerHTML = note('Polls open when the next games are scheduled.'); $('takesPoll').innerHTML = note('Polls open when the next games are scheduled.'); return; }
    const title = g.state === 'pre' ? 'Who wins?' : 'Who played better?';
    const when = g.state === 'pre' ? timeText(g.date) : g.detail;
    const opt = s => `<div role="button" tabindex="0" data-pick style="flex:1; height:40px; display:flex; align-items:center; justify-content:center; gap:6px; ${L} font-size:14px; ${CUT}">${logo(s.logo, 20)}${esc(s.name)}</div>`;
    $('homePoll').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:#ff4f1a; ${L} font-size:12px;">Hot take · ${esc(g.league)}</span><span style="font-size:11px; color:#8a8d93;">${esc(when)}</span></div>
      <div style="${D} font-size:20px; line-height:1.05; text-transform:uppercase;">${esc(title)} ${esc(g.away.name)} at ${esc(g.home.name)}</div>
      <div style="display:flex; gap:8px;">${opt(g.away)}${opt(g.home)}</div>`;
    const row = s => `<div role="button" tabindex="0" data-poll style="position:relative; height:44px; border:1px solid #2a2d33; background:#131519; display:flex; align-items:center; gap:8px; padding:0 10px;">${logo(s.logo, 26)}<span style="${L} font-size:15px; flex:1;">${esc(s.name)}</span><span style="font-size:12px; color:#8a8d93;">${esc(s.record)}</span></div>`;
    $('takesPoll').innerHTML = `
      <div style="display:flex; justify-content:space-between;"><span style="color:#ff4f1a; ${L} font-size:12px;">Game of the week · ${esc(g.league)}</span><span style="font-size:11px; color:#8a8d93;">${esc(when)}</span></div>
      <div style="${D} font-size:24px; line-height:1; text-transform:uppercase;">${esc(title)}</div>
      ${row(g.away)}${row(g.home)}
      <div style="font-size:11px; color:#6a6d73;">${esc(g.venue)}</div>`;
  }

  // ---------- scores ----------
  function renderScores() {
    const tab = state.scoresTab;
    let list = tab === 'My Teams' ? [...state.games.NFL, ...state.games.College].filter(hasPick) : state.games[tab] || [];
    list = [...list].sort((a, b) => statusRank(a) - statusRank(b) || a.date - b.date);
    $('weekLabel').textContent = state.week || 'This week';
    const feat = [...state.games.NFL].filter(hasPick).sort((a, b) => statusRank(a) - statusRank(b))[0] || list.find(g => g.state !== 'post') || list[0];
    if (!feat) {
      $('featuredGame').innerHTML = note(tab === 'My Teams' ? 'No games for your teams this week. Pick teams from Me, then Edit my picks.' : 'No games scheduled right now.');
      $('scoresList').innerHTML = '';
      return;
    }
    const mine = hasPick(feat);
    const side = s => `<div style="display:flex; flex-direction:column; align-items:center; gap:4px; width:104px; text-align:center;">${logo(s.logo, 56)}<span style="${L} font-size:13px;">${esc(s.name)}</span><span style="font-size:11px; color:#8a8d93;">${esc(s.record)}</span></div>`;
    const mid = feat.state === 'pre'
      ? `<span style="${D} font-size:26px; color:#f2f2f0;">${esc(feat.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</span><span style="${L} font-size:12px; color:#8a8d93;">${esc(feat.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}</span>`
      : `<span style="${D} font-size:34px; color:#f2f2f0;">${esc(feat.away.score)}–${esc(feat.home.score)}</span><span style="${L} font-size:12px; color:${feat.state === 'in' ? '#ff4f1a' : '#8a8d93'};">${esc(feat.detail)}</span>`;
    $('featuredGame').innerHTML = `<div style="padding:14px; border:1px solid ${mine ? '#ff4f1a' : '#2a2d33'}; background:#131519; display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; justify-content:space-between; gap:8px;"><span style="color:#ff4f1a; ${L} font-size:12px;">${mine ? 'Your team' : 'Featured'} · ${esc(feat.league)}</span><span style="font-size:11px; color:#8a8d93; text-align:right;">${esc(feat.venue)}</span></div>
      <div style="display:flex; align-items:center; justify-content:space-between;">${side(feat.away)}<div style="display:flex; flex-direction:column; align-items:center;">${mid}</div>${side(feat.home)}</div>
      <a href="${esc(safeUrl(feat.link))}" target="_blank" rel="noopener" style="align-self:center; color:#8a8d93; font-size:12px;">Full box score on ESPN</a></div>`;
    const rest = list.filter(g => g !== feat);
    $('scoresList').innerHTML = rest.length ? rest.map(g => {
      const stat = g.state === 'in' ? LIVE : `<span style="${L} font-size:11px; color:#8a8d93;">${g.state === 'post' ? 'Final' : esc(g.date.toLocaleDateString([], { weekday: 'short' }))}</span>`;
      const sub = g.state === 'pre' ? g.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : g.state === 'in' ? g.detail : '';
      const row = (s, o) => {
        const win = g.state !== 'pre' && Number(s.score) > Number(o.score);
        return `<div style="display:flex; align-items:center; gap:8px;">${logo(s.logo, 24)}<span style="${L} font-size:15px; flex:1;">${teamLabel(s)} <span style="text-transform:none; letter-spacing:0; color:#8a8d93; font-size:11px; font-family:Saira, sans-serif;">${esc(s.record)}</span></span><span style="${D} font-size:22px; color:${win ? '#ff4f1a' : '#8a8d93'};">${g.state === 'pre' ? '' : esc(s.score)}</span></div>`;
      };
      return `<div style="${PANEL} padding:8px 12px; display:flex; align-items:center; gap:12px;">
        <div style="flex:1; display:flex; flex-direction:column; gap:5px;">${row(g.away, g.home)}${row(g.home, g.away)}</div>
        <div style="width:66px; border-left:1px solid #2a2d33; padding-left:10px; display:flex; flex-direction:column; gap:3px;">${stat}<span style="font-size:11px; color:#b5b7bb;">${esc(sub)}</span></div></div>`;
    }).join('') : '';
  }

  // ---------- clips ----------
  let clipItems = [], clipIndex = -1;
  function showClip(i) {
    if (!clipItems.length) return;
    clipIndex = (i + clipItems.length) % clipItems.length;
    const c = clipItems[clipIndex];
    $('clipImg').style.backgroundImage = c.image ? `url("${safeUrl(c.image)}")` : 'none';
    $('clipTitle').textContent = c.title;
    $('clipMeta').textContent = `${c.league} · ${ago(c.when)} ago · ${c.video ? 'Video' : 'Story'} from ESPN`;
    $('clipLink').setAttribute('data-story', storyRef(c));
    $('clipLink').removeAttribute('target');
    $('clipLink').href = '#';
    $('clipLink').textContent = c.video ? 'Play video' : 'Read now';
    $('clipSource').textContent = c.league === 'NFL' ? 'NFL on ESPN' : 'College on ESPN';
  }
  window.pregameClips = { next: () => showClip(clipIndex + 1) };
  // the big play button plays the clip in-app (ESPN's player)
  phone.addEventListener('click', e => {
    if (e.target.closest('#clipPlay') && clipItems[clipIndex]) { e.stopPropagation(); openStory(clipItems[clipIndex]); }
  }, true);
  function renderClips() {
    const all = [...state.news.NFL, ...state.news.College].filter(a => a.image);
    const vids = all.filter(a => a.video);
    clipItems = vids.length ? vids : all;
    if (!clipItems.length) { $('clipTitle').textContent = 'No clips right now'; return; }
    showClip(0);
  }

  // ---------- team picker ----------
  function teamTile(t, chosen) {
    return `<div role="button" tabindex="0" class="team${chosen.includes(t.key) ? ' picked' : ''}" data-key="${esc(t.key)}" data-name="${esc(t.name.toLowerCase())}" data-abbr="${esc(t.abbr.toLowerCase())}" title="${esc(t.name)}" aria-pressed="${chosen.includes(t.key)}" style="position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px 2px; min-height:44px;">
      ${logo(t.logo, 44)}<span style="${L} font-size:11px; color:#8a8d93; text-align:center; line-height:1.1;">${esc(t.short)}</span></div>`;
  }
  function renderPicker() {
    const box = $('teamPicker');
    if (!state.teams.length) return;
    const chosen = picks();
    const group = (label, list) => `<div class="team-group" style="grid-column:1/-1; ${L} font-size:12px; color:#8a8d93; padding-top:4px;">${label}</div>` + list.map(t => teamTile(t, chosen)).join('');
    box.innerHTML = group('NFL', state.teams.filter(t => t.league === 'NFL'))
      + group('College', state.teams.filter(t => t.league === 'College'))
      + '<div id="teamNone" style="display:none; grid-column:1/-1; font-size:13px; color:#8a8d93;">No team matches that search.</div>';
    filterPicker();
  }
  function filterPicker() {
    const q = ($('teamSearch').value || '').trim().toLowerCase();
    let shown = 0;
    phone.querySelectorAll('#teamPicker .team').forEach(el => {
      const hide = !!q && !el.dataset.name.includes(q) && el.dataset.abbr !== q;
      el.style.display = hide ? 'none' : 'flex';
      if (!hide) shown++;
    });
    const none = $('teamNone');
    if (none) none.style.display = shown > 0 ? 'none' : 'block';
    updateCount();
  }
  function updateCount() {
    const n = phone.querySelectorAll('#teamPicker .team.picked').length;
    $('teamCount').textContent = n ? `${n} picked` : 'Tap to pick';
    phone.querySelectorAll('#teamPicker .team').forEach(el => el.setAttribute('aria-pressed', el.classList.contains('picked')));
  }

  // ---------- wiring ----------
  $('teamSearch').addEventListener('input', filterPicker);
  $('teamPicker').addEventListener('click', () => setTimeout(updateCount, 0));
  document.addEventListener('pregame:tab', e => {
    if (e.detail.row === 'homeTabs') { state.homeTab = e.detail.label; renderHomeFeed(); }
    if (e.detail.row === 'scoresTabs') { state.scoresTab = e.detail.label; renderScores(); }
  });
  document.addEventListener('pregame:picks', () => {
    // keep typed picks from the picker screen in sync, then refresh views
    renderPicker(); renderStrip(); renderScores(); renderPolls(); if (state.homeTab === 'Teams') renderHomeFeed();
  });

  async function load() {
    const tasks = Object.entries(LEAGUES).flatMap(([name, slug]) => [
      getJSON(`${slug}/scoreboard`).then(d => {
        state.games[name] = parseGames(d, name);
        if (name === 'NFL') state.week = d.week && d.week.number ? `Week ${d.week.number}` : '';
      }).catch(() => {}),
      getJSON(`${slug}/news?limit=25`).then(d => { state.news[name] = parseNews(d, name); }).catch(() => {}),
    ]);
    const teamLists = { NFL: [], College: [] };
    const readTeams = (d, league) => (((((d.sports || [])[0] || {}).leagues || [])[0] || {}).teams || []).map(x => x.team).map(t => ({
      id: String(t.id), league, abbr: t.abbreviation || '', key: keyOf(league, t.abbreviation || ''),
      name: t.displayName || '', short: league === 'NFL' ? (t.abbreviation || '') : (t.location || t.shortDisplayName || t.abbreviation || ''),
      logo: ((t.logos || [])[0] || {}).href || '',
    })).filter(t => t.abbr).sort((a, b) => a.name.localeCompare(b.name));
    tasks.push(getJSON('nfl/teams').then(d => { teamLists.NFL = readTeams(d, 'NFL'); }).catch(() => {}));
    tasks.push(getJSON('college-football/teams?limit=1000').then(d => { teamLists.College = readTeams(d, 'College'); }).catch(() => {}));
    await Promise.all(tasks);
    state.teams = [...teamLists.NFL, ...teamLists.College];
    const nothing = !state.teams.length && !state.games.NFL.length && !state.news.NFL.length;
    if (nothing) {
      $('topStory').innerHTML = note('Couldn’t load scores and news right now. Check your connection and refresh.');
      $('latestList').innerHTML = '';
    }
    renderPicker(); renderStrip(); renderHomeFeed(); renderPolls(); renderScores(); renderClips();
  }
  load();
  // refresh scores every minute while the page is open
  setInterval(() => {
    Object.values(LEAGUES).forEach(slug => { delete cache[`${slug}/scoreboard`]; });
    Promise.all(Object.entries(LEAGUES).map(([name, slug]) => getJSON(`${slug}/scoreboard`).then(d => { state.games[name] = parseGames(d, name); }).catch(() => {})))
      .then(() => { renderStrip(); renderScores(); });
  }, 60000);
})();
