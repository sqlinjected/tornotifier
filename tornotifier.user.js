// ==UserScript==
// @name         tornotifier
// @namespace    sqlinjected
// @version      0.2
// @description  sound alerts for torn events
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const KEY_NAME = 'tornotifier_key';
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
