// Audio recording synced to notes: strokes and text written while recording remember the
// moment they were made, so selecting them plays the audio from there, and Replay dims
// notes that were written later than the playhead.
import { h, esc, menu, toast, fmtTime, bindRange, prompt } from './ui.js';
import { icon } from './icons.js';
import { uid } from './doc.js';

export class AudioNotes {
  constructor(app) {
    this.app = app;
    this.ed = app.ed;
    this.bar = document.getElementById('audio-bar');
    this.btn = document.getElementById('btn-record');
    this.rec = null;
    this.player = null;
    this.ed.recorder = { active: false, stamp: () => null };
    this.ed.on('document', () => this.closePlayer());
    this.ed.on('canvasReady', () => { if (this.player?.replay) this.applyReplay(); });
  }

  get recordings() {
    this.ed.meta.recordings ||= [];
    return this.ed.meta.recordings;
  }

  hasRecording(id) { return this.recordings.some((r) => r.id === id); }

  toggle() {
    if (this.rec) this.stop();
    else if (this.player) this.closePlayer();
    else if (this.recordings.length) {
      menu([
        { label: 'Start a new recording', icon: 'mic', action: () => this.start() },
        '-',
        { head: 'Recordings in this notebook' },
        ...this.recordings.map((r) => ({ label: `${r.name} · ${fmtTime(r.duration)}`, icon: 'play', action: () => this.openPlayer(r) })),
      ], this.btn);
    } else this.start();
  }

  async start() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast('No microphone is available. Check Windows privacy settings for microphone access.');
      return;
    }
    this.closePlayer();
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 });
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const id = uid('rec');
    const startedAt = performance.now();
    this.rec = { mr, stream, chunks, id, startedAt };
    this.ed.recorder = {
      active: true,
      stamp: (t) => ({ rec: id, t: Math.max(0, ((t || performance.now()) - startedAt) / 1000) }),
    };
    mr.start(1000);
    this.btn.classList.add('recording');
    this.btn.title = 'Stop recording';
    this.bar.hidden = false;
    this.bar.innerHTML = '';
    const ui = h(`<div style="display:contents"><span class="rec-dot"></span><span class="time">0:00</span><span class="muted" style="flex:1">Recording — everything you write is linked to this moment</span><button class="btn small">${icon('close', 14)} Stop</button></div>`);
    ui.querySelector('button').addEventListener('click', () => this.stop());
    this.bar.appendChild(ui);
    this.timer = setInterval(() => {
      const t = this.bar.querySelector('.time');
      if (t) t.textContent = fmtTime((performance.now() - startedAt) / 1000);
    }, 500);
  }

  async stop() {
    const r = this.rec;
    if (!r) return;
    this.rec = null;
    clearInterval(this.timer);
    const done = new Promise((res) => { r.mr.onstop = res; });
    r.mr.stop();
    await done;
    r.stream.getTracks().forEach((t) => t.stop());
    this.ed.recorder = { active: false, stamp: () => null };
    this.btn.classList.remove('recording');
    this.btn.title = 'Record audio synced to your notes';
    const blob = new Blob(r.chunks, { type: 'audio/webm' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const assetId = this.ed.assets.add(bytes, 'audio/webm');
    const duration = (performance.now() - r.startedAt) / 1000;
    const rec = { id: r.id, assetId, duration, createdAt: new Date().toISOString(), name: `Recording ${this.recordings.length + 1}` };
    this.recordings.push(rec);
    this.ed.setDirty(true);
    toast(`Saved ${rec.name} (${fmtTime(duration)}). Select any note to play from that moment.`);
    this.openPlayer(rec);
  }

  openPlayer(rec, at = 0) {
    this.closePlayer();
    const url = this.ed.assets.url(rec.assetId);
    if (!url) { toast('This recording is missing from the notebook file'); return; }
    const audio = new Audio(url);
    audio.preload = 'auto';
    this.player = { rec, audio, replay: false };
    this.bar.hidden = false;
    this.bar.innerHTML = '';
    const ui = h(`<div style="display:contents">
      <button class="ibtn play" title="Play / pause">${icon('play', 18)}</button>
      <span class="time">0:00 / ${fmtTime(rec.duration)}</span>
      <input type="range" min="0" max="${rec.duration}" step="0.1" value="0" aria-label="Position">
      <button class="chip name" title="Recordings">${esc(rec.name)}${icon('chevronDown', 14)}</button>
      <button class="chip replay" title="Dim notes written after the current moment">Replay notes</button>
      <button class="ibtn close" title="Close player">${icon('close', 16)}</button></div>`);
    this.bar.appendChild(ui);
    const playBtn = this.bar.querySelector('.play');
    const range = this.bar.querySelector('input');
    const time = this.bar.querySelector('.time');
    const paint = bindRange(range, (v) => { audio.currentTime = v; this.applyReplay(); });
    const setIcon = () => { playBtn.innerHTML = icon(audio.paused ? 'play' : 'pause', 18); };
    playBtn.addEventListener('click', () => { if (audio.paused) audio.play(); else audio.pause(); });
    audio.addEventListener('play', setIcon);
    audio.addEventListener('pause', setIcon);
    audio.addEventListener('timeupdate', () => {
      range.value = audio.currentTime;
      paint();
      time.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(rec.duration)}`;
      this.applyReplay();
    });
    audio.addEventListener('ended', () => setIcon());
    this.bar.querySelector('.replay').addEventListener('click', (e) => {
      this.player.replay = !this.player.replay;
      e.currentTarget.classList.toggle('on', this.player.replay);
      if (this.player.replay) this.applyReplay(); else this.clearReplay();
    });
    this.bar.querySelector('.name').addEventListener('click', (e) => menu([
      ...this.recordings.map((r) => ({ label: `${r.name} · ${fmtTime(r.duration)}`, checked: r.id === rec.id, action: () => this.openPlayer(r) })),
      '-',
      { label: 'Rename…', action: async () => { const n = await prompt('Rename recording', rec.name); if (n) { rec.name = n; this.ed.setDirty(true); this.openPlayer(rec, audio.currentTime); } } },
      { label: 'Delete recording', danger: true, action: () => { this.ed.meta.recordings = this.recordings.filter((r) => r !== rec); this.ed.setDirty(true); this.closePlayer(); } },
    ], e.currentTarget));
    this.bar.querySelector('.close').addEventListener('click', () => this.closePlayer());
    if (at) audio.currentTime = at;
  }

  playFrom(ref) {
    const rec = this.recordings.find((r) => r.id === ref.rec);
    if (!rec) return;
    if (this.player?.rec !== rec) this.openPlayer(rec);
    const { audio } = this.player;
    audio.currentTime = Math.max(0, ref.t - 2);
    audio.play();
  }

  applyReplay() {
    const p = this.player;
    if (!p?.replay) return;
    const now = p.audio.currentTime;
    for (const v of this.ed.views.values()) {
      if (!v.fc) continue;
      let dirty = false;
      v.fc.forEachObject((o) => {
        if (o.audioRef?.rec !== p.rec.id) return;
        if (o.__baseOpacity === undefined) o.__baseOpacity = o.opacity;
        const target = o.audioRef.t > now ? o.__baseOpacity * 0.12 : o.__baseOpacity;
        if (o.opacity !== target) { o.opacity = target; dirty = true; }
      });
      if (dirty) v.fc.requestRenderAll();
    }
  }

  clearReplay() {
    for (const v of this.ed.views.values()) {
      if (!v.fc) continue;
      v.fc.forEachObject((o) => {
        if (o.__baseOpacity !== undefined) { o.opacity = o.__baseOpacity; delete o.__baseOpacity; }
      });
      v.fc.requestRenderAll();
    }
  }

  closePlayer() {
    if (this.player) {
      this.player.audio.pause();
      this.clearReplay();
      this.player = null;
    }
    if (!this.rec) { this.bar.hidden = true; this.bar.innerHTML = ''; }
  }
}
