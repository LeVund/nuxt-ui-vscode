export const WEBVIEW_SCRIPT = `
    // Accordion toggle
    document.querySelectorAll('.accordion-header').forEach(function(header) {
      header.addEventListener('click', function() {
        var targetId = header.dataset.target;
        var accordion = document.getElementById(targetId);
        if (accordion) {
          accordion.classList.toggle('is-open');
        }
      });
    });

    // Slot insertion
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-slot]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertSlot', slotName: btn.dataset.slot });
      });
    });

    // Prop insertion
    document.querySelectorAll('[data-prop]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertProp', propName: btn.dataset.prop });
      });
    });

    // UI key insertion
    document.querySelectorAll('[data-ui-key]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertUiKey', keyName: btn.dataset.uiKey });
      });
    });
`;
