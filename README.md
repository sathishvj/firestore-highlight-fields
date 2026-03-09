# Firestore Field Highlighter

A lightweight Chrome Extension that allows you to highlight specific fields in the Firestore Emulator or Production Console based on customizable rules.

## Features

- **Field Highlighting**: Highlight specific fields with an orange background and a colored border based on the project, database, and collection path.
- **Structured Rules**: Configure rules using a 4-part format: `Project | Database | Collections | Fields`.
- **Nested Field Support**: Supports highlighting of top-level fields and nested fields (using dot notation, e.g., `user.profile.email`).
- **Emulator & Production Support**: Works seamlessly on `console.firebase.google.com` and local emulator suites (`localhost` or `127.0.0.1`).
- **Privacy Focused**: All settings are stored locally. No data ever leaves your browser.

## Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click **Load unpacked** and select the root directory of this project.

## How to Use

1. Right-click the extension icon in your browser toolbar and select **Options**.
2. Enter your highlight rules in the format: `Project | Database | Collection list in order | Fields`.
   - **Project**: Your Firebase project ID (e.g., `my-project`). Use `*` to match any project.
   - **Database**: The database ID (e.g., `(default)` or `-default-`). Must match the URL segment exactly. Use `*` to match any database.
   - **Collection list in order**: A comma-separated list of collection names (e.g., `organizations, groups`).
   - **Fields**: A comma-separated list of field names to highlight.
3. Click **Save Settings**.
4. Navigate to your Firestore database. Matching fields will now be highlighted with an orange background.

### Examples:
- **Production**: `vj-project | (default) | organizations, groups | name, status`
- **Emulator**: `default | default | questions | learning.objective, examTags`

## Permissions

- `storage`: Used to save and retrieve your highlight settings.
- URL Matches: Limited strictly to Firebase Console and local emulator addresses.

## License

MIT
