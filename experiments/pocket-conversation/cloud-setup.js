(() => {
  'use strict';
  const field = id => document.getElementById(id);
  const form = field('cloudSetup'), button = field('configure'), status = field('setupStatus');
  let token = '', busy = false;
  function clearKeys() { field('anthropicKey').value = ''; field('elevenlabsKey').value = ''; }
  async function readResult(response) {
    if (response.headers.get('Content-Length') === null || Number(response.headers.get('Content-Length')) > 4096) throw Error();
    const body = await response.text();
    if (body.length > 4096) throw Error();
    return JSON.parse(body);
  }
  function availability(value) {
    return 'Claude: ' + (value.brain ? 'configured' : 'not configured') + '. ElevenLabs: ' + (value.voice ? 'configured' : 'not configured') + '.';
  }
  async function check() {
    try {
      const response = await fetch('/api/status', {cache: 'no-store', credentials: 'same-origin'});
      const value = await readResult(response);
      if (!response.ok || value.conversation !== true || typeof value.token !== 'string' || !value.cloud) throw Error();
      token = value.token;
      button.disabled = false;
      status.textContent = availability(value.cloud) + ' Ready for session-only setup. No provider contacted.';
    } catch {
      token = '';
      button.disabled = true;
      status.textContent = 'Local companion unavailable. Restart it and refresh this page. No provider contacted.';
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !token) return;
    busy = true; button.disabled = true;
    let payload = JSON.stringify({anthropicKey: field('anthropicKey').value, anthropicModel: field('anthropicModel').value,
      elevenlabsKey: field('elevenlabsKey').value, elevenlabsVoiceId: field('elevenlabsVoiceId').value,
      elevenlabsModel: field('elevenlabsModel').value});
    clearKeys();
    try {
      const pending = fetch('/api/cloud-configure', {method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: {'Content-Type': 'application/json', 'X-Skelly-Token': token}, body: payload});
      payload = '';
      const response = await pending, value = await readResult(response);
      if (response.status === 409) {
        status.textContent = 'Skelly is busy. Wait for the turn to finish, then enter the key again. Nothing changed.';
      } else if (!response.ok || value.configured !== true || !value.cloud) {
        status.textContent = 'Setup was rejected. Check the key, voice ID and model, then enter the key again. Nothing changed.';
      } else {
        status.textContent = availability(value.cloud) + ' Connected for this companion session. Local mode remains the default. No provider contacted.';
      }
    } catch {
      status.textContent = 'Could not confirm setup. Check the local companion and refresh. No provider request was made by this page.';
    } finally {
      payload = ''; clearKeys(); busy = false; button.disabled = !token;
    }
  });
  window.addEventListener('pagehide', () => {clearKeys(); token = ''; button.disabled = true;});
  window.addEventListener('pageshow', event => {if (event.persisted) void check();});
  void check();
})();
