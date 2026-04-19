export const WEBVIEW_SCRIPT = `
    // Treeview toggle
    document.querySelectorAll('.treeview-header').forEach(function(header) {
      header.addEventListener('click', function() {
        var targetId = header.dataset.target;
        var treeview = document.getElementById(targetId);
        if (treeview) {
          treeview.classList.toggle('is-open');
        }
      });
      header.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });

    // Tree item click & keyboard
    var vscode = acquireVsCodeApi();

    function handleTreeItem(item) {
      if (item.dataset.slot) {
        vscode.postMessage({ command: 'insertSlot', slotName: item.dataset.slot });
      } else if (item.dataset.prop) {
        vscode.postMessage({ command: 'insertProp', propName: item.dataset.prop });
      } else if (item.dataset.uiKey) {
        vscode.postMessage({ command: 'insertUiKey', keyName: item.dataset.uiKey });
      }
    }

    document.querySelectorAll('.tree-item').forEach(function(item) {
      item.addEventListener('click', function() { handleTreeItem(item); });
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleTreeItem(item);
        }
      });
    });
`;
