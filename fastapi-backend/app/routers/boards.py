from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd

# Ensure your BoardData model here matches the one in app.models.py
from app.models import FetchBoardsResponse, BoardFiltersState, ProviderMetric, BoardData 
from app.dependencies import get_boards_df
from app.data_loader import filter_by_max_capture_phase

router = APIRouter()

PROVIDERS_CONFIG_SIMPLE = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]

def get_provider_name_from_value(value: str) -> Optional[str]:
    for p_config in PROVIDERS_CONFIG_SIMPLE:
        if p_config["value"] == value:
            return p_config["name"]
    return None

def safe_int_convert(value, default=0) -> Optional[int]:
    if pd.isna(value):
        return None # Keep it None if source is NaN, Pydantic Optional[int] handles this
    try:
        return int(value)
    except (ValueError, TypeError):
        return default # Or None, depending on how you want to handle conversion errors

def safe_str_convert(value) -> Optional[str]:
    if pd.isna(value):
        return None
    return str(value)

@router.get("/boards", response_model=FetchBoardsResponse)
async def fetch_boards_api(
    filters: BoardFiltersState = Depends(),
    board_df_raw: pd.DataFrame = Depends(get_boards_df)
):
    if board_df_raw.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    df = filter_by_max_capture_phase(board_df_raw, "board_data")
    if df.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # Apply boardType pre-filter if needed more explicitly.
    # The current logic mostly derives boardType per row or uses the filter.
    # Provider-specific filtering
    if filters.provider and filters.provider != 'all':
        provider_name_filter = get_provider_name_from_value(filters.provider)
        if provider_name_filter:
            provider_column_prefix = provider_name_filter.upper()
            
            condition_met = pd.Series(False, index=df.index)
            if filters.boardType == 'all' or not filters.boardType:
                name_col = f"{provider_column_prefix}_NAME_BOARD"
                tin_col = f"{provider_column_prefix}_TIN_BOARD"
                side_col = f"{provider_column_prefix}_SIDE_BOARD"
                if name_col in df.columns: condition_met = condition_met | (df[name_col] > 0)
                if tin_col in df.columns: condition_met = condition_met | (df[tin_col] > 0)
                if side_col in df.columns: condition_met = condition_met | (df[side_col] > 0)
            elif filters.boardType == 'dealer' and f"{provider_column_prefix}_NAME_BOARD" in df.columns:
                condition_met = df[f"{provider_column_prefix}_NAME_BOARD"] > 0
            elif filters.boardType == 'tin' and f"{provider_column_prefix}_TIN_BOARD" in df.columns:
                condition_met = df[f"{provider_column_prefix}_TIN_BOARD"] > 0
            elif filters.boardType == 'vertical' and f"{provider_column_prefix}_SIDE_BOARD" in df.columns:
                condition_met = df[f"{provider_column_prefix}_SIDE_BOARD"] > 0
            
            df = df[condition_met]


    # Geographic and Retailer ID filters (ensure columns exist before filtering)
    if filters.salesRegion and filters.salesRegion != 'all' and 'SALES_REGION' in df.columns:
         df = df[df['SALES_REGION'].astype(str).str.lower() == filters.salesRegion.lower()]
    
    if filters.salesDistrict and filters.salesDistrict != 'all' and 'SALES_DISTRICT' in df.columns:
         df = df[df['SALES_DISTRICT'].astype(str).str.lower() == filters.salesDistrict.lower()]

    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in df.columns:
         df = df[df['DS_DIVISION'].astype(str).str.lower() == filters.dsDivision.lower()]

    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]

    board_data_list: List[BoardData] = []
    for rowIndex, row in df.iterrows():
        # Determine primary provider and boardType for this row
        # This logic might need further refinement based on business rules
        # if a row can genuinely represent multiple providers/board_types simultaneously.
        # The frontend currently expects one provider and one boardType per BoardData item.
        
        provider_for_row = "Unknown"
        if filters.provider and filters.provider != 'all':
            provider_for_row = get_provider_name_from_value(filters.provider) or "Unknown"
        else: # Infer provider if not filtered
            for p_config in PROVIDERS_CONFIG_SIMPLE:
                if p_config['name'] == 'All': continue
                p_prefix = p_config['name'].upper()
                if (row.get(f"{p_prefix}_NAME_BOARD", 0) > 0 or
                    row.get(f"{p_prefix}_TIN_BOARD", 0) > 0 or
                    row.get(f"{p_prefix}_SIDE_BOARD", 0) > 0):
                    provider_for_row = p_config['name']
                    break # Take the first provider found

        board_type_for_row = "N/A"
        if filters.boardType and filters.boardType != 'all':
            board_type_for_row = filters.boardType
        else: # Infer board type if not filtered, or if 'all'
            p_prefix_for_type_inference = provider_for_row.upper() if provider_for_row != "Unknown" else None
            if p_prefix_for_type_inference: # If we have a specific provider, check its board types
                if row.get(f"{p_prefix_for_type_inference}_NAME_BOARD", 0) > 0: board_type_for_row = "dealer"
                elif row.get(f"{p_prefix_for_type_inference}_TIN_BOARD", 0) > 0: board_type_for_row = "tin"
                elif row.get(f"{p_prefix_for_type_inference}_SIDE_BOARD", 0) > 0: board_type_for_row = "vertical"
            else: # If provider is also "Unknown" or "All", try to find any board type
                if row.get('DIALOG_NAME_BOARD',0) > 0 or row.get('MOBITEL_NAME_BOARD',0) > 0 : board_type_for_row = "dealer" # Simplified
                elif row.get('DIALOG_TIN_BOARD',0) > 0 or row.get('MOBITEL_TIN_BOARD',0) > 0: board_type_for_row = "tin"
                elif row.get('DIALOG_SIDE_BOARD',0) > 0 or row.get('MOBITEL_SIDE_BOARD',0) > 0: board_type_for_row = "vertical"
        
        # Image Identifiers
        original_id = safe_str_convert(row.get('S3_ARN')) # Original image of the board capture
        detected_id = None
        if board_type_for_row == 'dealer' and provider_for_row not in ["Unknown", "N/A", "All"]:
            detected_id = safe_str_convert(row.get(f'{provider_for_row.upper()}_NAME_BOARD_INF_S3_ARN'))
        elif board_type_for_row == 'tin' and provider_for_row not in ["Unknown", "N/A", "All"]:
            detected_id = safe_str_convert(row.get(f'{provider_for_row.upper()}_TIN_BOARD_INF_S3_ARN'))
        elif board_type_for_row == 'vertical' and provider_for_row not in ["Unknown", "N/A", "All"]:
            detected_id = safe_str_convert(row.get(f'{provider_for_row.upper()}_SIDE_BOARD_INF_S3_ARN'))

        item = BoardData(
            id=str(row.get('IMAGE_REF_ID', f"board_{rowIndex}_{row.get('PROFILE_ID', '')}")),
            retailerId=safe_str_convert(row.get('PROFILE_ID')),
            PROFILE_ID=safe_str_convert(row.get('PROFILE_ID')),
            PROFILE_NAME=safe_str_convert(row.get('PROFILE_NAME')),
            PROVINCE=safe_str_convert(row.get('PROVINCE')),
            DISTRICT=safe_str_convert(row.get('DISTRICT')),
            DS_DIVISION=safe_str_convert(row.get('DS_DIVISION')),
            GN_DIVISION=safe_str_convert(row.get('GN_DIVISION')),
            SALES_DISTRICT=safe_str_convert(row.get('SALES_DISTRICT')),
            SALES_AREA=safe_str_convert(row.get('SALES_AREA')),
            SALES_REGION=safe_str_convert(row.get('SALES_REGION')),
            boardType=board_type_for_row,
            provider=provider_for_row,
            DIALOG_NAME_BOARD=safe_int_convert(row.get('DIALOG_NAME_BOARD')),
            MOBITEL_NAME_BOARD=safe_int_convert(row.get('MOBITEL_NAME_BOARD')),
            HUTCH_NAME_BOARD=safe_int_convert(row.get('HUTCH_NAME_BOARD')),
            AIRTEL_NAME_BOARD=safe_int_convert(row.get('AIRTEL_NAME_BOARD')),
            DIALOG_SIDE_BOARD=safe_int_convert(row.get('DIALOG_SIDE_BOARD')),
            MOBITEL_SIDE_BOARD=safe_int_convert(row.get('MOBITEL_SIDE_BOARD')),
            HUTCH_SIDE_BOARD=safe_int_convert(row.get('HUTCH_SIDE_BOARD')),
            AIRTEL_SIDE_BOARD=safe_int_convert(row.get('AIRTEL_SIDE_BOARD')),
            DIALOG_TIN_BOARD=safe_int_convert(row.get('DIALOG_TIN_BOARD')),
            MOBITEL_TIN_BOARD=safe_int_convert(row.get('MOBITEL_TIN_BOARD')),
            HUTCH_TIN_BOARD=safe_int_convert(row.get('HUTCH_TIN_BOARD')),
            AIRTEL_TIN_BOARD=safe_int_convert(row.get('AIRTEL_TIN_BOARD')),
            originalBoardImageIdentifier=original_id,
            detectedBoardImageIdentifier=detected_id
        )
        board_data_list.append(item)
    
    # Calculate ProviderMetrics (count of unique retailers with boards of specified type/provider)
    final_provider_counts: Dict[str, set] = {p['name']: set() for p in PROVIDERS_CONFIG_SIMPLE if p['name'] != 'All'}
    if not df.empty and 'PROFILE_ID' in df.columns: # Ensure df is not empty and has PROFILE_ID
        for p_config in PROVIDERS_CONFIG_SIMPLE:
            p_name = p_config['name']
            if p_name == 'All':
                continue
            
            provider_has_boards_for_type = pd.Series(False, index=df.index) # Default to False for all rows
            p_prefix = p_name.upper()

            if filters.boardType == 'dealer' or filters.boardType == 'all':
                col = f"{p_prefix}_NAME_BOARD"
                if col in df.columns: provider_has_boards_for_type = provider_has_boards_for_type | (df[col] > 0)
            
            if filters.boardType == 'tin' or filters.boardType == 'all':
                col = f"{p_prefix}_TIN_BOARD"
                if col in df.columns: provider_has_boards_for_type = provider_has_boards_for_type | (df[col] > 0)

            if filters.boardType == 'vertical' or filters.boardType == 'all':
                col = f"{p_prefix}_SIDE_BOARD"
                if col in df.columns: provider_has_boards_for_type = provider_has_boards_for_type | (df[col] > 0)
            
            final_provider_counts[p_name].update(df[provider_has_boards_for_type]['PROFILE_ID'].dropna().unique())

    provider_metrics_list = [
        ProviderMetric(provider=p_name, count=len(unique_profile_ids))
        for p_name, unique_profile_ids in final_provider_counts.items()
    ]
    
    return FetchBoardsResponse(
        data=board_data_list,
        count=len(board_data_list),
        providerMetrics=provider_metrics_list
    )