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

    // Sub-tree (nested accordion) toggle
    document.querySelectorAll('.tree-group-header').forEach(function(header) {
      header.addEventListener('click', function(e) {
        e.stopPropagation();
        var subId = header.dataset.subtree;
        var subList = document.getElementById(subId);
        if (subList) {
          header.parentElement.classList.toggle('is-open');
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
      } else if (item.dataset.event) {
        vscode.postMessage({ command: 'insertEvent', eventName: item.dataset.event });
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

    // Tree group header click (insert action)
    document.querySelectorAll('.tree-group-header').forEach(function(header) {
      header.addEventListener('dblclick', function() { handleTreeItem(header); });
    });

    // Resize handles
    document.querySelectorAll('.resize-handle').forEach(function(handle) {
      var targetId = handle.dataset.resize;
      var section = document.getElementById(targetId);
      if (!section) return;

      handle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        handle.classList.add('is-dragging');
        var startY = e.clientY;
        var startHeight = section.offsetHeight;

        var header = section.querySelector('.treeview-header');
        var body = section.querySelector('.treeview-body');
        var maxHeight = (header ? header.offsetHeight : 22) + (body ? body.scrollHeight : 0);

        function onMouseMove(e) {
          var newHeight = startHeight + (e.clientY - startY);
          if (newHeight < 44) newHeight = 44;
          if (newHeight > maxHeight) newHeight = maxHeight;
          section.style.setProperty('--section-height', newHeight + 'px');
        }

        function stop() {
          handle.classList.remove('is-dragging');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', stop);
          document.documentElement.removeEventListener('mouseleave', stop);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stop);
        document.documentElement.removeEventListener('mouseleave', stop);
        document.documentElement.addEventListener('mouseleave', stop);
      });
    });
`;
