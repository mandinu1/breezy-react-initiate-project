from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    API_V1_STR: str = "/api" # Matches API_BASE_URL in constants.ts
    PROJECT_NAME: str = "Retailer Brand Presence Backend"

    # For a real S3 setup
    AWS_ACCESS_KEY_ID: str = "YOUR_AWS_ACCESS_KEY_ID"
    AWS_SECRET_ACCESS_KEY: str = "YOUR_AWS_SECRET_ACCESS_KEY"
    AWS_REGION: str = "ap-southeast-1" # Example region from host (4).py
    S3_BUCKET_NAME: str = "your-s3-bucket-name" # Example

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"] # Add your frontend URL

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()