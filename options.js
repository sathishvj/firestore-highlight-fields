document.addEventListener('DOMContentLoaded', () => {
  const settingsTextarea = document.getElementById('settings');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

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
});
