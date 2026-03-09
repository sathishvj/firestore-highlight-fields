/***********************************************************
 * HIGHLIGHTING LOGIC
 ***********************************************************/

/**
 * Parses current URL into Firestore components: project, database, and a list of collection names.
 */
function getFirestoreInfo() {
  const host = window.location.hostname;
  const path = window.location.pathname;
  
  if (host === "localhost" || host === "127.0.0.1") {
    // Emulator: /firestore/{database}/data/{encodedPath}
    const match = path.match(/\/firestore\/(.*?)\/data\/(.*)/);
    if (match) {
      const database = match[1];
      const project = "default";
      const encodedPath = match[2];
      const decodedPath = decodeURIComponent(encodedPath.replace(/~2F/g, '/')).replace(/\/+/g, '/');
      const parts = decodedPath.split('/').filter(p => p !== "");
      
      // Collections are at even indices in the path parts (0, 2, 4...)
      const collections = parts.filter((_, i) => i % 2 === 0);
      return { project, database, collections };
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
      return { project, database, collections };
    }
  }
  return null;
}

let cachedSettings = null;
let lastSettingsFetch = 0;

async function getSettings() {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsFetch < 5000)) {
    return cachedSettings;
  }

  return new Promise((resolve) => {
    chrome.storage.sync.get('highlightSettings', (data) => {
      const settings = [];
      if (data.highlightSettings) {
        const lines = data.highlightSettings.split('\n');
        lines.forEach(line => {
          const parts = line.split('|');
          if (parts.length === 4) {
            const project = parts[0].trim();
            const database = parts[1].trim();
            const collections = parts[2].split(',').map(c => c.trim().toLowerCase());
            const fields = parts[3].split(',').map(f => f.trim());
            settings.push({ project, database, collections, fields });
          }
        });
      }
      cachedSettings = settings;
      lastSettingsFetch = now;
      resolve(settings);
    });
  });
}

function getEmulatorFullFieldPath(keyElem) {
  let path = [keyElem.textContent.trim()];
  let current = keyElem.closest('li.FieldPreview');
  while (current) {
    const parentChildren = current.closest('.FieldPreview-children');
    if (parentChildren) {
      const parentPreview = parentChildren.previousElementSibling;
      if (parentPreview && parentPreview.classList.contains('FieldPreview')) {
        const parentKey = parentPreview.querySelector('.FieldPreview-key');
        if (parentKey) {
          path.unshift(parentKey.textContent.trim());
        }
        current = parentPreview;
      } else {
        current = null;
      }
    } else {
      current = null;
    }
  }
  return path.join('.');
}

function getProductionFullFieldPath(keyElem) {
  let path = [keyElem.textContent.trim()];
  let current = keyElem.closest('.database-node');
  while (current) {
    const parentChildren = current.parentElement.closest('.database-children');
    if (parentChildren) {
      const parentNode = parentChildren.closest('.database-node');
      if (parentNode) {
        const parentKey = parentNode.querySelector('.database-key');
        if (parentKey && parentKey !== keyElem) {
          path.unshift(parentKey.textContent.trim());
        }
        current = parentNode;
      } else {
        current = null;
      }
    } else {
      current = null;
    }
  }
  return path.join('.');
}

/**
 * Core highlighting logic, now correctly scoped to panels.
 */
async function highlightFields() {
  const currentInfo = getFirestoreInfo();
  if (!currentInfo) return;

  const settings = await getSettings();
  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    // --- Emulator Path ---
    const fieldLists = document.querySelectorAll('.Firestore-Field-List');
    
    fieldLists.forEach((list, index) => {
      const depth = index + 1;
      const panelCollections = currentInfo.collections.slice(0, depth);

      const activeRules = settings.filter(rule => {
        if (rule.project !== "*" && rule.project.toLowerCase() !== currentInfo.project.toLowerCase() && rule.project !== "default") return false;
        if (rule.database !== "*" && rule.database.toLowerCase() !== currentInfo.database.toLowerCase()) return false;
        if (rule.collections.length === 0) return false;
        const ruleStr = rule.collections.join(',');
        const currentStr = panelCollections.join(',').toLowerCase();
        return currentStr.endsWith(ruleStr);
      });

      const fieldsToHighlight = new Set();
      activeRules.forEach(rule => rule.fields.forEach(f => fieldsToHighlight.add(f)));

      const fieldKeys = list.querySelectorAll('.FieldPreview-key');
      fieldKeys.forEach(keyElem => {
        const fullFieldName = getEmulatorFullFieldPath(keyElem);
        const leafName = keyElem.textContent.trim();
        const parent = keyElem.closest('.FieldPreview');
        if (parent) {
          if (fieldsToHighlight.has(fullFieldName) || fieldsToHighlight.has(leafName)) {
            parent.style.backgroundColor = 'rgba(255, 165, 0, 0.2)';
            parent.style.borderLeft = '4px solid orange';
          } else if (parent.style.borderLeft === '4px solid orange') {
            parent.style.backgroundColor = '';
            parent.style.borderLeft = '';
          }
        }
      });
    });

  } else if (host === "console.firebase.google.com") {
    // --- Production Path ---
    const panels = document.querySelectorAll('.panel-container');
    
    panels.forEach((panel, index) => {
      // Corrected Panel Indexing:
      // Index 0: Root Collections
      // Index 1: Doc List (Coll 1)
      // Index 2: Fields (Doc 1) <- depth 1
      // Index 3: Doc List (Coll 2)
      // Index 4: Fields (Doc 2) <- depth 2
      
      if (index === 0 || index % 2 !== 0) return; 

      const depth = index / 2;
      const panelCollections = currentInfo.collections.slice(0, depth);
      
      const activeRules = settings.filter(rule => {
        if (rule.project !== "*" && rule.project.toLowerCase() !== currentInfo.project.toLowerCase()) return false;
        if (rule.database !== "*" && rule.database.toLowerCase() !== currentInfo.database.toLowerCase()) return false;
        if (rule.collections.length === 0) return false;
        
        const ruleStr = rule.collections.join(',');
        const currentStr = panelCollections.join(',').toLowerCase();
        return currentStr.endsWith(ruleStr);
      });

      const fieldsToHighlight = new Set();
      activeRules.forEach(rule => rule.fields.forEach(f => fieldsToHighlight.add(f)));

      const fieldKeys = panel.querySelectorAll('.database-key');
      fieldKeys.forEach(keyElem => {
        const fullFieldName = getProductionFullFieldPath(keyElem);
        const leafName = keyElem.textContent.trim();
        const row = keyElem.closest('.database-node-click-target') || keyElem.closest('.database-node');
        
        if (row) {
          if (fieldsToHighlight.has(fullFieldName) || fieldsToHighlight.has(leafName)) {
            row.style.backgroundColor = 'rgba(255, 165, 0, 0.15)';
            row.style.borderLeft = '4px solid orange';
          } else if (row.style.borderLeft === '4px solid orange') {
            row.style.backgroundColor = '';
            row.style.borderLeft = '';
          }
        }
      });
    });
  }
}

// Observe DOM changes
const observer = new MutationObserver((mutations) => {
  highlightFields();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial call
highlightFields();

// Listen for messages (if any)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "ok" });
  }
  return true;
});
