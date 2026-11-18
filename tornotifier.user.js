// ==UserScript==
// @name         tornotifier
// @namespace    sqlinjected
// @version      0.3
// @description  sound alerts for torn events
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEY_NAME = 'tornotifier_key';
  const POLL_MS = 30000;
  const audio = new AudioContext();

  function beep(freq = 880, ms = 200) {
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

  async function start() {
    const key = getKey();
    if (!key) {
      console.log('tornotifier: no api key, stopping');
      return;
    }

    const ok = await checkKey(key);
    if (!ok) return;

    setInterval(() => poll(key), POLL_MS);
  }

  start();
})();
