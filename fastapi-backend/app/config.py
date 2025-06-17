# fastapi-backend/app/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Configuration settings for the application.
    
    These settings are loaded from environment variables or a .env file.
    """
    
    # API Configuration
    API_V1_STR: str = "/api" 
    PROJECT_NAME: str = "Retailer Brand Presence Backend"

    # --- AWS S3 Configuration ---
    # Credentials for accessing AWS S3. 
    # IMPORTANT: For security, these should be set in a .env file and not hardcoded here.
    # The .env file should be added to .gitignore to prevent it from being committed.
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "ap-ast-1"
    S3_BUCKET_NAME: str

    # --- CORS (Cross-Origin Resource Sharing) ---
    # A list of origins that are allowed to make requests to this backend.
    # Add the URL of your frontend application here.
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"] 

    # Load settings from a .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()