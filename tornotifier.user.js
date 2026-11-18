// ==UserScript==
// @name         tornotifier
// @namespace    sqlinjected
// @version      1.0
// @description  sound alerts for torn events
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEY_NAME = 'tornotifier_key';
  const POLL_MS = 30000;
  const audio = new AudioContext();
  const inHosp = new Set();
  let ocStatus = null;

  // stuff saved in localStorage so alerts don't repeat every time torn loads a new page
  const get = (k) => localStorage.getItem('tornotifier_' + k);
  const set = (k, v) => localStorage.setItem('tornotifier_' + k, v);

  function beep(freq, ms) {
    if (get('muted') === '1') return;
    if (audio.state !== 'running') {
      console.log('tornotifier: sound locked, click the page once');
      return;
    }
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + ms / 1000);
  }

  // play([freq, ms], [freq, ms], ...) one after another
  function play(...notes) {
    notes.forEach(([freq, ms], i) => setTimeout(() => beep(freq, ms), i * 180));
  }

  const hospSound = () => play([988, 150], [1319, 150]);

  // browsers block audio until you click something
  document.addEventListener('click', () => {
    audio.resume().then(() => beep(660, 150));
  }, { once: true });

  async function api(key, path) {
    try {
      const res = await fetch('https://api.torn.com/v2/' + path, {
        headers: { Authorization: 'ApiKey ' + key },
      });
      const data = await res.json();
      if (data.error) {
        console.log('tornotifier:', path, '-', data.error.error);
        if (data.error.code === 2) localStorage.removeItem(KEY_NAME); // bad key
        return null;
      }
      return data;
    } catch (err) {
      console.log('tornotifier:', path, 'failed', err);
      return null;
    }
  }

  async function checkStatus(key) {
    const data = await api(key, 'user/basic');
    if (!data) return false;

    const status = data.profile.status;
    const wasFlying = get('traveling') === '1';

    if (status.state === 'Traveling' && !wasFlying) {
      set('traveling', '1');
    } else if (status.state !== 'Traveling' && wasFlying) {
      set('traveling', '0');
      console.log('tornotifier: landed -', status.description);
      play([1047, 150], [784, 150], [1047, 250]);
    }
    return true;
  }

  async function checkEnemy(key, factionId) {
    const data = await api(key, 'faction/' + factionId + '/members');
    if (!data) return;

    for (const m of data.members) {
      if (m.status.state === 'Hospital') {
        inHosp.add(m.id);
      } else if (inHosp.has(m.id)) {
        inHosp.delete(m.id);
        console.log('tornotifier:', m.name, 'out of hosp');
        hospSound();
      }
    }
  }

  async function checkOC(key) {
    const data = await api(key, 'user/organizedcrime');
    if (!data) return;

    // not sure which one torn actually sends, check this
    const oc = data.organizedCrime || data.organized_crime;
    if (!oc) {
      ocStatus = null;
      return;
    }

    if (ocStatus && oc.status !== ocStatus) {
      console.log('tornotifier: oc', ocStatus, '->', oc.status);
      hospSound();
    }
    ocStatus = oc.status;

    if (oc.ready_at && Date.now() / 1000 >= oc.ready_at && get('oc_alerted') !== String(oc.id)) {
      set('oc_alerted', oc.id);
      console.log('tornotifier: oc ready -', oc.name);
      play([660, 120], [880, 120], [1100, 200]);
    }
  }

  async function checkBars(key) {
    const data = await api(key, 'user/bars');
    if (!data) return;

    for (const name of ['energy', 'nerve']) {
      const bar = data.bars[name];
      const full = bar.current >= bar.maximum;

      if (full && get('full_' + name) !== '1') {
        set('full_' + name, '1');
        console.log('tornotifier:', name, 'full');
        play([523, 200], [659, 250]);
      } else if (!full) {
        set('full_' + name, '0');
      }
    }
  }

  async function checkCooldowns(key) {
    const data = await api(key, 'user/cooldowns');
    if (!data) return;

    for (const name of ['drug', 'booster']) {
      const secs = data.cooldowns[name];
      const wasRunning = get('cd_' + name) === '1';

      if (secs > 0) {
        set('cd_' + name, '1');
      } else if (wasRunning) {
        set('cd_' + name, '0');
        console.log('tornotifier:', name, 'cooldown done');
        play([784, 150], [587, 250]);
      }
    }
  }

  function makeButton(text, onClick) {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'margin:2px;font-size:11px;cursor:pointer;';
    b.addEventListener('click', onClick);
    return b;
  }

  function buildPanel(key) {
    const box = 'position:fixed;left:8px;z-index:99999;background:#222;color:#fff;' +
      'border-radius:4px;font-size:12px;';

    const btn = document.createElement('div');
    btn.textContent = 'tn';
    btn.style.cssText = box + 'bottom:8px;padding:4px 8px;cursor:pointer;';

    const panel = document.createElement('div');
    panel.style.cssText = box + 'bottom:36px;padding:8px;display:none;';

    const enemyInput = document.createElement('input');
    enemyInput.placeholder = 'enemy faction id';
    enemyInput.value = get('enemy') || '';
    enemyInput.style.cssText = 'width:130px;margin-bottom:6px;color:#000;';

    const save = makeButton('save', () => {
      const id = enemyInput.value.trim();
      set('enemy', id);
      inHosp.clear();
      if (id) checkEnemy(key, id);
    });

    const mute = makeButton(get('muted') === '1' ? 'unmute' : 'mute', () => {
      const muted = get('muted') === '1';
      set('muted', muted ? '0' : '1');
      mute.textContent = muted ? 'mute' : 'unmute';
    });

    const test = makeButton('test sound', () => audio.resume().then(hospSound));

    const resetKey = makeButton('reset key', () => {
      localStorage.removeItem(KEY_NAME);
      console.log('tornotifier: key removed, reload to enter a new one');
    });

    panel.append(enemyInput, document.createElement('br'), save, mute, test, resetKey);
    btn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.body.append(btn, panel);
  }

  function checkAll(key) {
    checkStatus(key);
    checkOC(key);
    checkBars(key);
    checkCooldowns(key);
    const enemy = get('enemy');
    if (enemy) checkEnemy(key, enemy);
  }

  async function start() {
    let key = localStorage.getItem(KEY_NAME);
    if (!key) {
      key = (prompt('tornotifier: paste your torn api key (limited access)') || '').trim();
      if (!key) return;
      localStorage.setItem(KEY_NAME, key);
    }

    if (!(await checkStatus(key))) return;
    console.log('tornotifier: running');

    buildPanel(key);
    checkAll(key);
    setInterval(() => checkAll(key), POLL_MS);
  }

  start();
})();
