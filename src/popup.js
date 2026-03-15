let pendingSessionHeaders = null;

document.addEventListener("DOMContentLoaded", async () => {
  const loadingView = document.getElementById("loadingView");
  const loginView = document.getElementById("loginView");
  const unlockView = document.getElementById("unlockView");
  const twofaView = document.getElementById("twofaView");
  const loggedInView = document.getElementById("loggedInView");

  const loginForm = document.getElementById("loginForm");
  const unlockForm = document.getElementById("unlockForm");
  const unlockLogoutBtn = document.getElementById("unlockLogoutBtn");
  const twofaForm = document.getElementById("twofaForm");
  const logoutBtn = document.getElementById("logoutBtn");

  const errorMsg = document.getElementById("errorMsg");
  const unlockError = document.getElementById("unlockError");
  const twofaError = document.getElementById("twofaError");

  function showView(view) {
    loadingView.classList.add("hidden");
    loginView.classList.add("hidden");
    unlockView.classList.add("hidden");
    twofaView.classList.add("hidden");
    loggedInView.classList.add("hidden");
    view.classList.remove("hidden");
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function setButtonLoading(btn, isLoading, text) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div>';
    } else {
      btn.disabled = false;
      btn.textContent = text;
    }
  }

  // Check initial session
  chrome.runtime.sendMessage({ type: "CHECK_SESSION" }, (response) => {
    if (response && response.loggedIn) {
      showView(loggedInView);
    } else if (response && response.locked) {
      showView(unlockView);
    } else {
      showView(loginView);
    }
  });

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const appleId = document.getElementById("appleId").value;
    const password = document.getElementById("password").value;
    const passphrase = document.getElementById("loginPassphrase").value;
    const btn = document.getElementById("loginBtn");

    errorMsg.classList.add("hidden");
    setButtonLoading(btn, true);

    chrome.runtime.sendMessage(
      { type: "LOGIN_STEP_1", payload: { appleId, password, passphrase } },
      (response) => {
        setButtonLoading(btn, false, "Sign In");
        if (!response || !response.success) {
          showError(errorMsg, response?.error || "Login failed");
        } else if (response.requires2FA) {
          pendingSessionHeaders = response.sessionHeaders;
          showView(twofaView);
        } else {
          showView(loggedInView);
        }
      }
    );
  });

  twofaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("twofaCode").value;
    const passphrase = document.getElementById("loginPassphrase").value;
    const btn = document.getElementById("twofaBtn");

    twofaError.classList.add("hidden");
    setButtonLoading(btn, true);

    chrome.runtime.sendMessage(
      { type: "LOGIN_STEP_2", payload: { code, sessionHeaders: pendingSessionHeaders, passphrase } },
      (response) => {
        setButtonLoading(btn, false, "Verify");
        if (!response || !response.success) {
          showError(twofaError, response?.error || "Verification failed");
        } else {
          showView(loggedInView);
        }
      }
    );
  });

  unlockForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const passphrase = document.getElementById("unlockPassphrase").value;
    const btn = document.getElementById("unlockBtn");

    unlockError.classList.add("hidden");
    setButtonLoading(btn, true);

    chrome.runtime.sendMessage(
      { type: "UNLOCK_SESSION", payload: { passphrase } },
      (response) => {
        setButtonLoading(btn, false, "Unlock");
        if (!response || !response.success) {
          showError(unlockError, response?.error || "Invalid passphrase");
        } else {
          showView(loggedInView);
        }
      }
    );
  });

  unlockLogoutBtn.addEventListener("click", () => {
    setButtonLoading(unlockLogoutBtn, true);
    chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
      setButtonLoading(unlockLogoutBtn, false, "Clear Session");
      document.getElementById("unlockPassphrase").value = "";
      document.getElementById("loginPassphrase").value = "";
      showView(loginView);
    });
  });

  logoutBtn.addEventListener("click", () => {
    setButtonLoading(logoutBtn, true);
    chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
      setButtonLoading(logoutBtn, false, "Sign Out");
      document.getElementById("appleId").value = "";
      document.getElementById("password").value = "";
      document.getElementById("twofaCode").value = "";
      document.getElementById("loginPassphrase").value = "";
      document.getElementById("unlockPassphrase").value = "";
      showView(loginView);
    });
  });
});
