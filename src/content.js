function createHmeButton(inputElement) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = "Generate iCloud Hide My Email";
  btn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    z-index: 1000;
    padding: 0;
    margin: 0;
    line-height: 1;
  `;
  btn.innerHTML = '☁️';

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    btn.style.opacity = '0.5';
    btn.style.cursor = 'wait';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          type: "GENERATE_HME", 
          payload: { host: window.location.hostname } 
        }, resolve);
      });

      if (response && response.success) {
        inputElement.value = response.email;
        inputElement.dispatchEvent(new Event("input", { bubbles: true }));
        inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        alert("Failed to generate HME: " + (response?.error || "Unknown error"));
      }
    } catch (err) {
      console.error("HME Extension Error:", err);
    } finally {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  });

  return btn;
}

function processInput(input) {
  if (input.dataset.hmeProcessed) return;
  input.dataset.hmeProcessed = "true";

  chrome.runtime.sendMessage({ type: "CHECK_SESSION" }, (res) => {
    if (res && res.loggedIn) {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position: relative; display: inline-block; width: " + (input.offsetWidth || '100%') + "px;";
      
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      
      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.paddingRight = '30px'; 

      const btn = createHmeButton(input);
      wrapper.appendChild(btn);
    }
  });
}

function scanForInputs() {
  const inputs = document.querySelectorAll('input[type="email"], input[name*="email" i], input[id*="email" i]');
  inputs.forEach(processInput);
}

scanForInputs();

const observer = new MutationObserver((mutations) => {
  let shouldScan = false;
  for (const m of mutations) {
    if (m.addedNodes.length > 0) {
      shouldScan = true;
      break;
    }
  }
  if (shouldScan) scanForInputs();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
