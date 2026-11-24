// ==UserScript==
// @name         tornotifier
// @namespace    sqlinjected
// @version      1.2
// @description  sound alerts for torn events
// @match        https://www.torn.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/sqlinjected/tornotifier/main/tornotifier.user.js
// @downloadURL  https://raw.githubusercontent.com/sqlinjected/tornotifier/main/tornotifier.user.js
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
  const on = (name) => get('off_' + name) !== '1';

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
      if (on('travel')) play([1047, 150], [784, 150], [1047, 250]);
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
        if (on('hosp')) hospSound();
      }
    }
  }

  async function checkOC(key) {
    const data = await api(key, 'user/organizedcrime');
    if (!data) return;
