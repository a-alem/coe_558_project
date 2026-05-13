const API_BASE_URL = "https://api.coe558projectkfupm.com";

let lastPrompt = "";
let lastResult = "";

const weatherResult = document.getElementById("weatherResult");
const genaiResult = document.getElementById("genaiResult");
const saveBtn = document.getElementById("saveBtn");

function showWeather(data) {
    weatherResult.classList.remove("d-none");
    weatherResult.innerHTML = `
    <h5>${data.condition_label}</h5>
    <p>
      Celsius: ${data.temperature_c} °C<br>
      Fahrenheit: ${data.temperature_f?.toFixed(2)} °F
    </p>
  `;
}

async function fetchWeather(lat, lon) {
    const res = await fetch(`${API_BASE_URL}/api/weather?lat=${lat}&lon=${lon}`);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || "Failed to fetch weather");
    }

    showWeather(data);
}

document.getElementById("currentLocationBtn").addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            document.getElementById("latInput").value = lat;
            document.getElementById("lonInput").value = lon;

            await fetchWeather(lat, lon);
        },
        (err) => alert(`Location error: ${err.message}`)
    );
});

document.getElementById("weatherBtn").addEventListener("click", async () => {
    const lat = document.getElementById("latInput").value;
    const lon = document.getElementById("lonInput").value;

    try {
        await fetchWeather(lat, lon);
    } catch (e) {
        alert(e.message);
    }
});

document.getElementById("generateBtn").addEventListener("click", async () => {
    const prompt = document.getElementById("promptInput").value;

    const res = await fetch(`${API_BASE_URL}/api/genai/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
    });

    const data = await res.json();

    if (!res.ok) {
        alert(data.detail || "Failed to generate");
        return;
    }

    lastPrompt = prompt;
    lastResult = data.result_text;

    genaiResult.classList.remove("d-none");
    genaiResult.textContent = data.result_text;
    saveBtn.disabled = false;
});

saveBtn.addEventListener("click", async () => {
    const res = await fetch(`${API_BASE_URL}/api/results`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: lastPrompt,
            result_text: lastResult,
            provider: "gemini",
        }),
    });

    if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Failed to save result");
        return;
    }

    await loadResults();
});

async function loadResults() {
    const res = await fetch(`${API_BASE_URL}/api/results`);
    const data = await res.json();

    const container = document.getElementById("savedResults");
    container.innerHTML = "";

    data.forEach((item) => {
        const div = document.createElement("div");
        div.className = "border rounded p-3 mb-3 bg-white";

        div.innerHTML = `
      <h6>Prompt</h6>
      <p>${item.prompt}</p>
      <h6>Result</h6>
      <p>${item.result_text}</p>
      <small>${item.created_at}</small>
      <br>
      <button class="btn btn-sm btn-danger mt-2" data-id="${item.id}">
        Delete
      </button>
    `;

        div.querySelector("button").addEventListener("click", async () => {
            await fetch(`${API_BASE_URL}/api/results/${item.id}`, {
                method: "DELETE",
            });

            await loadResults();
        });

        container.appendChild(div);
    });
}

document.getElementById("refreshResultsBtn").addEventListener("click", loadResults);

loadResults();