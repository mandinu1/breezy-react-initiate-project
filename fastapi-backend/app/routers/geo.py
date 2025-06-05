from fastapi import APIRouter, Depends
from app.models import GeoJsonCollection
from app.dependencies import get_posm_df
import geopandas as gpd
import pandas as pd

router = APIRouter()

# IMPORTANT: Update this path to where your shapefiles are located within the Docker container or server.
# This path assumes a 'data/geo' folder relative to your app's root.
SHAPEFILE_PATH = "app/data/geo/sri_lanka_districts.shp"

@router.get("/geo/districts", response_model=GeoJsonCollection)
async def fetch_geo_districts_api(posm_df: pd.DataFrame = Depends(get_posm_df)):
    """
    Loads district shapefile, merges it with aggregated POSM data,
    and returns a GeoJsonCollection for choropleth mapping.
    """
    try:
        gdf_districts = gpd.read_file(SHAPEFILE_PATH)
    except Exception as e:
        print(f"Error loading shapefile: {e}")
        # Return an empty feature collection if the shapefile can't be loaded
        return GeoJsonCollection(type="FeatureCollection", features=[])

    if posm_df.empty or 'SHAPEISO' not in posm_df.columns:
        return GeoJsonCollection(type="FeatureCollection", features=[])

    df_metrics = posm_df.copy()
    percentage_columns = [
        'DIALOG_AREA_PERCENTAGE', 'AIRTEL_AREA_PERCENTAGE',
        'MOBITEL_AREA_PERCENTAGE', 'HUTCH_AREA_PERCENTAGE'
    ]
    
    for col in percentage_columns:
        df_metrics[col] = pd.to_numeric(df_metrics[col], errors='coerce')
    df_metrics.fillna(0, inplace=True)

    # Group by district shape ID and calculate the mean visibility for each provider
    df_agg = df_metrics.groupby('SHAPEISO')[percentage_columns].mean().reset_index()
    
    # Merge the geographic data with the calculated POSM metrics
    merged_gdf = gdf_districts.merge(df_agg, left_on='shapeISO', right_on='SHAPEISO', how='left')
    merged_gdf[percentage_columns] = merged_gdf[percentage_columns].fillna(0)

    # Convert the final GeoDataFrame to a GeoJSON structure
    # The Pydantic model will handle the conversion, so we can directly return the dict
    return merged_gdf.to_json()