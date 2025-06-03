from fastapi import APIRouter
from app.models import GeoJsonCollection, GeoJsonFeature, GeoJsonGeometry
import random

router = APIRouter()

@router.get("/geo/districts", response_model=GeoJsonCollection)
async def fetch_geo_districts_api():
    # This should load shapefiles as in host (4).py and convert to GeoJSON
    # For now, using the mock from api.ts
    features = [
        GeoJsonFeature(
            type="Feature",
            properties={"name": "Colombo", "value": random.uniform(0,100), "ISO_1": "LK-11"},
            geometry=GeoJsonGeometry(type="Polygon", coordinates=[[[79.83, 7.0],[79.83, 6.8],[80.0, 6.8],[80.0, 7.0],[79.83, 7.0]]])
        ),
        GeoJsonFeature(
            type="Feature",
            properties={"name": "Kandy", "value": random.uniform(0,100), "ISO_1": "LK-21"},
            geometry=GeoJsonGeometry(type="Polygon", coordinates=[[[80.5, 7.4],[80.5, 7.1],[80.7, 7.1],[80.7, 7.4],[80.5, 7.4]]])
        ),
        GeoJsonFeature(
            type="Feature",
            properties={"name": "Galle", "value": random.uniform(0,100), "ISO_1": "LK-31"},
            geometry=GeoJsonGeometry(type="Polygon", coordinates=[[[80.1, 6.2],[80.1, 6.0],[80.3, 6.0],[80.3, 6.2],[80.1, 6.2]]])
        ),
    ]
    return GeoJsonCollection(type="FeatureCollection", features=features)