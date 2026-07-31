// Popup: configure the token, toggle enabled/review, show today's counts.
const $ = (id) => document.getElementById(id)

async function load() {
  const s = await chrome.storage.local.get(['token', 'enabled', 'reviewMode', 'apiBase'])
  $('apiBase').value = s.apiBase || 'https://ozigi.app'
  $('token').value = s.token || ''
  $('enabled').checked = !!s.enabled
  $('review').checked = !!s.reviewMode
  chrome.runtime.sendMessage({ type: 'status' }, (st) => {
    if (!st) return
    $('dot').classList.toggle('on', st.enabled && st.hasToken)
    $('cCount').textContent = String(st.counters?.connect ?? 0)
    $('mCount').textContent = String(st.counters?.message ?? 0)
  })
}

$('save').addEventListener('click', async () => {
  const token = $('token').value.trim()
  await chrome.storage.local.set({
    token,
    apiBase: ($('apiBase').value.trim() || 'https://ozigi.app').replace(/\/$/, ''),
    enabled: $('enabled').checked,
    reviewMode: $('review').checked,
  })
  $('msg').textContent = token ? 'Saved. The sender is active while LinkedIn is open.' : 'Saved (add a token to start).'
  load()
})

$('enabled').addEventListener('change', () => chrome.storage.local.set({ enabled: $('enabled').checked }).then(load))
$('review').addEventListener('change', () => chrome.storage.local.set({ reviewMode: $('review').checked }))
$('run').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'runNow' }, () => { $('msg').textContent = 'Checking for the next action…' })
})

load()
