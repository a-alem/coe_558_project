import json
import urllib.parse
import urllib.request


WEATHER_CODE_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    95: "Thunderstorm",
}


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}

    lat = params.get("lat")
    lon = params.get("lon")

    if not lat or not lon:
        return response(400, {
            "error": "lat and lon query parameters are required"
        })

    query = urllib.parse.urlencode({
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,weather_code",
        "timezone": "auto",
    })

    url = f"https://api.open-meteo.com/v1/forecast?{query}"

    try:
        with urllib.request.urlopen(url, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8"))

        current = data.get("current", {})
        code = current.get("weather_code")

        return response(200, {
            "latitude": float(lat),
            "longitude": float(lon),
            "temperature_c": current.get("temperature_2m"),
            "temperature_f": (
                current.get("temperature_2m") * 9 / 5 + 32
                if current.get("temperature_2m") is not None
                else None
            ),
            "condition_code": code,
            "condition_label": WEATHER_CODE_LABELS.get(code, "Unknown"),
        })

    except Exception as e:
        return response(502, {
            "error": "Failed to fetch weather data",
            "details": str(e),
        })