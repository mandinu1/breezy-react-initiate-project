from fastapi import APIRouter, Depends, Query
from typing import List, Optional
import pandas as pd

from app.models import FilterOption
from app.dependencies import get_boards_df, get_posm_df

router = APIRouter()

PROVIDERS_CONFIG_OPTIONS_INTERNAL = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]

def get_provider_name_from_value_options(value: str) -> Optional[str]:
    for p_config in PROVIDERS_CONFIG_OPTIONS_INTERNAL:
        if p_config["value"] == value:
            return p_config["name"]
    return None

def get_unique_options_from_df_options(df: pd.DataFrame, column_name: str) -> List[FilterOption]:
    if df.empty or column_name not in df.columns:
        return []
    unique_values = pd.Series(df[column_name].dropna().unique()).astype(str).sort_values().tolist()
    options = [
        FilterOption(
            value=str(val).lower().replace(' ', '_'), 
            label=str(val)
        ) for val in unique_values if str(val).strip() != "" and str(val).lower() != "nan"
    ]
    return options

def filter_df_by_board_type(df: pd.DataFrame, board_type: Optional[str]) -> pd.DataFrame:
    if not board_type or board_type == 'all' or df.empty:
        return df

    board_type_conditions = pd.Series(False, index=df.index)
    board_type_suffixes_map = {
        'dealer': ['_NAME_BOARD'],
        'tin': ['_TIN_BOARD'],
        'vertical': ['_SIDE_BOARD'],
    }
    suffixes_to_check = board_type_suffixes_map.get(board_type.lower(), [])

    if not suffixes_to_check: # Should not happen if board_type is one of the known ones
        return df 

    for p_config in PROVIDERS_CONFIG_OPTIONS_INTERNAL:
        if p_config['name'] == 'All': continue
        p_prefix = p_config['name'].upper()
        for suffix in suffixes_to_check:
            col_name = f"{p_prefix}{suffix}"
            if col_name in df.columns:
                board_type_conditions = board_type_conditions | (pd.to_numeric(df[col_name], errors='coerce').fillna(0) > 0)
    
    if board_type_conditions.any():
        return df[board_type_conditions]
    return pd.DataFrame(columns=df.columns) # Return empty if no rows match board type


@router.get("/options/provinces", response_model=List[FilterOption])
async def get_province_options_api(
    provider: Optional[str] = Query(None),
    context: str = Query("board"),
    boardType: Optional[str] = Query(None, alias="boardType"), # Added boardType
    board_df: pd.DataFrame = Depends(get_boards_df),
    posm_df: pd.DataFrame = Depends(get_posm_df)
):
    df_source = board_df if context == "board" else posm_df
    if df_source.empty: return []
    df_to_filter = df_source.copy()

    if context == "board":
        df_to_filter = filter_df_by_board_type(df_to_filter, boardType)
        if df_to_filter.empty: return []

    if provider and provider != 'all':
        provider_name_actual = get_provider_name_from_value_options(provider)
        if provider_name_actual:
            if context == "posm" and f"{provider_name_actual.upper()}_AREA_PERCENTAGE" in df_to_filter.columns:
                df_to_filter = df_to_filter[pd.to_numeric(df_to_filter[f"{provider_name_actual.upper()}_AREA_PERCENTAGE"], errors='coerce').fillna(0) > 0]
            elif context == "board": # Provider filter for boards (already filtered by boardType if applicable)
                provider_prefix = provider_name_actual.upper()
                board_cols_for_provider = [f"{provider_prefix}_NAME_BOARD", f"{provider_prefix}_SIDE_BOARD", f"{provider_prefix}_TIN_BOARD"]
                # If boardType is specific, narrow down these columns
                if boardType and boardType != 'all':
                    bt_map = {'dealer': ['_NAME_BOARD'], 'tin': ['_TIN_BOARD'], 'vertical': ['_SIDE_BOARD']}
                    specific_suffixes = bt_map.get(boardType.lower(), [])
                    board_cols_for_provider = [f"{provider_prefix}{s}" for s in specific_suffixes]
                
                condition = pd.Series(False, index=df_to_filter.index)
                for col in board_cols_for_provider:
                    if col in df_to_filter.columns:
                        condition = condition | (pd.to_numeric(df_to_filter[col], errors='coerce').fillna(0) > 0)
                if condition.any(): df_to_filter = df_to_filter[condition]
                else: df_to_filter = pd.DataFrame(columns=df_to_filter.columns)
    if df_to_filter.empty: return []

    col_to_use = 'PROVINCE' if 'PROVINCE' in df_to_filter.columns else 'SALES_REGION'
    if col_to_use and col_to_use in df_to_filter.columns:
        return get_unique_options_from_df_options(df_to_filter, col_to_use)
    return []

@router.get("/options/districts", response_model=List[FilterOption])
async def get_district_options_api(
    provider: Optional[str] = Query(None),
    province: Optional[str] = Query(None),
    context: str = Query("board"),
    boardType: Optional[str] = Query(None, alias="boardType"), # Added boardType
    board_df: pd.DataFrame = Depends(get_boards_df),
    posm_df: pd.DataFrame = Depends(get_posm_df)
):
    df_source = board_df if context == "board" else posm_df
    if df_source.empty: return []
    df_to_filter = df_source.copy()

    if context == "board":
        df_to_filter = filter_df_by_board_type(df_to_filter, boardType)
        if df_to_filter.empty: return []

    if provider and provider != 'all': # Apply provider filter (same logic as in provinces)
        provider_name_actual = get_provider_name_from_value_options(provider)
        if provider_name_actual:
            # ... (provider filtering logic as in get_province_options_api) ...
            if context == "posm" and f"{provider_name_actual.upper()}_AREA_PERCENTAGE" in df_to_filter.columns:
                 df_to_filter = df_to_filter[pd.to_numeric(df_to_filter[f"{provider_name_actual.upper()}_AREA_PERCENTAGE"], errors='coerce').fillna(0) > 0]
            elif context == "board":
                provider_prefix = provider_name_actual.upper()
                board_cols_for_provider = [f"{provider_prefix}_NAME_BOARD", f"{provider_prefix}_SIDE_BOARD", f"{provider_prefix}_TIN_BOARD"]
                if boardType and boardType != 'all':
                    bt_map = {'dealer': ['_NAME_BOARD'], 'tin': ['_TIN_BOARD'], 'vertical': ['_SIDE_BOARD']}
                    specific_suffixes = bt_map.get(boardType.lower(), [])
                    board_cols_for_provider = [f"{provider_prefix}{s}" for s in specific_suffixes]
                condition = pd.Series(False, index=df_to_filter.index)
                for col in board_cols_for_provider:
                    if col in df_to_filter.columns: condition = condition | (pd.to_numeric(df_to_filter[col], errors='coerce').fillna(0) > 0)
                if condition.any(): df_to_filter = df_to_filter[condition]
                else: df_to_filter = pd.DataFrame(columns=df_to_filter.columns)
    if df_to_filter.empty: return []

    province_col_actual = 'PROVINCE' if 'PROVINCE' in df_to_filter.columns else 'SALES_REGION'
    if province and province != "all" and province_col_actual in df_to_filter.columns:
        df_to_filter[f"{province_col_actual}_LOWER_UNDERSCORE"] = df_to_filter[province_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
        df_to_filter = df_to_filter[df_to_filter[f"{province_col_actual}_LOWER_UNDERSCORE"] == province.lower()]
    if df_to_filter.empty: return []

    district_col_actual = 'DISTRICT' if 'DISTRICT' in df_to_filter.columns else 'SALES_DISTRICT'
    if district_col_actual and district_col_actual in df_to_filter.columns:
        return get_unique_options_from_df_options(df_to_filter, district_col_actual)
    return []

@router.get("/options/ds-divisions", response_model=List[FilterOption])
async def get_ds_division_options_api(
    provider: Optional[str] = Query(None),
    province: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    context: str = Query("board"),
    boardType: Optional[str] = Query(None, alias="boardType"), # Added boardType
    board_df: pd.DataFrame = Depends(get_boards_df),
    posm_df: pd.DataFrame = Depends(get_posm_df)
):
    df_source = board_df if context == "board" else posm_df
    if df_source.empty: return []
    df_to_filter = df_source.copy()

    if context == "board":
        df_to_filter = filter_df_by_board_type(df_to_filter, boardType)
        if df_to_filter.empty: return []

    if provider and provider != 'all': # Apply provider filter
        provider_name_actual = get_provider_name_from_value_options(provider)
        if provider_name_actual:
            # ... (provider filtering logic as in get_province_options_api) ...
            if context == "posm" and f"{provider_name_actual.upper()}_AREA_PERCENTAGE" in df_to_filter.columns:
                 df_to_filter = df_to_filter[pd.to_numeric(df_to_filter[f"{provider_name_actual.upper()}_AREA_PERCENTAGE"], errors='coerce').fillna(0) > 0]
            elif context == "board":
                provider_prefix = provider_name_actual.upper()
                board_cols_for_provider = [f"{provider_prefix}_NAME_BOARD", f"{provider_prefix}_SIDE_BOARD", f"{provider_prefix}_TIN_BOARD"]
                if boardType and boardType != 'all':
                    bt_map = {'dealer': ['_NAME_BOARD'], 'tin': ['_TIN_BOARD'], 'vertical': ['_SIDE_BOARD']}
                    specific_suffixes = bt_map.get(boardType.lower(), [])
                    board_cols_for_provider = [f"{provider_prefix}{s}" for s in specific_suffixes]
                condition = pd.Series(False, index=df_to_filter.index)
                for col in board_cols_for_provider:
                    if col in df_to_filter.columns: condition = condition | (pd.to_numeric(df_to_filter[col], errors='coerce').fillna(0) > 0)
                if condition.any(): df_to_filter = df_to_filter[condition]
                else: df_to_filter = pd.DataFrame(columns=df_to_filter.columns)
    if df_to_filter.empty: return []

    province_col_actual = 'PROVINCE' if 'PROVINCE' in df_to_filter.columns else 'SALES_REGION'
    if province and province != "all" and province_col_actual in df_to_filter.columns:
        df_to_filter[f"{province_col_actual}_LOWER_UNDERSCORE"] = df_to_filter[province_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
        df_to_filter = df_to_filter[df_to_filter[f"{province_col_actual}_LOWER_UNDERSCORE"] == province.lower()]
    if df_to_filter.empty: return []

    district_col_actual = 'DISTRICT' if 'DISTRICT' in df_to_filter.columns else 'SALES_DISTRICT'
    if district and district != "all" and district_col_actual in df_to_filter.columns:
        df_to_filter[f"{district_col_actual}_LOWER_UNDERSCORE"] = df_to_filter[district_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
        df_to_filter = df_to_filter[df_to_filter[f"{district_col_actual}_LOWER_UNDERSCORE"] == district.lower()]
    if df_to_filter.empty: return []
    
    if 'DS_DIVISION' in df_to_filter.columns:
        return get_unique_options_from_df_options(df_to_filter, "DS_DIVISION")
    return []