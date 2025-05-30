# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional, List
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime
import json

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv('SUPABASE_URL', ''),
    os.getenv('SUPABASE_KEY', '')
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    message_history: Optional[list[dict[str, str]]] = []  # Full chat history

# Define the data model for leaderboard entries
class LeaderboardEntry(BaseModel):
    initials: str
    score: int

# Define the leaderboard endpoint
@app.post("/api/leaderboard")
async def submit_score(entry: LeaderboardEntry):
    try:
        # Insert the new score
        supabase.table('leaderboard').insert({
            'initials': entry.initials,
            'score': entry.score,
            'created_at': datetime.now().isoformat()
        }).execute()
        
        # Get scores with ranks and filter for entries around the current submission
        window_size = 3        
        try:
            # Call the database function directly
            result = supabase.rpc('get_leaderboard_window', {
                'p_initials': entry.initials,
                'p_score': entry.score,
                'p_window_size': window_size
            }).execute()
                        
            if not result.data:
                logger.warning("No data returned from leaderboard query")
                return []
                
            return result.data
            
        except Exception as e:
            logger.error(f"Error executing query: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
        
    except Exception as e:
        logger.error(f"Error submitting score: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received request: {request}")
        
        # Initialize OpenAI client with the environment API key (OPENAI_API_KEY)
        client = OpenAI()
        
        # Create an async generator function for streaming responses
        async def generate():
            # Prepare messages array with history
            messages = [
                {"role": "developer", "content": request.developer_message}
            ]
            
            # Add message history if provided
            if request.message_history:
                messages.extend(request.message_history)
            
            # Add the current user message
            messages.append({"role": "user", "content": request.user_message})
            
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=messages,
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        logger.error(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
