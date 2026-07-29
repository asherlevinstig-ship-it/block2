const root = document.getElementById('introcinematic');
const video = document.getElementById('introvideo');
const audio = document.getElementById('introaudio');
const startBtn = document.getElementById('introstart');
const skipBtn = document.getElementById('introskip');
const countEl = document.getElementById('introcount');
const statusEl = document.getElementById('introstatus');

const sources = ['/assets/intro/vid1.mp4', '/assets/intro/vid2.mp4'];

function createOpeningReady() {
  if (!root || !video || !sources.length) return Promise.resolve();
  let index = 0;
  let done = false;
  let startedWithGesture = false;
  let audioStarted = false;
  let resolveReady = () => {};
  const ready = new Promise(resolve => { resolveReady = resolve; });
  try { if (audio) audio.loop = true; } catch (_) {}

  function showStart(text = 'Click to play opening with sound') {
    root.classList.add('needs-gesture');
    if (startBtn) startBtn.hidden = false;
    if (statusEl) statusEl.textContent = text;
  }

  function hideStart() {
    root.classList.remove('needs-gesture');
    if (startBtn) startBtn.hidden = true;
  }

  function stopSoundtrack() {
    try {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch (_) {}
    audioStarted = false;
  }

  function startSoundtrack(reset = false) {
    if (!audio || audioStarted) return Promise.resolve();
    audioStarted = true;
    try {
      if (reset) audio.currentTime = 0;
      audio.volume = 0.45;
    } catch (_) {}
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      return attempt.catch(() => {
        audioStarted = false;
        showStart();
      });
    }
    return Promise.resolve();
  }

  function finish() {
    if (done) return;
    done = true;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (_) {}
    hideStart();
    root.classList.add('done');
    setTimeout(() => root.classList.add('hidden'), 460);
    resolveReady();
  }

  function setVideoSource() {
    if (index >= sources.length) {
      finish();
      return false;
    }
    if (countEl) countEl.textContent = 'Opening ' + (index + 1) + ' / ' + sources.length;
    if (statusEl) statusEl.textContent = startedWithGesture
      ? (index === 0 ? 'The world wakes' : 'The gates answer')
      : 'Click to play opening with sound';
    video.src = sources[index];
    video.currentTime = 0;
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;
    return true;
  }

  function playCurrent() {
    if (done || !setVideoSource()) return;
    if (startedWithGesture) {
      hideStart();
      startSoundtrack(index === 0);
    } else {
      showStart();
    }
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => showStart('Click to play opening'));
  }

  function startWithGesture() {
    startedWithGesture = true;
    index = 0;
    stopSoundtrack();
    playCurrent();
  }

  globalThis.BlockcraftOpeningAudio = {
    startAmbient() {
      startedWithGesture = true;
      return startSoundtrack(false);
    },
    stop: stopSoundtrack,
    get active() {
      return !!audioStarted;
    },
  };

  video.addEventListener('ended', () => {
    if (!startedWithGesture) {
      index = (index + 1) % sources.length;
      playCurrent();
      return;
    }
    index++;
    playCurrent();
  });
  video.addEventListener('error', () => {
    index++;
    playCurrent();
  });
  if (skipBtn) skipBtn.addEventListener('click', finish);
  if (startBtn) startBtn.addEventListener('click', startWithGesture);
  root.addEventListener('click', event => {
    if (event.target === skipBtn || event.target === startBtn) return;
    if (!startedWithGesture) startWithGesture();
  });
  root.addEventListener('keydown', event => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      if (!startedWithGesture) startWithGesture();
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      finish();
    }
  });

  root.tabIndex = -1;
  requestAnimationFrame(() => {
    try { root.focus({ preventScroll: true }); } catch (_) {}
    playCurrent();
  });
  return ready;
}

globalThis.BlockcraftOpeningReady = createOpeningReady();
