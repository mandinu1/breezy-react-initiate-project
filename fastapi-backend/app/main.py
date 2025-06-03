from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import boards, posm, retailers, images, geo
from app.data_loader import load_dataframes # To load data on startup

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Load data once on startup
@app.on_event("startup")
async def startup_event():
    print("Loading data...")
    load_dataframes()
    print("Data loaded.")

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(boards.router, prefix=settings.API_V1_STR, tags=["boards"])
app.include_router(posm.router, prefix=settings.API_V1_STR, tags=["posm"])
app.include_router(retailers.router, prefix=settings.API_V1_STR, tags=["retailers"])
app.include_router(images.router, prefix=settings.API_V1_STR, tags=["images"])
app.include_router(geo.router, prefix=settings.API_V1_STR, tags=["geo"])

@app.get("/")
async def root():
    return {"message": "Welcome to the Retailer Brand Presence API"}