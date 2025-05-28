# OpenAI Chat API Backend

This is a FastAPI-based backend service that provides a streaming chat interface using OpenAI's API.

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- An OpenAI API key

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

2. Install the required dependencies:
```bash
pip install fastapi uvicorn openai pydantic
```

3. Set up your OpenAI API key as an environment variable:
```bash
# On Unix/Linux/MacOS
export OPENAI_API_KEY=your-api-key-here

# On Windows
set OPENAI_API_KEY=your-api-key-here
```

## Running the Server

1. Make sure you're in the `api` directory:
```bash
cd api
```

2. Start the server:
```bash
python app.py
```

The server will start on `http://localhost:8000`

## API Endpoints

### Chat Endpoint
- **URL**: `/api/chat`
- **Method**: POST
- **Request Body**:
```json
{
    "developer_message": "string",
    "user_message": "string",
    "model": "gpt-4.1-mini",  // optional
    "message_history": []  // optional
}
```
- **Response**: Streaming text response

### Health Check
- **URL**: `/api/health`
- **Method**: GET
- **Response**: `{"status": "ok"}`

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## CORS Configuration

The API is configured to accept requests from any origin (`*`). This can be modified in the `app.py` file if you need to restrict access to specific domains.

## Error Handling

The API includes basic error handling for:
- Invalid API keys
- OpenAI API errors
- General server errors

All errors will return a 500 status code with an error message. 

## Vercel Deployment

When deploying to Vercel, you'll need to configure the environment variables:

1. Go to your project on [Vercel Dashboard](https://vercel.com)
2. Click on "Settings"
3. Click on "Environment Variables" in the left sidebar
4. Add a new environment variable:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
   - Environment: Production (and optionally Preview/Development)
5. Click "Save"

Alternatively, you can use the Vercel CLI:
```bash
vercel env add OPENAI_API_KEY
```

After adding the environment variable, redeploy your application for the changes to take effect. 