document.addEventListener('DOMContentLoaded', () => {
  const settingsTextarea = document.getElementById('settings');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');
  const extractButton = document.getElementById('extract');
  const urlInput = document.getElementById('url-input');

  // Load existing settings
  chrome.storage.sync.get('highlightSettings', (data) => {
    if (data.highlightSettings) {
      settingsTextarea.value = data.highlightSettings;
    }
  });

  saveButton.addEventListener('click', () => {
    const settings = settingsTextarea.value;
    chrome.storage.sync.set({ highlightSettings: settings }, () => {
      statusDiv.textContent = 'Settings saved!';
      setTimeout(() => { statusDiv.textContent = ''; }, 2000);
    });
  });

  extractButton.addEventListener('click', () => {
    const urlStr = urlInput.value.trim();
    if (!urlStr) return;

    try {
      const url = new URL(urlStr);
      const host = url.hostname;
      const path = url.pathname;
      let rule = null;

      if (host === "localhost" || host === "127.0.0.1") {
        // Emulator: /firestore/{database}/data/{encodedPath}
        const match = path.match(/\/firestore\/(.*?)\/data\/(.*)/);
        if (match) {
          const database = match[1];
          const encodedPath = match[2];
          const decodedPath = decodeURIComponent(encodedPath.replace(/~2F/g, '/')).replace(/\/+/g, '/');
          const parts = decodedPath.split('/').filter(p => p !== "");
          const collections = parts.filter((_, i) => i % 2 === 0);
          rule = `-ignored- | ${database} | ${collections.join(', ')} | `;
        }
      } else if (host === "console.firebase.google.com") {
        // Production: .../project/{project}/firestore/databases/{database}/data/{encodedPath}
        const match = path.match(/\/project\/(.*?)\/firestore\/databases\/(.*?)\/data\/(.*)/);
        if (match) {
          const project = match[1];
          const database = match[2];
          const encodedPath = match[3];
          const decodedPath = decodeURIComponent(encodedPath.replace(/~2F/g, '/')).replace(/\/+/g, '/');
          const parts = decodedPath.split('/').filter(p => p !== "");
          const collections = parts.filter((_, i) => i % 2 === 0);
          rule = `${project} | ${database} | ${collections.join(', ')} | `;
        }
      }

      if (rule) {
        const currentVal = settingsTextarea.value.trim();
        settingsTextarea.value = currentVal ? `${currentVal}\n${rule}` : rule;
        urlInput.value = '';
        statusDiv.textContent = 'Rule extracted!';
        setTimeout(() => { statusDiv.textContent = ''; }, 2000);
      } else {
        alert('Could not parse Firestore URL. Please make sure it is a valid document path.');
      }
    } catch (e) {
      alert('Invalid URL format.');
    }
  });
});
