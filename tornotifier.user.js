// ==UserScript==
// @name         tornotifier
// @namespace    sqlinjected
// @version      0.6
// @description  sound alerts for torn events
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEY_NAME = 'tornotifier_key';
  const ENEMY_NAME = 'tornotifier_enemy';
  const MUTE_NAME = 'tornotifier_muted';
  const OC_ALERTED_NAME = 'tornotifier_oc_alerted';
  const POLL_MS = 30000;
  const audio = new AudioContext();
  const inHosp = new Set();
  let ocStatus = null;

  function isMuted() {
    return localStorage.getItem(MUTE_NAME) === '1';
  }

  function beep(freq = 880, ms = 200) {
    if (isMuted()) return;
    if (audio.state !== 'running') {
      console.log('tornotifier: sound locked, click the page once');
      return;
    }
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + ms / 1000);
  }

  function alertSound() {
    beep(988, 150);
    setTimeout(() => beep(1319, 150), 180);
  }

  function ocSound() {
    beep(660, 120);
    setTimeout(() => beep(880, 120), 150);
    setTimeout(() => beep(1100, 200), 300);
  }

  document.addEventListener('click', () => {
    audio.resume().then(() => {
      console.log('tornotifier: sound on');
      beep(660, 150);
    });
  }, { once: true });

  function getKey() {
    let key = localStorage.getItem(KEY_NAME);
    if (!key) {
      key = prompt('tornotifier: paste your torn api key (limited access)');
      if (key) {
        key = key.trim();
        localStorage.setItem(KEY_NAME, key);
      }
    }
    return key;
  }

  function getEnemy() {
    return localStorage.getItem(ENEMY_NAME) || '';
  }

  async function api(key, path) {
    const res = await fetch('https://api.torn.com/v2/' + path, {
      headers: { Authorization: 'ApiKey ' + key },
    });
    return res.json();
  }

  async function checkKey(key) {
    try {
      const data = await api(key, 'user/basic');

      if (data.error) {
        console.log('tornotifier: api error -', data.error.error);
        if (data.error.code === 2) localStorage.removeItem(KEY_NAME);
        return false;
      }

      console.log('tornotifier: connected as', data.profile.name);
      beep();
      return true;
    } catch (err) {
      console.log('tornotifier: request failed -', err);
      return false;
    }
  }

  async function poll(key) {
    try {
      const data = await api(key, 'user/basic');

      if (data.error) {
        console.log('tornotifier: poll error -', data.error.error);
        return;
      }

      console.log('tornotifier: status -', data.profile.status.description);
    } catch (err) {
      console.log('tornotifier: poll failed -', err);
    }
  }

  async function pollEnemy(key, factionId) {
    try {
      const data = await api(key, 'faction/' + factionId + '/members');

      if (data.error) {
        console.log('tornotifier: enemy poll error -', data.error.error);
        return;
      }

      const members = Array.isArray(data.members)
        ? data.members
        : Object.values(data.members);

      for (const m of members) {
        if (m.status.state === 'Hospital') {
          inHosp.add(m.id);
        } else if (inHosp.has(m.id)) {
          inHosp.delete(m.id);
          console.log('tornotifier:', m.name, 'is out of hospital');
          alertSound();
        }
      }

      console.log('tornotifier: enemies in hospital -', inHosp.size);
    } catch (err) {
      console.log('tornotifier: enemy poll failed -', err);
    }
  }

  async function pollOC(key) {
    try {
      const data = await api(key, 'user/organizedcrime');

      if (data.error) {
        console.log('tornotifier: oc poll error -', data.error.error);
        return;
      }

      const oc = data.organizedCrime || data.organizedcrime;
      if (!oc) {
        ocStatus = null;
        console.log('tornotifier: no oc');
        return;
      }

      console.log('tornotifier: oc -', oc.name, oc.status);

      if (ocStatus && oc.status !== ocStatus) {
        console.log('tornotifier: oc status changed -', ocStatus, '->', oc.status);
        alertSound();
      }
      ocStatus = oc.status;

      const now = Date.now() / 1000;
      const alerted = localStorage.getItem(OC_ALERTED_NAME);
      if (oc.ready_at && now >= oc.ready_at && alerted !== String(oc.id)) {
        localStorage.setItem(OC_ALERTED_NAME, String(oc.id));
        console.log('tornotifier: oc ready -', oc.name);
        ocSound();
      }
    } catch (err) {
      console.log('tornotifier: oc poll failed -', err);
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
    const btn = document.createElement('div');
    btn.textContent = 'tn';
    btn.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;' +
      'background:#222;color:#fff;padding:4px 8px;border-radius:4px;' +
      'font-size:12px;cursor:pointer;';

    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;bottom:36px;left:8px;z-index:99999;' +
      'background:#222;color:#fff;padding:8px;border-radius:4px;' +
      'font-size:12px;display:none;';

    const enemyInput = document.createElement('input');
    enemyInput.placeholder = 'enemy faction id';
    enemyInput.value = getEnemy();
    enemyInput.style.cssText = 'width:130px;margin-bottom:6px;color:#000;';

    const save = makeButton('save', () => {
      const id = enemyInput.value.trim();
      localStorage.setItem(ENEMY_NAME, id);
      inHosp.clear();
      console.log('tornotifier: enemy set to', id || 'none');
      if (id) pollEnemy(key, id);
    });

    const mute = makeButton(isMuted() ? 'unmute' : 'mute', () => {
      localStorage.setItem(MUTE_NAME, isMuted() ? '0' : '1');
      mute.textContent = isMuted() ? 'unmute' : 'mute';
    });

    const test = makeButton('test sound', () => {
      audio.resume().then(alertSound);
    });

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

  async function start() {
    const key = getKey();
    if (!key) {
      console.log('tornotifier: no api key, stopping');
      return;
    }

    const ok = await checkKey(key);
    if (!ok) return;

    buildPanel(key);

    const enemy = getEnemy();
    if (enemy) pollEnemy(key, enemy);
    pollOC(key);

    setInterval(() => {
      poll(key);
      pollOC(key);
      const id = getEnemy();
      if (id) pollEnemy(key, id);
    }, POLL_MS);
  }

  start();
})();
