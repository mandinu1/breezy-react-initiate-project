from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.data_loader import load_dataframes
from app.routers import boards, posm, retailers, images, geo, options

@asynccontextmanager
async def lifespan(app: FastAPI):
    
    # --- Startup Logic ---
    print("Application startup: loading data...")
    # Load the dataframes into memory when the application starts.
    # This is more efficient than loading the data on every API request.
    load_dataframes()
    print("Data loading complete.")
    
    # The 'yield' keyword passes control back to the application.
    yield
    
    # --- Shutdown Logic ---
    # Any cleanup code can be placed here. It will be executed when the application is shutting down.
    print("Application shutdown.")

# Create the main FastAPI application instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan  # Register the lifespan context manager
)

# --- CORS Middleware ---
# Configure Cross-Origin Resource Sharing (CORS) to allow the frontend application
# to communicate with this backend. Without this, browser security policies would block the requests.
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],  # Allow all standard HTTP methods
        allow_headers=["*"],  # Allow all headers
    )

# --- API Routers ---
# Include the API routers from the `routers` directory.
# Each router handles a specific part of the API (e.g., /boards, /posm).
# Using routers helps to organize the code and keep the main file clean.
app.include_router(boards.router, prefix=settings.API_V1_STR, tags=["Board Data"])
app.include_router(posm.router, prefix=settings.API_V1_STR, tags=["POSM Data"])
app.include_router(retailers.router, prefix=settings.API_V1_STR, tags=["Retailer Data"])
app.include_router(images.router, prefix=settings.API_V1_STR, tags=["Image Handling"])
app.include_router(geo.router, prefix=settings.API_V1_STR, tags=["Geospatial Data"])
app.include_router(options.router, prefix=settings.API_V1_STR, tags=["Filter Options"])

@app.get("/", tags=["Root"])
def read_root():
    """
    Root endpoint for the API. Provides a simple welcome message.
    Useful for health checks or simply confirming the API is running.
    """
    return {"message": f"Welcome to the {settings.PROJECT_NAME}"}