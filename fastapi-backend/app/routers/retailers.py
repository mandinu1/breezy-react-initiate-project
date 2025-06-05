from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import pandas as pd
import numpy as np

from app.models import Retailer
from app.dependencies import get_boards_df, get_posm_df

router = APIRouter()

PROVIDERS_CONFIG_INTERNAL_RETAILERS_R = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]

def get_provider_name_from_value_for_retailers_r(value: str) -> Optional[str]:
    for p_config in PROVIDERS_CONFIG_INTERNAL_RETAILERS_R:
        if p_config["value"] == value:
            return p_config["name"]
    return None

@router.get("/retailers", response_model=List[Retailer])
async def fetch_retailers_api(
    provider: Optional[str] = Query(None),
    province: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    dsDivision: Optional[str] = Query(None),
    salesRegion: Optional[str] = Query(None, alias="salesRegion"),
    salesDistrict: Optional[str] = Query(None, alias="salesDistrict"),
    retailerId: Optional[str] = Query(None),
    context: str = Query("board"),
    board_df: pd.DataFrame = Depends(get_boards_df),
    posm_df: pd.DataFrame = Depends(get_posm_df)
):
    df_source = board_df if context == "board" else posm_df
    if df_source.empty:
        return []

    retailers_filtered_df = df_source.copy() # Initialize with a copy

    effective_province = province or salesRegion
    effective_district = district or salesDistrict

    # Geographic filtering
    province_col_actual = 'PROVINCE' if 'PROVINCE' in retailers_filtered_df.columns else 'SALES_REGION'
    if effective_province and effective_province != 'all' and province_col_actual in retailers_filtered_df.columns:
        # Ensure the column exists before trying to create the lower_underscore version
        if province_col_actual in retailers_filtered_df:
            retailers_filtered_df[f"{province_col_actual}_LOWER_UNDERSCORE"] = retailers_filtered_df[province_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
            retailers_filtered_df = retailers_filtered_df[retailers_filtered_df[f"{province_col_actual}_LOWER_UNDERSCORE"] == effective_province.lower()]

    district_col_actual = 'DISTRICT' if 'DISTRICT' in retailers_filtered_df.columns else 'SALES_DISTRICT'
    if effective_district and effective_district != 'all' and district_col_actual in retailers_filtered_df.columns:
        if district_col_actual in retailers_filtered_df: # Check column existence
            retailers_filtered_df[f"{district_col_actual}_LOWER_UNDERSCORE"] = retailers_filtered_df[district_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
            retailers_filtered_df = retailers_filtered_df[retailers_filtered_df[f"{district_col_actual}_LOWER_UNDERSCORE"] == effective_district.lower()]
    
    if dsDivision and dsDivision != 'all' and 'DS_DIVISION' in retailers_filtered_df.columns:
        if 'DS_DIVISION' in retailers_filtered_df: # Check column existence
            retailers_filtered_df["DS_DIVISION_LOWER_UNDERSCORE"] = retailers_filtered_df['DS_DIVISION'].astype(str).str.lower().str.replace(' ', '_', regex=False)
            retailers_filtered_df = retailers_filtered_df[retailers_filtered_df["DS_DIVISION_LOWER_UNDERSCORE"] == dsDivision.lower()]

    # Provider-specific filtering
    if provider and provider != 'all':
        provider_name_actual = get_provider_name_from_value_for_retailers_r(provider)
        if provider_name_actual and not retailers_filtered_df.empty: # Check if df is not empty
            condition = pd.Series(False, index=retailers_filtered_df.index)
            if context == "board":
                provider_prefix = provider_name_actual.upper()
                board_cols = [f"{provider_prefix}_NAME_BOARD", f"{provider_prefix}_SIDE_BOARD", f"{provider_prefix}_TIN_BOARD"]
                for col in board_cols:
                    if col in retailers_filtered_df.columns:
                        condition = condition | (pd.to_numeric(retailers_filtered_df[col], errors='coerce').fillna(0) > 0)
            elif context == "posm":
                posm_col = f"{provider_name_actual.upper()}_AREA_PERCENTAGE"
                if posm_col in retailers_filtered_df.columns:
                    condition = pd.to_numeric(retailers_filtered_df[posm_col], errors='coerce').fillna(0) > 0
            
            if condition.any():
                 retailers_filtered_df = retailers_filtered_df[condition]
            else: # No retailers match this provider criteria
                 retailers_filtered_df = pd.DataFrame(columns=retailers_filtered_df.columns)


    if retailerId and retailerId != 'all' and not retailers_filtered_df.empty: # Check if df is not empty
        retailers_filtered_df['PROFILE_ID_STR'] = retailers_filtered_df['PROFILE_ID'].astype(str)
        retailers_filtered_df = retailers_filtered_df[retailers_filtered_df['PROFILE_ID_STR'] == retailerId]

    if retailers_filtered_df.empty:
        return []

    required_cols = ['PROFILE_ID', 'PROFILE_NAME', 'LATITUDE', 'LONGITUDE']
    # **** Corrected line below ****
    if not all(col in retailers_filtered_df.columns for col in required_cols):
        # This case should ideally not be hit if source data is consistent
        # If it does, it means essential columns are missing even before unique retailer creation
        # Consider logging this scenario
        print(f"Warning: Retailer data missing one of required columns: {required_cols} after filtering. Columns available: {retailers_filtered_df.columns.tolist()}")
        return [] 
    
    # Drop NaN for essential fields before creating Retailer objects
    # Ensure LATITUDE and LONGITUDE can be converted to float
    retailers_filtered_df['LATITUDE'] = pd.to_numeric(retailers_filtered_df['LATITUDE'], errors='coerce')
    retailers_filtered_df['LONGITUDE'] = pd.to_numeric(retailers_filtered_df['LONGITUDE'], errors='coerce')
    retailers_filtered_df.dropna(subset=['PROFILE_ID', 'LATITUDE', 'LONGITUDE'], inplace=True)
    
    if retailers_filtered_df.empty: # Check again after dropna
        return []

    unique_retailers_df = retailers_filtered_df.drop_duplicates(subset=['PROFILE_ID'])

    output_retailers = []
    for _, row_series in unique_retailers_df.iterrows():
        row = row_series.to_dict() # Convert series to dict for .get()
        province_val = row.get('PROVINCE') if 'PROVINCE' in row else row.get('SALES_REGION')
        district_val = row.get('DISTRICT') if 'DISTRICT' in row else row.get('SALES_DISTRICT')
        image_identifier_val = row.get('S3_ARN')

        output_retailers.append(Retailer(
            id=str(row['PROFILE_ID']),
            name=str(row.get('PROFILE_NAME', 'N/A')),
            latitude=float(row['LATITUDE']),
            longitude=float(row['LONGITUDE']),
            imageIdentifier=str(image_identifier_val) if pd.notna(image_identifier_val) else None,
            province=str(province_val) if pd.notna(province_val) else None,
            district=str(district_val) if pd.notna(district_val) else None
        ))
    return output_retailers