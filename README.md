# iCloud Hide My Email Browser Extension

Autofill and manage your iCloud+ Hide My Email on any website directly from your browser.

> 🚀 **Looking for a Terminal version?** Check out the [CLI version: Yimikami/icloud-hme-manager](https://github.com/Yimikami/icloud-hme-manager).

## Features

- **Quick Access:** Generate and manage iCloud Hide My Email addresses without leaving the current tab.
- **Autofill:** Easily insert your generated Hide My Email addresses into input fields on any website.
- **Privacy First:** Directly interfaces with iCloud to maintain your privacy.

## Prerequisites

- Node.js installed on your machine.
- An active iCloud+ subscription (required to use Apple's Hide My Email feature).

## Installation 

### Building the Extension

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Yimikami/icloud-hme-extension.git
   cd icloud-hme-extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the source files:**
   ```bash
   npm run build
   ```
   This will bundle the files into the `dist/` directory using `esbuild`.

### Loading the Extension

**For Chrome / Brave / Edge:**
1. Open your browser and navigate to the Extensions page (`chrome://extensions/` or `edge://extensions/`).
2. Turn on **Developer mode** (usually a toggle in the top right corner).
3. Click on the **Load unpacked** button.
4. Select the `icloud-hme-extension` project folder.

**For Firefox:**
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click on **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside the project directory.

## Usage

1. Click the **iCloud Hide My Email** extension icon in your browser toolbar.
2. Sign in with your Apple ID and set a highly secure **Session Passphrase**.
3. (Optional) If Two-Factor Authentication (2FA) is required, enter the 6-digit code sent to your Apple devices.
4. Your active session will be encrypted to disk using your Passphrase via AES-256-GCM.
5. **Important:** Whenever you fully close and reopen your browser, you will just need to click the extension and enter your Passphrase once to unlock your session.
6. Manage, generate, and use your random email addresses seamlessly while browsing!

## Related Projects

- [icloud-hme-manager](https://github.com/Yimikami/icloud-hme-manager) - A Command Line Interface (CLI) version for managing iCloud Hide My Email.

## License

This project is licensed under the MIT License.
