# Weather API - Lambda (Serverless)
We have deployed the weather api into a serverless function using AWS Lambda, the `handler.py` file encapsulates the function logic to retrieve weather information.

We have used [Open-Meteo](https://open-meteo.com/en/docs) for its simplicity, it does not require an API key, and it retrieves the weather from latitude and longitude so it fits our needs quite well.