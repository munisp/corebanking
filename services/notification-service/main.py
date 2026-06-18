"""
Notification Service Main Application
Handles customer support, notifications, and chatbot.
"""

import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from handlers import router

app = FastAPI(
    title="54link-dev Notification Service",
    description="Customer support, notifications, and chatbot service",
    version="1.1.0",
)

_CORS_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1", tags=["notifications"])


@app.on_event("startup")
async def startup_event():
    init_db()
    print("Notification Service started successfully")
    print(f"Email notifications: {'Enabled' if os.getenv('SMTP_HOST') else 'Disabled'}")
    print(f"SMS notifications: {'Enabled' if os.getenv('SMS_PROVIDER') else 'Disabled'}")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "notification-service", "version": "1.1.0"}


@app.get("/")
def root():
    return {
        "service": "54link-dev Notification Service",
        "version": "1.1.0",
        "endpoints": {
            "tickets": "/api/v1/tickets",
            "notifications": "/api/v1/notifications",
            "chat": "/api/v1/chat",
            "health": "/health",
            "readiness": "/api/v1/ready",
            "bootstrap": "/api/v1/bootstrap",
        },
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8091"))
    uvicorn.run(app, host="0.0.0.0", port=port)
