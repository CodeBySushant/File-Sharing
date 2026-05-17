/* ═══════════════════════════════════════════
   ShareYou — main.js
   ═══════════════════════════════════════════ */

// ─── Navbar scroll effect ───
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// ─── Mobile menu ───
function toggleMenu() {
  const links = document.getElementById('nav-links');
  const ham   = document.getElementById('hamburger');
  links.classList.toggle('open');
  ham.classList.toggle('open');
}

document.querySelectorAll('.nl').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('nav-links').classList.remove('open');
    document.getElementById('hamburger').classList.remove('open');
  });
});

// ─── Toast ───
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── Copy link ───
function copyLink() {
  const input = document.getElementById('share-link-input');
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.style.color = 'var(--green)';
    showToast('✓ Link copied to clipboard');
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      btn.style.color = '';
    }, 2000);
  });
}

// ─── Reset upload ───
function resetUpload() {
  document.getElementById('upload-success').style.display  = 'none';
  document.getElementById('upload-empty').style.display    = 'flex';
  document.getElementById('qr-box').innerHTML              = '';
  document.getElementById('share-link-input').value        = '';
  document.getElementById('file-input').value              = '';
}

// ─── Upload file (real XHR with progress) ───
function uploadFile(file) {
  const empty    = document.getElementById('upload-empty');
  const progress = document.getElementById('upload-progress');
  const bar      = document.getElementById('progress-bar');
  const pct      = document.getElementById('progress-pct');
  const fnEl     = document.getElementById('progress-filename');

  empty.style.display    = 'none';
  progress.style.display = 'flex';
  fnEl.textContent       = file.name;
  bar.style.width        = '0%';
  pct.textContent        = '0%';

  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload', true);

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      bar.style.width = percent + '%';
      pct.textContent = percent + '%';
    }
  };

  xhr.onload = function () {
    progress.style.display = 'none';
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      showSuccess(file.name, data.file_id);
      loadRecentFiles();
    } else {
      showToast('⚠ Upload failed — please try again.');
      empty.style.display = 'flex';
    }
  };

  xhr.onerror = function () {
    progress.style.display = 'none';
    empty.style.display    = 'flex';
    showToast('⚠ Network error — check your connection.');
  };

  xhr.send(formData);
}

// ─── Show success state ───
function showSuccess(filename, fileId) {
  const success   = document.getElementById('upload-success');
  const qrBox     = document.getElementById('qr-box');
  const linkInput = document.getElementById('share-link-input');
  const fnEl      = document.getElementById('success-filename');

  const shareURL = `${window.location.protocol}//${window.location.host}/file/${fileId}`;

  fnEl.textContent      = filename;
  linkInput.value       = shareURL;
  success.style.display = 'flex';

  qrBox.innerHTML = '';
  new QRCode(qrBox, {
    text: shareURL,
    width: 128,
    height: 128,
    colorDark: '#000',
    colorLight: '#fff',
  });

  showToast('✓ File uploaded — link ready to share!');
}

// ─── File input change ───
document.getElementById('file-input').addEventListener('change', function (e) {
  Array.from(e.target.files).forEach(file => uploadFile(file));
});

// ─── Drag & drop ───
const zone = document.getElementById('upload-zone');

zone.addEventListener('dragover', e => {
  e.preventDefault();
  zone.classList.add('drag-over');
});

zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  Array.from(e.dataTransfer.files).forEach(file => uploadFile(file));
});

// ─── Paste anywhere (but not inside inputs/textareas) ───
document.addEventListener('paste', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) { uploadFile(file); break; }
    }
  }
});

// ─── Load recent files from backend ───
async function loadRecentFiles() {
  try {
    const response = await fetch('/recent-files');
    if (!response.ok) throw new Error('Failed');

    const files = await response.json();
    const recentList = document.getElementById('recent-list');
    recentList.innerHTML = '';

    if (files.length === 0) {
      recentList.innerHTML = '<div style="padding:0.75rem;font-size:0.8rem;color:var(--muted);text-align:center;">No files shared yet</div>';
      return;
    }

    // Limit to 3 most recent files only
    files.slice(0, 3).forEach(file => {
      const sizeMB = (file.file_size / (1024 * 1024)).toFixed(2);
      const ext    = file.file_name.split('.').pop().toLowerCase();

      let iconClass = 'file-code';
      let iconTag   = 'fa-file-code';
      if (['pdf'].includes(ext))                                      { iconClass = 'file-pdf';  iconTag = 'fa-file-pdf'; }
      else if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) { iconClass = 'file-img';  iconTag = 'fa-image'; }
      else if (['mp4','mov','avi','mkv'].includes(ext))               { iconClass = 'file-code'; iconTag = 'fa-file-video'; }
      else if (['zip','tar','gz','rar'].includes(ext))                { iconClass = 'file-code'; iconTag = 'fa-file-zipper'; }

      const rawTs  = file.uploaded_at.endsWith('Z') ? file.uploaded_at : file.uploaded_at + 'Z';
      const uploaded = new Date(rawTs);
      const diffMin  = Math.round((Date.now() - uploaded) / 60000);
      let timeAgo    = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : diffMin < 1440 ? `${Math.floor(diffMin/60)}h ago` : `${Math.floor(diffMin/1440)}d ago`;

      const item = document.createElement('div');
      item.className = 'recent-item';
      item.innerHTML = `
        <div class="ri-icon ${iconClass}"><i class="fa-solid ${iconTag}"></i></div>
        <div class="ri-info">
          <div class="ri-name">${file.file_name}</div>
          <div class="ri-meta">${timeAgo} · ${sizeMB} MB</div>
        </div>
        <div class="ri-status done">Shared</div>
      `;

      item.style.cursor = 'pointer';
      item.title = 'Click to copy share link';
      item.addEventListener('click', () => {
        const url = `${window.location.protocol}//${window.location.host}/file/${file.file_id}`;
        navigator.clipboard.writeText(url).then(() => showToast(`✓ Link copied for ${file.file_name}`));
      });

      recentList.appendChild(item);
    });
  } catch (err) {
    const recentList = document.getElementById('recent-list');
    if (recentList) {
      recentList.innerHTML = '<div style="padding:0.75rem;font-size:0.8rem;color:var(--muted);text-align:center;">Could not load recent files</div>';
    }
  }
}

loadRecentFiles();

// ─── Load real dashboard stats ───
async function loadStats() {
  try {
    const res = await fetch('/stats');
    if (!res.ok) return;
    const data = await res.json();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('stat-files',   data.total_files.toLocaleString());
    set('stat-rooms',   data.live_rooms);
    set('stat-devices', data.live_viewers);
    set('stat-uptime',  data.uptime_days !== null ? (data.uptime_days > 0 ? `${data.uptime_days}d` : '< 1d') : '99.9%');

    set('stat-rooms-trend',   `↑ ${data.rooms_24h} new today`);
    set('stat-devices-trend', `${data.live_viewers} connected now`);

    const sizeMB = (data.total_size_bytes / (1024 * 1024)).toFixed(0);
    set('stat-files-trend', sizeMB > 0 ? `${sizeMB} MB total` : '');
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

loadStats();
const _statsInterval = setInterval(loadStats, 30000);
window.addEventListener('beforeunload', () => clearInterval(_statsInterval));

// ─── Load dynamic active rooms ─────────────────────────────────────────────
function langIcon(lang) {
  const map = {
    python: 'fa-python', javascript: 'fa-js', typescript: 'fa-js',
    html: 'fa-html5', css: 'fa-css3-alt', bash: 'fa-terminal',
    sql: 'fa-database', markdown: 'fa-file-lines',
  };
  const brand = ['python','javascript','typescript','html','css'];
  const prefix = brand.includes(lang) ? 'fa-brands' : 'fa-solid';
  const icon = map[lang] || 'fa-code';
  return `<i class="${prefix} ${icon}"></i>`;
}

function timeAgo(isoStr) {
  const raw  = isoStr.endsWith('Z') ? isoStr : isoStr + 'Z';
  const diff = Math.round((Date.now() - new Date(raw)) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

async function loadRooms() {
  const list = document.getElementById('rooms-list');
  if (!list) return;

  try {
    const res = await fetch('/rooms');
    if (!res.ok) throw new Error('Failed');
    const rooms = await res.json();

    list.innerHTML = '';

    if (rooms.length === 0) {
      list.innerHTML = `
        <div class="rooms-empty">
          <div class="re-icon"><i class="fa-solid fa-satellite-dish"></i></div>
          <div class="re-title">No one is live right now</div>
          <div class="re-sub">Rooms only appear here while someone has them open. Share your room link to invite someone — once they join, it shows up here.</div>
          <a href="codeshare.html" class="re-btn">
            <i class="fa-solid fa-circle-plus"></i> Create a Room
          </a>
        </div>`;
      return;
    }

    rooms.forEach(room => {
      const row = document.createElement('div');
      row.className = 'room-row';
      const people = room.total;
      const peopleLabel = people === 1 ? '1 person' : `${people} people`;

      row.innerHTML = `
        <div class="rr-dot live"></div>
        <div class="rr-info">
          <div class="rr-name">${escapeHtml(room.title)}</div>
          <div class="rr-meta">
            ${langIcon(room.language)}
            ${room.language}
            ${room.has_password ? '&nbsp;·&nbsp;<i class="fa-solid fa-lock" style="font-size:0.65rem;color:var(--muted)"></i>' : ''}
            &nbsp;·&nbsp;${timeAgo(room.created_at)}
          </div>
        </div>
        <div class="rr-people">${peopleLabel}</div>
        <div class="rr-action" onclick="openRoom('${room.room_id}')">Join →</div>
      `;
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `
      <div class="rooms-empty">
        <div class="re-icon"><i class="fa-solid fa-satellite-dish"></i></div>
        <div class="re-title">No one is live right now</div>
        <div class="re-sub">Rooms only appear here while someone has them open. Share your room link to invite someone — once they join, it shows up here.</div>
        <a href="codeshare.html" class="re-btn">
          <i class="fa-solid fa-circle-plus"></i> Create a Room
        </a>
      </div>`;
  }
}

function openRoom(roomId) {
  window.location.href = `codeshare.html?room=${roomId}`;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadRooms();
const _roomsInterval = setInterval(loadRooms, 15000);
window.addEventListener('beforeunload', () => clearInterval(_roomsInterval));

// ─── Quick action buttons ───
document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const label = btn.textContent.trim();
    if (label.includes('Code Share') || label.includes('Text Share') || label.includes('New Room')) {
      window.location.href = 'codeshare.html';
    } else if (label.includes('QR Scan')) {
      showToast('Point your camera at a ShareYou QR code to open it.');
    } else {
      showToast(`${label} — coming soon!`);
    }
  });
});

// ─── Dashboard "New Room" button ───
document.querySelectorAll('.rp-new-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    window.location.href = 'codeshare.html';
  });
});

// ─── Editor tabs ───
document.querySelectorAll('.etab').forEach(tab => {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.etab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
});