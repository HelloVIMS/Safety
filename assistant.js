// The robot in the header opens the VIMS app assistant (chat.vims.com,
// on the visitor's own model key) at the right, told which model is open.
(function () {
  var btn = document.getElementById('ai-btn'), panel = document.getElementById('ai-panel');
  if (!btn || !panel) return;
  var ORIGIN = 'https://chat.vims.com', frame = null;
  function context() {
    var insp = document.getElementById('insp');
    if (!insp || insp.style.display === 'none') return 'No model is open; the map shows every registered model by risk class.';
    var name = (document.getElementById('in-name') || {}).textContent || '';
    var cls = (document.getElementById('in-cls') || {}).textContent || '';
    var body = ((document.getElementById('in-body') || {}).innerText || '').slice(0, 3000);
    return 'Open model: ' + name + ' (risk class ' + cls + ').\n' + body;
  }
  function send() { if (frame && frame.contentWindow) frame.contentWindow.postMessage({ vims: 'assistant-context', text: context() }, ORIGIN); }
  function toggle() {
    var open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-pressed', String(open));
    btn.setAttribute('aria-label', open ? 'Close AI assistant' : 'Open AI assistant');
    if (open && !frame) {
      frame = document.createElement('iframe');
      frame.title = 'Safety assistant';
      frame.src = ORIGIN + '/assistant/?app=safety';
      frame.allow = 'clipboard-read; clipboard-write';
      frame.addEventListener('load', send);
      panel.appendChild(frame);
    }
    send();
  }
  btn.addEventListener('click', toggle);
  window.addEventListener('message', function (e) { if (e.origin === ORIGIN && e.data && e.data.vims === 'assistant-ready') send(); });
  var insp = document.getElementById('insp');
  if (insp && window.MutationObserver) new MutationObserver(function () { if (!panel.hidden) send(); }).observe(insp, { subtree: true, childList: true, attributes: true, characterData: true });
})();
