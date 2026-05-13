const API_BASE_URL = "https://api.coe558projectkfupm.com";

let lastPrompt = "";
let lastResult = "";
let lastProvider = "gemini";
let lastMediaBase64 = null;
let lastMediaMimeType = null;
let lastMediaDataUrl = null;

const globalLoader = document.getElementById("globalLoader");
const alertBox = document.getElementById("alertBox");

const weatherResult = document.getElementById("weatherResult");
const genaiResultWrapper = document.getElementById("genaiResultWrapper");
const genaiResult = document.getElementById("genaiResult");

const promptInput = document.getElementById("promptInput");
const outputTypeSelect = document.getElementById("outputTypeSelect");
const mediaPromptInput = document.getElementById("mediaPromptInput");
const mediaFileInput = document.getElementById("mediaFileInput");
const mediaPreview = document.getElementById("mediaPreview");

const currentLocationBtn = document.getElementById("currentLocationBtn");
const weatherBtn = document.getElementById("weatherBtn");
const generateBtn = document.getElementById("generateBtn");
const saveBtn = document.getElementById("saveBtn");
const askMediaBtn = document.getElementById("askMediaBtn");
const saveMediaAnswerBtn = document.getElementById("saveMediaAnswerBtn");
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
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }

        button.disabled = true;
        button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      ${loadingText}
    `;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
        delete button.dataset.originalText;
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
    }, 6000);
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
                ? data.detail?.message || data.detail || data.error || JSON.stringify(data)
                : data || `Request failed with status ${res.status}`;

        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }

    return data;
}

function shouldRequestImage(prompt) {
    const imageKeywords = [
        "generate image",
        "create image",
        "draw",
        "photo of",
        "picture of",
        "image of",
        "illustration of",
        "logo",
        "icon",
        "poster",
    ];

    const promptLower = prompt.toLowerCase();
    return imageKeywords.some((keyword) => promptLower.includes(keyword));
}

function resolveOutputType(prompt) {
    const selected = outputTypeSelect.value;

    if (selected === "image" || selected === "text") {
        return selected;
    }

    return shouldRequestImage(prompt) ? "image" : "text";
}

function resetLastResult() {
    lastPrompt = "";
    lastResult = "";
    lastProvider = "gemini";
    lastMediaBase64 = null;
    lastMediaMimeType = null;
    lastMediaDataUrl = null;

    saveBtn.disabled = true;
    saveMediaAnswerBtn.disabled = true;
}

function setLastResult({
                           prompt,
                           resultText,
                           provider = "gemini",
                           mediaBase64 = null,
                           mediaMimeType = null,
                           mediaDataUrl = null,
                       }) {
    lastPrompt = prompt;
    lastResult = resultText || "";
    lastProvider = provider || "gemini";
    lastMediaBase64 = mediaBase64;
    lastMediaMimeType = mediaMimeType;
    lastMediaDataUrl =
        mediaDataUrl ||
        (mediaBase64 && mediaMimeType ? `data:${mediaMimeType};base64,${mediaBase64}` : null);
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

function showTextResult(text) {
    genaiResultWrapper.classList.remove("d-none");
    genaiResult.textContent = text || "No text result returned.";
}

function showImageResult(text, mimeType, base64) {
    genaiResultWrapper.classList.remove("d-none");
    genaiResult.innerHTML = `
    <div class="mb-3">
      ${escapeHtml(text || "Generated image.")}
    </div>

    <img
      src="data:${escapeHtml(mimeType)};base64,${base64}"
      alt="Generated image"
      class="generated-image"
    >
  `;
}

function renderMediaPreview(file) {
    mediaPreview.innerHTML = "";
    mediaPreview.classList.add("d-none");

    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const safeName = escapeHtml(file.name);
    const safeType = escapeHtml(file.type || "unknown");

    if (file.type.startsWith("image/")) {
        mediaPreview.innerHTML = `
      <div class="preview-card">
        <div class="preview-label">Selected image: ${safeName} (${safeType})</div>
        <img src="${objectUrl}" alt="Selected media preview" class="media-preview-image">
      </div>
    `;
    } else if (file.type.startsWith("audio/")) {
        mediaPreview.innerHTML = `
      <div class="preview-card">
        <div class="preview-label">Selected audio: ${safeName} (${safeType})</div>
        <audio controls src="${objectUrl}" class="w-100"></audio>
      </div>
    `;
    } else if (file.type.startsWith("video/")) {
        mediaPreview.innerHTML = `
      <div class="preview-card">
        <div class="preview-label">Selected video: ${safeName} (${safeType})</div>
        <video controls src="${objectUrl}" class="media-preview-video"></video>
      </div>
    `;
    } else {
        mediaPreview.innerHTML = `
      <div class="preview-card">
        <div class="preview-label">Selected file: ${safeName} (${safeType})</div>
      </div>
    `;
    }

    mediaPreview.classList.remove("d-none");
}

currentLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showAlert("Your browser does not support geolocation.");
        return;
    }

    setButtonLoading(currentLocationBtn, true, "Getting location...");
    showLoader();

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            document.getElementById("latInput").value = lat;
            document.getElementById("lonInput").value = lon;

            try {
                await fetchWeather(lat, lon);
            } catch (err) {
                showAlert(err.message);
            } finally {
                setButtonLoading(currentLocationBtn, false);
                hideLoader();
            }
        },
        (err) => {
            setButtonLoading(currentLocationBtn, false);
            hideLoader();
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
    const prompt = promptInput.value.trim();

    if (!prompt) {
        showAlert("Please enter a prompt.");
        return;
    }

    const outputType = resolveOutputType(prompt);

    try {
        resetLastResult();

        const data = await withLoading(
            () =>
                fetchJson(`${API_BASE_URL}/api/genai/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        prompt,
                        output_type: outputType,
                    }),
                }),
            {
                button: generateBtn,
                loadingText: outputType === "image" ? "Generating image..." : "Generating...",
            }
        );

        setLastResult({
            prompt,
            resultText: data.result_text || "",
            provider: data.provider || "gemini",
            mediaBase64: data.media_base64 || null,
            mediaMimeType: data.media_mime_type || null,
        });

        if (data.media_base64 && data.media_mime_type) {
            showImageResult(data.result_text, data.media_mime_type, data.media_base64);
        } else {
            showTextResult(data.result_text);
        }

        saveBtn.disabled = false;
    } catch (err) {
        showAlert(err.message);
    }
});

mediaFileInput.addEventListener("change", () => {
    renderMediaPreview(mediaFileInput.files[0]);
});

askMediaBtn.addEventListener("click", async () => {
    const prompt = mediaPromptInput.value.trim();
    const file = mediaFileInput.files[0];

    if (!prompt) {
        showAlert("Please enter a question about the media.");
        return;
    }

    if (!file) {
        showAlert("Please upload an image, audio, or video file.");
        return;
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("file", file);

    try {
        resetLastResult();

        const data = await withLoading(
            () =>
                fetchJson(`${API_BASE_URL}/api/genai/media/question`, {
                    method: "POST",
                    body: formData,
                }),
            {
                button: askMediaBtn,
                loadingText: "Analyzing media...",
            }
        );

        setLastResult({
            prompt: `${prompt} [Uploaded file: ${data.filename || file.name}]`,
            resultText: data.result_text || "",
            provider: data.provider || "gemini",
        });

        genaiResultWrapper.classList.remove("d-none");
        genaiResult.innerHTML = `
      <div class="media-answer-meta mb-3">
        <strong>File:</strong> ${escapeHtml(data.filename || file.name)}
        <br>
        <strong>MIME type:</strong> ${escapeHtml(data.mime_type || file.type)}
      </div>
      <div>${escapeHtml(data.result_text || "No answer returned.")}</div>
    `;

        saveMediaAnswerBtn.disabled = false;
    } catch (err) {
        showAlert(err.message);
    }
});

async function saveCurrentResult(button) {
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
                        provider: lastProvider,
                        media_url: lastMediaDataUrl,
                    }),
                }),
            {
                button,
                loadingText: "Saving...",
            }
        );

        showAlert("Result saved successfully.", "success");
        await loadResults();
    } catch (err) {
        showAlert(err.message);
    }
}

saveBtn.addEventListener("click", () => saveCurrentResult(saveBtn));
saveMediaAnswerBtn.addEventListener("click", () => saveCurrentResult(saveMediaAnswerBtn));

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

function renderSavedMedia(item) {
    if (!item.media_url) {
        return "";
    }

    if (item.media_url.startsWith("data:image/")) {
        return `
      <div class="saved-media mt-3">
        <img
          src="${item.media_url}"
          alt="Saved generated media"
          class="saved-generated-image"
        >
      </div>
    `;
    }

    return `
    <div class="saved-media mt-3">
      <a href="${escapeHtml(item.media_url)}" target="_blank" rel="noopener noreferrer">
        View saved media
      </a>
    </div>
  `;
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

        ${renderSavedMedia(item)}

        <div class="saved-result-meta mt-3">
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