// Popup: configure the token, toggle enabled/review, show today's counts.
const $ = (id) => document.getElementById(id)

async function load() {
  const s = await chrome.storage.local.get(['token', 'enabled', 'apiBase'])
  $('apiBase').value = s.apiBase || 'https://ozigi.app'
  $('token').value = s.token || ''
  $('enabled').checked = !!s.enabled
  chrome.runtime.sendMessage({ type: 'status' }, (st) => {
    if (!st) return
    // Read the cap back from the worker, which applies DEFAULTS and the settings
    // migration — reading storage directly here would show a stale override.
    $('cap').value = String(st.dailyConnectCap ?? 20)
    const live = st.enabled && st.hasToken
    $('dot').classList.toggle('on', live)
    // The pill must distinguish "off" from "on but unusable" — an enabled
    // extension with no token silently does nothing, which otherwise looks
    // identical to working.
    $('statusText').textContent = !st.hasToken ? 'No token' : st.enabled ? 'Active' : 'Paused'
    $('cCount').textContent = String(st.counters?.connect ?? 0)
    $('lCount').textContent = String(st.counters?.leads ?? 0)
    // Without a token the extension polls nothing, so make that the loudest
    // thing in the popup rather than something folded away in a drawer.
    $('tokenWarn').textContent = st.hasToken ? '' : 'TOKEN REQUIRED'
    if (!st.hasToken) $('settings').open = true
  })
}

$('save').addEventListener('click', async () => {
  const token = $('token').value.trim()
  const cap = Math.min(Math.max(parseInt($('cap').value, 10) || 20, 1), 100)
  await chrome.storage.local.set({
    token,
    dailyConnectCap: cap,
    apiBase: ($('apiBase').value.trim() || 'https://ozigi.app').replace(/\/$/, ''),
    enabled: $('enabled').checked,
  })
  $('msg').textContent = token ? 'Saved. The sender is active while LinkedIn is open.' : 'Saved (add a token to start).'
  load()
})

$('enabled').addEventListener('change', () => chrome.storage.local.set({ enabled: $('enabled').checked }).then(load))
$('run').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'runNow' }, () => { $('msg').textContent = 'Checking for the next action…' })
})

load()
