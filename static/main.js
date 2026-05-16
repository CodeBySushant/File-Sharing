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

// Close nav on link click
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
  setTimeout(() => t.classList.remove('show'), duration);
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
  document.getElementById('upload-success').style.display = 'none';
  document.getElementById('upload-empty').style.display   = 'flex';
  document.getElementById('qr-box').innerHTML = '';
  document.getElementById('share-link-input').value = '';
  document.getElementById('file-input').value = '';
}

// ─── Simulate progress bar ───
function simulateProgress(filename, onComplete) {
  const empty    = document.getElementById('upload-empty');
  const progress = document.getElementById('upload-progress');
  const bar      = document.getElementById('progress-bar');
  const pct      = document.getElementById('progress-pct');
  const fnEl     = document.getElementById('progress-filename');

  empty.style.display    = 'none';
  progress.style.display = 'flex';
  fnEl.textContent       = filename;

  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 18;
    if (p >= 100) { p = 100; clearInterval(interval); onComplete(); }
    bar.style.width    = p + '%';
    pct.textContent    = Math.floor(p) + '%';
  }, 120);
}

// ─── Upload file ───
async function uploadFile(file) {
  simulateProgress(file.name, async () => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });

      document.getElementById('upload-progress').style.display = 'none';

      if (response.ok) {
        const data = await response.json();
        showSuccess(file.name, data.file_id);
      } else {
        showToast('⚠ Upload failed — please try again.');
        document.getElementById('upload-empty').style.display = 'flex';
      }
    } catch {
      // Dev/demo mode: show fake success
      document.getElementById('upload-progress').style.display = 'none';
      showSuccess(file.name, 'demo-' + Math.random().toString(36).slice(2, 8));
    }
  });
}

function showSuccess(filename, fileId) {
  const success  = document.getElementById('upload-success');
  const qrBox    = document.getElementById('qr-box');
  const linkInput = document.getElementById('share-link-input');
  const fnEl     = document.getElementById('success-filename');

  const shareURL = `${window.location.protocol}//${window.location.host}/file/${fileId}`;

  fnEl.textContent    = filename;
  linkInput.value     = shareURL;
  success.style.display = 'flex';

  qrBox.innerHTML = '';
  new QRCode(qrBox, { text: shareURL, width: 128, height: 128, colorDark: '#000', colorLight: '#fff' });

  showToast('✓ File uploaded — link ready to share!');
}

// ─── File input change ───
document.getElementById('file-input').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) uploadFile(file);
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
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

// ─── Paste anywhere ───
document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) { uploadFile(file); break; }
    }
  }
});

// ─── Quick action buttons (demo) ───
document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    showToast(`${btn.textContent.trim()} — coming soon!`);
  });
});

document.querySelectorAll('.rp-new-btn, .rr-action').forEach(btn => {
  btn.addEventListener('click', () => showToast('Collaborative rooms — coming soon!'));
});

document.querySelectorAll('.etab:not(.active)').forEach(tab => {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.etab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
});