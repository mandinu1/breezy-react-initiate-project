from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import pandas as pd
import numpy as np

from app.models import Retailer
from app.dependencies import get_boards_df, get_posm_df
# Assuming filter_df_by_board_type is now in options.py or a shared utils
from app.routers.options import filter_df_by_board_type, PROVIDERS_CONFIG_OPTIONS_INTERNAL as RETAILER_PROVIDERS_CONFIG # Use a consistent provider config

router = APIRouter()

# (get_provider_name_from_value_for_retailers_r can use the imported RETAILER_PROVIDERS_CONFIG)
def get_provider_name_from_value_for_retailers_r(value: str) -> Optional[str]:
    for p_config in RETAILER_PROVIDERS_CONFIG: # Use imported config
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
    boardType: Optional[str] = Query(None, alias="boardType"), # Added boardType for board context
    board_df: pd.DataFrame = Depends(get_boards_df),
    posm_df: pd.DataFrame = Depends(get_posm_df)
):
    df_source = board_df if context == "board" else posm_df
    if df_source.empty:
        return []

    retailers_filtered_df = df_source.copy()

    # Apply boardType filter first if context is 'board'
    if context == "board" and boardType and boardType != 'all':
        retailers_filtered_df = filter_df_by_board_type(retailers_filtered_df, boardType)
        if retailers_filtered_df.empty:
            return []

    effective_province = province or salesRegion
    effective_district = district or salesDistrict

    # Geographic filtering
    province_col_actual = 'PROVINCE' if 'PROVINCE' in retailers_filtered_df.columns else 'SALES_REGION'
    if effective_province and effective_province != 'all' and province_col_actual in retailers_filtered_df.columns:
        if province_col_actual in retailers_filtered_df: # Check column existence
            retailers_filtered_df[f"{province_col_actual}_LOWER_UNDERSCORE"] = retailers_filtered_df[province_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
            retailers_filtered_df = retailers_filtered_df[retailers_filtered_df[f"{province_col_actual}_LOWER_UNDERSCORE"] == effective_province.lower()]
    if retailers_filtered_df.empty: return []


    district_col_actual = 'DISTRICT' if 'DISTRICT' in retailers_filtered_df.columns else 'SALES_DISTRICT'
    if effective_district and effective_district != 'all' and district_col_actual in retailers_filtered_df.columns:
        if district_col_actual in retailers_filtered_df: # Check column existence
            retailers_filtered_df[f"{district_col_actual}_LOWER_UNDERSCORE"] = retailers_filtered_df[district_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
            retailers_filtered_df = retailers_filtered_df[retailers_filtered_df[f"{district_col_actual}_LOWER_UNDERSCORE"] == effective_district.lower()]
    if retailers_filtered_df.empty: return []
    
    if dsDivision and dsDivision != 'all' and 'DS_DIVISION' in retailers_filtered_df.columns:
        if 'DS_DIVISION' in retailers_filtered_df: # Check column existence
            retailers_filtered_df["DS_DIVISION_LOWER_UNDERSCORE"] = retailers_filtered_df['DS_DIVISION'].astype(str).str.lower().str.replace(' ', '_', regex=False)
            retailers_filtered_df = retailers_filtered_df[retailers_filtered_df["DS_DIVISION_LOWER_UNDERSCORE"] == dsDivision.lower()]
    if retailers_filtered_df.empty: return []


    # Provider-specific filtering for retailers
    if provider and provider != 'all':
        provider_name_actual = get_provider_name_from_value_for_retailers_r(provider)
        if provider_name_actual and not retailers_filtered_df.empty:
            condition = pd.Series(False, index=retailers_filtered_df.index)
            if context == "board":
                provider_prefix = provider_name_actual.upper()
                # Define which board columns to check based on boardType filter
                board_suffixes_to_check_provider = []
                if not boardType or boardType == 'all': # if boardType filter is 'all', check all types for this provider
                    board_suffixes_to_check_provider = ['_NAME_BOARD', '_SIDE_BOARD', '_TIN_BOARD']
                elif boardType == 'dealer':
                    board_suffixes_to_check_provider = ['_NAME_BOARD']
                elif boardType == 'tin':
                    board_suffixes_to_check_provider = ['_TIN_BOARD']
                elif boardType == 'vertical':
                    board_suffixes_to_check_provider = ['_SIDE_BOARD']
                
                board_cols = [f"{provider_prefix}{s}" for s in board_suffixes_to_check_provider]
                for col in board_cols:
                    if col in retailers_filtered_df.columns:
                        condition = condition | (pd.to_numeric(retailers_filtered_df[col], errors='coerce').fillna(0) > 0)
            elif context == "posm":
                posm_col = f"{provider_name_actual.upper()}_AREA_PERCENTAGE"
                if posm_col in retailers_filtered_df.columns:
                    condition = pd.to_numeric(retailers_filtered_df[posm_col], errors='coerce').fillna(0) > 0
            
            if condition.any():
                 retailers_filtered_df = retailers_filtered_df[condition]
            else: 
                 retailers_filtered_df = pd.DataFrame(columns=retailers_filtered_df.columns)
    if retailers_filtered_df.empty: return []


    if retailerId and retailerId != 'all':
        retailers_filtered_df['PROFILE_ID_STR'] = retailers_filtered_df['PROFILE_ID'].astype(str)
        retailers_filtered_df = retailers_filtered_df[retailers_filtered_df['PROFILE_ID_STR'] == retailerId]

    if retailers_filtered_df.empty:
        return []

    required_cols = ['PROFILE_ID', 'PROFILE_NAME', 'LATITUDE', 'LONGITUDE']
    if not all(col in retailers_filtered_df.columns for col in required_cols):
        print(f"Warning: Retailer data missing one of required columns: {required_cols} after filtering. Columns available: {retailers_filtered_df.columns.tolist()}")
        return [] 
    
    retailers_filtered_df['LATITUDE'] = pd.to_numeric(retailers_filtered_df['LATITUDE'], errors='coerce')
    retailers_filtered_df['LONGITUDE'] = pd.to_numeric(retailers_filtered_df['LONGITUDE'], errors='coerce')
    retailers_filtered_df.dropna(subset=['PROFILE_ID', 'LATITUDE', 'LONGITUDE'], inplace=True)
    
    if retailers_filtered_df.empty:
        return []

    unique_retailers_df = retailers_filtered_df.drop_duplicates(subset=['PROFILE_ID'])

    output_retailers = []
    for _, row_series in unique_retailers_df.iterrows():
        row = row_series.to_dict()
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