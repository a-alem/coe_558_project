# COE-558 Weather & GenAI Cloud Project

A simple cloud web application for **COE558: Cloud and Edge Computing**.

Developed by: Abdulelah Alem and Hadi Al Mazooq

The application provides weather information and GenAI media features through a secure AWS-based deployment.

Production URLs:

```text
Frontend: https://www.coe558projectkfupm.com
API:      https://api.coe558projectkfupm.com
Swagger:  https://api.coe558projectkfupm.com/docs
```

---

## Features

- Bootstrap frontend with no React/Angular.
- AWS Lambda weather service.
- Containerized GenAI service using Gemini.
- Containerized backend CRUD service.
- MongoDB NoSQL database.
- AWS S3 object storage support for uploaded media.
- Traefik reverse proxy/API gateway.
- HTTPS using Let's Encrypt.
- OpenAPI + Swagger UI.
- Postman collection with sample responses.
- Terraform infrastructure as code.
- GitHub Actions CI/CD.

---

## Services
### S1 - Weather Service

Implemented as an **AWS Lambda** function.

Public endpoint:

```text
GET /api/weather?lat=<latitude>&lon=<longitude>
```

Example:

```bash
curl "https://api.coe558projectkfupm.com/api/weather?lat=24.7136&lon=46.6753"
```

Example response:

```json
{
  "latitude": 24.7136,
  "longitude": 46.6753,
  "temperature_c": 34.1,
  "temperature_f": 93.38,
  "condition_code": 0,
  "condition_label": "Clear sky"
}
```

### S2 - GenAI Service

Implemented as a **containerized FastAPI** service.

It supports:

- Text generation.
- Image generation from text.
- Asking questions about uploaded image/audio/video files.

Public endpoints:

```text
GET  /api/genai/health
POST /api/genai/generate
POST /api/genai/media/question
```

Generate text:

```bash
curl -X POST "https://api.coe558projectkfupm.com/api/genai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain cloud computing in one paragraph",
    "output_type": "text"
  }'
```

Generate image:

```bash
curl -X POST "https://api.coe558projectkfupm.com/api/genai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate image of a cute duck floating on a pond",
    "output_type": "image"
  }'
```

Ask a question about uploaded media:

```bash
curl -X POST "https://api.coe558projectkfupm.com/api/genai/media/question" \
  -F "prompt=What is in this image?" \
  -F "file=@duck.png"
```

### S3 - Backend CRUD Service

Implemented as a **containerized FastAPI** service.

It stores:

- Prompt text.
- GenAI result text.
- Provider name.
- Optional media reference.
- Creation timestamp.

Public endpoints:

```text
GET    /api/backend/health
GET    /api/results
POST   /api/results
GET    /api/results/{id}
DELETE /api/results/{id}
POST   /api/results/upload
POST   /api/results/save-generated-media
```

MongoDB stores metadata. S3 stores uploaded media files.

---

## Repository Structure

```text
.
├── apps
│   ├── frontend
│   ├── weather-lambda
│   ├── genai-service
│   └── backend
├── deploy
│   ├── frontend
│   └── backend
├── infra
│   └── terraform
├── api
│   ├── openapi.yaml
│   └── postman
├── .github
│   └── workflows
├── README.md
├── PROGRESS.md
└── FINAL_REPORT_DRAFT.md
```

---

## Local Development
### Frontend

```bash
cd apps/frontend
docker build -t coe558-frontend:local .
docker run --rm -p 8080:80 coe558-frontend:local
```

Open:

```text
http://localhost:8080
```

### GenAI Service

```bash
cd apps/genai-service

docker build -t coe558-genai-service:local .

docker run --rm -p 8000:8000 \
  -e GEMINI_API_KEY="<your-key>" \
  -e GEMINI_TEXT_MODEL="gemini-2.5-flash" \
  -e GEMINI_IMAGE_MODEL="gemini-3.1-flash-image-preview" \
  -e GEMINI_MULTIMODAL_MODEL="gemini-2.5-flash" \
  coe558-genai-service:local
```

### Backend Service

```bash
cd apps/backend

docker build -t coe558-backend:local .

docker run --rm -p 8001:8000 \
  -e MONGO_HOST="host.docker.internal" \
  -e MONGO_PORT="27017" \
  -e MONGO_ROOT_USERNAME="root" \
  -e MONGO_ROOT_PASSWORD="<password>" \
  -e MONGO_DB="coe558" \
  -e MONGO_COLLECTION="genai_results" \
  -e AWS_REGION="me-south-1" \
  -e S3_BUCKET="<bucket-name>" \
  coe558-backend:local
```

---

## Deployment

Deployment is automated with GitHub Actions.

The CI/CD workflow:

1. Builds Docker images.
2. Pushes images to GitHub Container Registry.
3. SSHs into EC2 instances.
4. Writes `.env` files using GitHub Secrets/Variables.
5. Pulls the latest images.
6. Restarts the Docker Compose stacks.
7. Updates the Lambda weather function when changed.

Container images:

```text
ghcr.io/a-alem/coe558-frontend:latest
ghcr.io/a-alem/coe558-genai-service:latest
ghcr.io/a-alem/coe558-backend:latest
```

---

## Useful Test Commands

Weather:

```bash
curl "https://api.coe558projectkfupm.com/api/weather?lat=24.7136&lon=46.6753"
```

GenAI health:

```bash
curl "https://api.coe558projectkfupm.com/api/genai/health"
```

Generate text:

```bash
curl -X POST "https://api.coe558projectkfupm.com/api/genai/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain KFUPM in one paragraph","output_type":"text"}'
```

Backend health:

```bash
curl "https://api.coe558projectkfupm.com/api/backend/health"
```

List saved results:

```bash
curl "https://api.coe558projectkfupm.com/api/results"
```

---

## API Documentation

Swagger UI:

```text
https://api.coe558projectkfupm.com/docs
```

OpenAPI file:

```text
api/openapi.yaml
```

Postman collection:

```text
api/postman/COE558_Project_Postman_Collection.json
```

---

## Notes

- Generated images are returned to the frontend as base64 image data.
- Uploaded media can be stored in S3 through `/api/results/upload`.
- The backend includes `/api/results/save-generated-media` for saving generated base64 media to S3.

---

## Cleanup

To stop services:

```bash
docker compose down
```

To delete MongoDB data volume:

```bash
docker compose down -v
```

Use `down -v` carefully because it deletes saved MongoDB data.
