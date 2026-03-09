document.addEventListener('DOMContentLoaded', () => {
  const manifestData = chrome.runtime.getManifest();
  const versionSpan = document.getElementById('version-number');
  if (versionSpan) {
    versionSpan.textContent = manifestData.version;
  }
});