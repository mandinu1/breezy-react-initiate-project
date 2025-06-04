from fastapi import APIRouter, Depends, Query
from typing import List, Optional
import pandas as pd

from app.models import FilterOption
from app.dependencies import get_boards_df, get_posm_df # Using board_df as primary source for board view filters

router = APIRouter()

# Helper to get provider name from its value string (e.g., "dialog" -> "Dialog")
# This should ideally come from a shared config if PROVIDERS_CONFIG_SIMPLE is used elsewhere
PROVIDERS_CONFIG_API_INTERNAL = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]

def get_provider_name_from_value_internal(value: str) -> Optional[str]:
    for p_config in PROVIDERS_CONFIG_API_INTERNAL:
        if p_config["value"] == value:
            return p_config["name"]
    return None

def get_unique_options_from_df(df: pd.DataFrame, column_name: str) -> List[FilterOption]:
    if df.empty or column_name not in df.columns:
        return []
    
    # Ensure we handle NaN by dropping them before getting unique values, then convert to string
    unique_values = pd.Series(df[column_name].dropna().unique()).astype(str).sort_values().tolist()

    options = [
        FilterOption(
            value=str(val).lower().replace(' ', '_'), # Create a consistent value
            label=str(val)
        ) for val in unique_values if str(val).strip() != ""
    ]
    return options # "All" option will be added by frontend

@router.get("/options/provinces", response_model=List[FilterOption])
async def get_province_options_api(
    provider: Optional[str] = Query(None), # e.g., "dialog", "mobitel", or "all"
    # salesView: bool = Query(false), # Not directly used if column names are handled by preference
    board_df: pd.DataFrame = Depends(get_boards_df)
):
    df_to_filter = board_df.copy()

    if provider and provider != 'all':
        provider_name_actual = get_provider_name_from_value_internal(provider)
        if provider_name_actual:
            # Filter df_to_filter to rows where this provider has any board type
            # This is complex as it requires checking multiple columns for the provider
            # For simplicity, if a provider is selected, we assume all provinces might still be relevant
            # unless the data strictly links providers to specific provinces.
            # A more accurate filter would check board presence for that provider.
            # Example (simplified): if f"{provider_name_actual.upper()}_TOTAL_BOARDS" in df_to_filter.columns:
            #    df_to_filter = df_to_filter[df_to_filter[f"{provider_name_actual.upper()}_TOTAL_BOARDS"] > 0]
            pass # Not filtering provinces by provider presence for now to keep it broad

    # Prefer 'PROVINCE', then 'SALES_REGION'
    col_to_use = None
    if 'PROVINCE' in df_to_filter.columns:
        col_to_use = 'PROVINCE'
    elif 'SALES_REGION' in df_to_filter.columns:
        col_to_use = 'SALES_REGION'
    
    if col_to_use:
        return get_unique_options_from_df(df_to_filter, col_to_use)
    return []


@router.get("/options/districts", response_model=List[FilterOption])
async def get_district_options_api(
    provider: Optional[str] = Query(None),
    province: Optional[str] = Query(None), # This is the 'value' like 'western_province'
    # salesView: bool = Query(false),
    board_df: pd.DataFrame = Depends(get_boards_df)
):
    df_to_filter = board_df.copy()

    # 1. Filter by Provider (if any, similar to provinces - simplified for now)
    if provider and provider != 'all':
        # Simplified: assume districts are independent of provider for option listing for now
        pass

    # 2. Filter by Province
    # Determine which column to use for province filtering based on availability
    province_col_name_actual = None
    if 'PROVINCE' in df_to_filter.columns:
        province_col_name_actual = 'PROVINCE'
    elif 'SALES_REGION' in df_to_filter.columns:
        province_col_name_actual = 'SALES_REGION'

    if province and province != "all" and province_col_name_actual:
        # The 'province' value is like 'western', 'central'. Data might be 'Western', 'Central'.
        # So, compare in a case-insensitive way or match the value format.
        df_to_filter = df_to_filter[df_to_filter[province_col_name_actual].str.lower().replace(' ', '_', regex=False) == province.lower()]

    # 3. Get unique districts from the (potentially) filtered DataFrame
    district_col_name_actual = None
    if 'DISTRICT' in df_to_filter.columns:
        district_col_name_actual = 'DISTRICT'
    elif 'SALES_DISTRICT' in df_to_filter.columns:
        district_col_name_actual = 'SALES_DISTRICT'
    
    if district_col_name_actual:
        return get_unique_options_from_df(df_to_filter, district_col_name_actual)
    return []


@router.get("/options/ds-divisions", response_model=List[FilterOption])
async def get_ds_division_options_api(
    provider: Optional[str] = Query(None),
    province: Optional[str] = Query(None),
    district: Optional[str] = Query(None), # This is the 'value' like 'colombo'
    board_df: pd.DataFrame = Depends(get_boards_df)
):
    df_to_filter = board_df.copy()

    # 1. Filter by Provider (simplified)
    if provider and provider != 'all':
        pass

    # 2. Filter by Province
    province_col_name_actual = 'PROVINCE' if 'PROVINCE' in df_to_filter.columns else 'SALES_REGION'
    if province and province != "all" and province_col_name_actual in df_to_filter.columns:
        df_to_filter = df_to_filter[df_to_filter[province_col_name_actual].str.lower().replace(' ', '_', regex=False) == province.lower()]

    # 3. Filter by District
    district_col_name_actual = 'DISTRICT' if 'DISTRICT' in df_to_filter.columns else 'SALES_DISTRICT'
    if district and district != "all" and district_col_name_actual in df_to_filter.columns:
        df_to_filter = df_to_filter[df_to_filter[district_col_name_actual].str.lower().replace(' ', '_', regex=False) == district.lower()]
    
    # 4. Get unique DS Divisions
    if 'DS_DIVISION' in df_to_filter.columns:
        return get_unique_options_from_df(df_to_filter, "DS_DIVISION")
    return []