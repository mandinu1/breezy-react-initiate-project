from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import pandas as pd
import numpy as np # For checking NaN

from app.models import Retailer
from app.dependencies import get_boards_df # Using board_df to infer retailers and their board presence

router = APIRouter()

# Helper from boards.py to map provider value to name
PROVIDERS_CONFIG_INTERNAL_RETAILERS = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]

def get_provider_name_from_value_for_retailers(value: str) -> Optional[str]:
    for p_config in PROVIDERS_CONFIG_INTERNAL_RETAILERS:
        if p_config["value"] == value:
            return p_config["name"]
    return None


@router.get("/retailers", response_model=List[Retailer])
async def fetch_retailers_api(
    provider: Optional[str] = Query(None), # e.g. "dialog"
    province: Optional[str] = Query(None), # e.g. "western_province" (value from dropdown)
    district: Optional[str] = Query(None), # e.g. "colombo"
    dsDivision: Optional[str] = Query(None),
    salesRegion: Optional[str] = Query(None, alias="salesRegion"), # Frontend might send this
    salesDistrict: Optional[str] = Query(None, alias="salesDistrict"),
    retailerId: Optional[str] = Query(None), # For fetching a specific retailer
    board_df: pd.DataFrame = Depends(get_boards_df)
):
    if board_df.empty:
        return []

    retailers_df = board_df.copy()

    # Consolidate province/salesRegion and district/salesDistrict
    effective_province = province or salesRegion
    effective_district = district or salesDistrict

    # Geographic filtering
    province_col_actual = 'PROVINCE' if 'PROVINCE' in retailers_df.columns else 'SALES_REGION'
    if effective_province and effective_province != 'all' and province_col_actual in retailers_df.columns:
        retailers_df = retailers_df[retailers_df[province_col_actual].str.lower().replace(' ', '_', regex=False) == effective_province.lower()]

    district_col_actual = 'DISTRICT' if 'DISTRICT' in retailers_df.columns else 'SALES_DISTRICT'
    if effective_district and effective_district != 'all' and district_col_actual in retailers_df.columns:
        retailers_df = retailers_df[retailers_df[district_col_actual].str.lower().replace(' ', '_', regex=False) == effective_district.lower()]
    
    if dsDivision and dsDivision != 'all' and 'DS_DIVISION' in retailers_df.columns:
        retailers_df = retailers_df[retailers_df['DS_DIVISION'].str.lower().replace(' ', '_', regex=False) == dsDivision.lower()]

    # Provider filtering: show retailers that have boards for the selected provider
    if provider and provider != 'all':
        provider_name_actual = get_provider_name_from_value_for_retailers(provider)
        if provider_name_actual:
            provider_prefix = provider_name_actual.upper()
            board_cols_for_provider = [
                f"{provider_prefix}_NAME_BOARD",
                f"{provider_prefix}_SIDE_BOARD",
                f"{provider_prefix}_TIN_BOARD"
            ]
            # Check if any of these columns exist and have a count > 0
            condition = pd.Series(False, index=retailers_df.index)
            for col in board_cols_for_provider:
                if col in retailers_df.columns:
                    # Ensure column is numeric, fillna with 0, then check > 0
                    condition = condition | (pd.to_numeric(retailers_df[col], errors='coerce').fillna(0) > 0)
            retailers_df = retailers_df[condition]

    if retailerId and retailerId != 'all':
        retailers_df = retailers_df[retailers_df['PROFILE_ID'].astype(str) == retailerId]

    # Create unique retailer list from the filtered board data
    # Ensure necessary columns for Retailer model are present
    required_cols = ['PROFILE_ID', 'PROFILE_NAME', 'LATITUDE', 'LONGITUDE']
    if not all(col in retailers_df.columns for col in required_cols):
        # Not enough data to form retailer objects if essential geo/id info is missing after filtering
        # Or, could raise an error, but returning empty list might be safer for frontend
        return []
        # raise HTTPException(status_code=500, detail="Essential retailer columns missing after filtering.")

    # Drop NaN for essential fields before creating Retailer objects
    retailers_df.dropna(subset=['PROFILE_ID', 'LATITUDE', 'LONGITUDE'], inplace=True)
    
    # Create unique retailers based on PROFILE_ID
    unique_retailers_df = retailers_df.drop_duplicates(subset=['PROFILE_ID'])

    output_retailers = []
    for _, row in unique_retailers_df.iterrows():
        # Handle potential NaN or missing values for optional fields
        province_val = row.get('PROVINCE') if 'PROVINCE' in row else row.get('SALES_REGION')
        district_val = row.get('DISTRICT') if 'DISTRICT' in row else row.get('SALES_DISTRICT')
        # Use S3_ARN from board.csv as a proxy for retailer's primary image for map popups etc.
        # This might need adjustment if a dedicated retailer image ARN is available elsewhere.
        image_identifier_val = row.get('S3_ARN') 

        output_retailers.append(Retailer(
            id=str(row['PROFILE_ID']),
            name=str(row.get('PROFILE_NAME', 'N/A')), # Default if PROFILE_NAME is missing
            latitude=float(row['LATITUDE']),
            longitude=float(row['LONGITUDE']),
            imageIdentifier=str(image_identifier_val) if pd.notna(image_identifier_val) else None,
            province=str(province_val) if pd.notna(province_val) else None,
            district=str(district_val) if pd.notna(district_val) else None
        ))
    return output_retailers