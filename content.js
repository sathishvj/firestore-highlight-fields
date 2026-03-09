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
    // OR: /firestore/{project}/{database}/data/{encodedPath}
    // Based on user feedback: /firestore/{database}/data/{collection1}/{docId}...
    const match = path.match(/\/firestore\/(.*?)\/data\/(.*)/);
    if (match) {
      const database = match[1];
      const project = "default"; // Emulator often uses a default project or it's implicitly the database name
      const encodedPath = match[2];
      const decodedPath = decodeURIComponent(encodedPath.replace(/~2F/g, '/')).replace(/\/+/g, '/');
      const parts = decodedPath.split('/').filter(p => p !== "");
      
      // Every even index in parts is a collection name (0, 2, 4...)
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
 * Core highlighting logic, now scoped to specific panels or views.
 */
async function highlightFields() {
  const currentInfo = getFirestoreInfo();
  if (!currentInfo) return;

  const settings = await getSettings();
  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    // --- Emulator Path (Multi-Panel Support) ---
    // Emulator uses .Firestore-Field-List for each document view.
    // If nested panels are visible, we iterate through them.
    const fieldLists = document.querySelectorAll('.Firestore-Field-List');
    
    fieldLists.forEach((list, index) => {
      // In Emulator, depth corresponds to which list we are looking at.
      // Usually, list 0 is the root doc, list 1 is the sub-collection doc, etc.
      const depth = index + 1;
      const panelCollections = currentInfo.collections.slice(0, depth);

      const activeRules = settings.filter(rule => {
        // Project Match (In emulator, we often default to matching if rule is '*' or 'default')
        if (rule.project !== "*" && rule.project.toLowerCase() !== currentInfo.project.toLowerCase() && rule.project !== "default") return false;
        
        // Database Match
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
    // --- Production Path (Multi-Panel Support) ---
    const panels = document.querySelectorAll('.panel-container');
    
    panels.forEach((panel, index) => {
      // In Firestore Console, panels are Collection -> Doc -> Collection -> Doc
      // Document panels (where fields exist) are at odd indices (1, 3, 5...)
      if (index % 2 === 0) return;

      const depth = (index + 1) / 2;
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
