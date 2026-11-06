// The robot in the header opens the VIMS app assistant at the right — the
// visitor's own model key (BYOK), their connectors, their VIMS's tools —
// told which model is open. vendor/vims-assistant.{js,css} are built from
// VIMS (scripts/build-assistant-embed.mjs vendor) and load on first open.
(function () {
  var btn = document.getElementById('ai-btn'), panel = document.getElementById('ai-panel');
  if (!btn || !panel) return;
  var mounted = false, loading = null;
  function context() {
    var insp = document.getElementById('insp');
    if (!insp || insp.style.display === 'none') return 'No model is open; the map shows every registered model by risk class.';
    var name = (document.getElementById('in-name') || {}).textContent || '';
    var cls = (document.getElementById('in-cls') || {}).textContent || '';
    var body = ((document.getElementById('in-body') || {}).innerText || '').slice(0, 3000);
    return 'Open model: ' + name + ' (risk class ' + cls + ').\n' + body;
  }
  function load() {
    return loading || (loading = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = '/vendor/vims-assistant.js?v=1';
      s.onload = ok;
      s.onerror = function () { loading = null; fail(new Error('the assistant did not load')); };
      document.head.appendChild(s);
    }));
  }
  function setOpen(open) {
    panel.hidden = !open;
    btn.setAttribute('aria-pressed', String(open));
    btn.setAttribute('aria-label', open ? 'Close AI assistant' : 'Open AI assistant');
    if (!open || mounted) return;
    load().then(function () {
      if (mounted) return;
      mounted = true;
      window.VimsAssistant.mount(panel, {
        app: 'safety',
        title: 'Safety',
        guidance: "You are the Safety assistant in safety.vims.com, VIMS's console for the four C's of AI safety — certification, classification, containment and control. You explain model classifications and risk, compare models, and help the user decide how to contain and control a model they want to run or deploy.",
        context: context,
        cssUrl: '/vendor/vims-assistant.css?v=1',
        onClose: function () { setOpen(false); },
      });
    }, function (e) { panel.textContent = e.message; });
  }
  btn.addEventListener('click', function () { setOpen(panel.hidden); });
})();
