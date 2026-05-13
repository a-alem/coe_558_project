const API_BASE_URL = "https://api.coe558projectkfupm.com";

let lastPrompt = "";
let lastResult = "";

const globalLoader = document.getElementById("globalLoader");
const alertBox = document.getElementById("alertBox");

const weatherResult = document.getElementById("weatherResult");
const genaiResultWrapper = document.getElementById("genaiResultWrapper");
const genaiResult = document.getElementById("genaiResult");
const saveBtn = document.getElementById("saveBtn");

const currentLocationBtn = document.getElementById("currentLocationBtn");
const weatherBtn = document.getElementById("weatherBtn");
const generateBtn = document.getElementById("generateBtn");
const refreshResultsBtn = document.getElementById("refreshResultsBtn");

function showLoader() {
    globalLoader.classList.remove("d-none");
}

function hideLoader() {
    globalLoader.classList.add("d-none");
}

function setButtonLoading(button, isLoading, loadingText = "Processing...") {
    if (!button) return;

    if (isLoading) {
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      ${loadingText}
    `;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
}

async function withLoading(task, options = {}) {
    const {
        button = null,
        loadingText = "Processing...",
        showGlobal = true,
    } = options;

    try {
        if (showGlobal) showLoader();
        if (button) setButtonLoading(button, true, loadingText);

        return await task();
    } finally {
        if (button) setButtonLoading(button, false);
        if (showGlobal) hideLoader();
    }
}

function showAlert(message, type = "danger") {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");

    setTimeout(() => {
        alertBox.classList.add("d-none");
    }, 5000);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);

    let data = null;
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        data = await res.json();
    } else {
        data = await res.text();
    }

    if (!res.ok) {
        const message =
            typeof data === "object"
                ? data.detail || data.error || JSON.stringify(data)
                : data || `Request failed with status ${res.status}`;

        throw new Error(message);
    }

    return data;
}

function showWeather(data) {
    weatherResult.classList.remove("d-none");

    weatherResult.innerHTML = `
    <div class="row align-items-center g-3">
      <div class="col-md-7">
        <div class="weather-condition">
          ${escapeHtml(data.condition_label)}
        </div>
        <div class="text-muted">
          Latitude ${escapeHtml(data.latitude)} • Longitude ${escapeHtml(data.longitude)}
        </div>
      </div>

      <div class="col-md-5 text-md-end">
        <div class="weather-temp">${escapeHtml(data.temperature_c)} °C</div>
        <div class="text-muted">${Number(data.temperature_f).toFixed(2)} °F</div>
      </div>
    </div>
  `;
}

async function fetchWeather(lat, lon) {
    const data = await fetchJson(`${API_BASE_URL}/api/weather?lat=${lat}&lon=${lon}`);
    showWeather(data);
}

currentLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showAlert("Your browser does not support geolocation.");
        return;
    }

    setButtonLoading(currentLocationBtn, true, "Getting location...");

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            document.getElementById("latInput").value = lat;
            document.getElementById("lonInput").value = lon;

            try {
                await withLoading(
                    () => fetchWeather(lat, lon),
                    {
                        button: currentLocationBtn,
                        loadingText: "Loading weather...",
                    }
                );
            } catch (err) {
                showAlert(err.message);
            }
        },
        (err) => {
            setButtonLoading(currentLocationBtn, false);
            showAlert(`Location error: ${err.message}`);
        }
    );
});

weatherBtn.addEventListener("click", async () => {
    const lat = document.getElementById("latInput").value.trim();
    const lon = document.getElementById("lonInput").value.trim();

    if (!lat || !lon) {
        showAlert("Please enter both latitude and longitude.");
        return;
    }

    try {
        await withLoading(
            () => fetchWeather(lat, lon),
            {
                button: weatherBtn,
                loadingText: "Searching...",
            }
        );
    } catch (err) {
        showAlert(err.message);
    }
});

generateBtn.addEventListener("click", async () => {
    const prompt = document.getElementById("promptInput").value.trim();

    if (!prompt) {
        showAlert("Please enter a prompt.");
        return;
    }

    try {
        const data = await withLoading(
            () =>
                fetchJson(`${API_BASE_URL}/api/genai/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ prompt }),
                }),
            {
                button: generateBtn,
                loadingText: "Generating...",
            }
        );

        lastPrompt = prompt;
        lastResult = data.result_text;

        genaiResultWrapper.classList.remove("d-none");
        genaiResult.textContent = data.result_text;
        saveBtn.disabled = false;
    } catch (err) {
        showAlert(err.message);
    }
});

saveBtn.addEventListener("click", async () => {
    if (!lastPrompt || !lastResult) {
        showAlert("There is no generated result to save.");
        return;
    }

    try {
        await withLoading(
            () =>
                fetchJson(`${API_BASE_URL}/api/results`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        prompt: lastPrompt,
                        result_text: lastResult,
                        provider: "gemini",
                    }),
                }),
            {
                button: saveBtn,
                loadingText: "Saving...",
            }
        );

        showAlert("Result saved successfully.", "success");
        await loadResults();
    } catch (err) {
        showAlert(err.message);
    }
});

async function deleteResult(id, button) {
    try {
        await withLoading(
            () =>
                fetchJson(`${API_BASE_URL}/api/results/${id}`, {
                    method: "DELETE",
                }),
            {
                button,
                loadingText: "Deleting...",
            }
        );

        showAlert("Result deleted successfully.", "success");
        await loadResults();
    } catch (err) {
        showAlert(err.message);
    }
}

async function loadResults() {
    const container = document.getElementById("savedResults");

    try {
        const data = await withLoading(
            () => fetchJson(`${API_BASE_URL}/api/results`),
            {
                button: refreshResultsBtn,
                loadingText: "Refreshing...",
                showGlobal: false,
            }
        );

        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <strong>No saved results yet.</strong>
          <div>Generate and save a result to see it here.</div>
        </div>
      `;
            return;
        }

        data.forEach((item) => {
            const div = document.createElement("div");
            div.className = "saved-result-item";

            div.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <h3>Prompt</h3>
            <p>${escapeHtml(item.prompt)}</p>
          </div>

          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${escapeHtml(item.id)}">
            Delete
          </button>
        </div>

        <hr>

        <h3>Result</h3>
        <p>${escapeHtml(item.result_text)}</p>

        <div class="saved-result-meta">
          Provider: ${escapeHtml(item.provider)} • Created at: ${escapeHtml(item.created_at)}
        </div>
      `;

            const deleteBtn = div.querySelector(".delete-btn");
            deleteBtn.addEventListener("click", () => deleteResult(item.id, deleteBtn));

            container.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load saved results:", err);
        container.innerHTML = `
      <div class="empty-state text-danger">
        Failed to load saved results.
      </div>
    `;
    }
}

refreshResultsBtn.addEventListener("click", loadResults);

loadResults();