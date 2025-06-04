from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd

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

def safe_int_convert(value, default_value: Optional[int] = 0) -> Optional[int]:
    if pd.isna(value):
        return None # Pydantic Optional will handle None
    try:
        return int(float(value)) # Convert to float first to handle "1.0" then to int
    except (ValueError, TypeError):
        return default_value

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

    df = filter_by_max_capture_phase(board_df_raw, "board_data_for_api")
    if df.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # Apply provider and boardType specific filtering
    if filters.provider and filters.provider != 'all':
        provider_name_filter = get_provider_name_from_value(filters.provider)
        if provider_name_filter:
            provider_column_prefix = provider_name_filter.upper()
            condition_met = pd.Series(False, index=df.index)
            
            if not filters.boardType or filters.boardType == 'all': # Any board for this provider
                for bt_suffix in ["_NAME_BOARD", "_TIN_BOARD", "_SIDE_BOARD"]:
                    col = f"{provider_column_prefix}{bt_suffix}"
                    if col in df.columns: condition_met = condition_met | (df[col].fillna(0) > 0)
            elif filters.boardType == 'dealer' and f"{provider_column_prefix}_NAME_BOARD" in df.columns:
                condition_met = df[f"{provider_column_prefix}_NAME_BOARD"].fillna(0) > 0
            elif filters.boardType == 'tin' and f"{provider_column_prefix}_TIN_BOARD" in df.columns:
                condition_met = df[f"{provider_column_prefix}_TIN_BOARD"].fillna(0) > 0
            elif filters.boardType == 'vertical' and f"{provider_column_prefix}_SIDE_BOARD" in df.columns:
                condition_met = df[f"{provider_column_prefix}_SIDE_BOARD"].fillna(0) > 0
            df = df[condition_met]
    elif filters.boardType and filters.boardType != 'all': # Provider is 'all', but specific boardType
        condition_met = pd.Series(False, index=df.index)
        for p_config in PROVIDERS_CONFIG_SIMPLE:
            if p_config['name'] == 'All': continue
            p_prefix = p_config['name'].upper()
            if filters.boardType == 'dealer' and f"{p_prefix}_NAME_BOARD" in df.columns:
                condition_met = condition_met | (df[f"{p_prefix}_NAME_BOARD"].fillna(0) > 0)
            elif filters.boardType == 'tin' and f"{p_prefix}_TIN_BOARD" in df.columns:
                condition_met = condition_met | (df[f"{p_prefix}_TIN_BOARD"].fillna(0) > 0)
            elif filters.boardType == 'vertical' and f"{p_prefix}_SIDE_BOARD" in df.columns:
                condition_met = condition_met | (df[f"{p_prefix}_SIDE_BOARD"].fillna(0) > 0)
        df = df[condition_met]

    # Geographic and Retailer ID filters
    if filters.salesRegion and filters.salesRegion != 'all' and 'SALES_REGION' in df.columns:
         df = df[df['SALES_REGION'].astype(str).str.lower() == filters.salesRegion.lower()]
    elif filters.salesRegion and filters.salesRegion != 'all' and 'PROVINCE' in df.columns: # Fallback
         df = df[df['PROVINCE'].astype(str).str.lower() == filters.salesRegion.lower()]

    if filters.salesDistrict and filters.salesDistrict != 'all' and 'SALES_DISTRICT' in df.columns:
         df = df[df['SALES_DISTRICT'].astype(str).str.lower() == filters.salesDistrict.lower()]
    elif filters.salesDistrict and filters.salesDistrict != 'all' and 'DISTRICT' in df.columns: # Fallback
         df = df[df['DISTRICT'].astype(str).str.lower() == filters.salesDistrict.lower()]
    
    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in df.columns:
         df = df[df['DS_DIVISION'].astype(str).str.lower() == filters.dsDivision.lower()]

    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]

    board_data_list: List[BoardData] = []
    for rowIndex, row in df.iterrows():
        # Determine primary provider and boardType for this row based on actual data counts
        determined_provider = "Unknown"
        determined_board_type = "N/A"
        
        provider_board_counts = {}
        for p_cfg in PROVIDERS_CONFIG_SIMPLE:
            if p_cfg['name'] == 'All': continue
            p_key = p_cfg['name'].upper()
            provider_board_counts[p_cfg['name']] = {
                'dealer': row.get(f"{p_key}_NAME_BOARD", 0),
                'tin': row.get(f"{p_key}_TIN_BOARD", 0),
                'vertical': row.get(f"{p_key}_SIDE_BOARD", 0)
            }
        
        # Determine provider based on presence and filter
        if filters.provider and filters.provider != 'all':
            provider_filter_name = get_provider_name_from_value(filters.provider)
            if provider_filter_name and sum(provider_board_counts.get(provider_filter_name, {}).values()) > 0:
                determined_provider = provider_filter_name
        else: # Infer provider if 'all'
            for p_name, counts in provider_board_counts.items():
                if sum(counts.values()) > 0:
                    determined_provider = p_name
                    break # Take first one with any board
        
        # Determine board type based on presence for the determined_provider or filter
        if filters.boardType and filters.boardType != 'all':
            determined_board_type = filters.boardType
        elif determined_provider != "Unknown":
            counts = provider_board_counts.get(determined_provider, {})
            if counts.get('dealer', 0) > 0: determined_board_type = "dealer"
            elif counts.get('tin', 0) > 0: determined_board_type = "tin"
            elif counts.get('vertical', 0) > 0: determined_board_type = "vertical"

        original_id = safe_str_convert(row.get('S3_ARN'))
        detected_id = None
        inf_s3_arn_col_map = {
            "dealer": "_NAME_BOARD_INF_S3_ARN",
            "tin": "_TIN_BOARD_INF_S3_ARN",
            "vertical": "_SIDE_BOARD_INF_S3_ARN"
        }
        if determined_provider != "Unknown" and determined_board_type in inf_s3_arn_col_map:
            inf_col_suffix = inf_s3_arn_col_map[determined_board_type]
            detected_id = safe_str_convert(row.get(f'{determined_provider.upper()}{inf_col_suffix}'))
            if not detected_id: # Fallback if provider specific inference ARN is not present
                 detected_id = safe_str_convert(row.get(f'TIN_BOARD_INF_S3_ARN')) or \
                               safe_str_convert(row.get(f'SIDE_BOARD_INF_S3_ARN')) or \
                               safe_str_convert(row.get(f'NAME_BOARD_INF_S3_ARN'))


        item = BoardData(
            id=safe_str_convert(row.get('IMAGE_REF_ID', f"board_{rowIndex}_{row.get('PROFILE_ID', '')}")),
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
            boardType=determined_board_type,
            provider=determined_provider,
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
    
    # Calculate ProviderMetrics
    final_provider_counts: Dict[str, set] = {p['name']: set() for p in PROVIDERS_CONFIG_SIMPLE if p['name'] != 'All'}
    if not df.empty and 'PROFILE_ID' in df.columns:
        for p_config in PROVIDERS_CONFIG_SIMPLE:
            p_name = p_config['name']
            if p_name == 'All': continue
            
            provider_has_boards_for_type = pd.Series(False, index=df.index)
            p_prefix = p_name.upper()

            board_type_filter = filters.boardType if filters.boardType and filters.boardType != 'all' else 'all'

            if board_type_filter == 'dealer' or board_type_filter == 'all':
                col = f"{p_prefix}_NAME_BOARD"
                if col in df.columns: provider_has_boards_for_type = provider_has_boards_for_type | (df[col].fillna(0) > 0)
            if board_type_filter == 'tin' or board_type_filter == 'all':
                col = f"{p_prefix}_TIN_BOARD"
                if col in df.columns: provider_has_boards_for_type = provider_has_boards_for_type | (df[col].fillna(0) > 0)
            if board_type_filter == 'vertical' or board_type_filter == 'all':
                col = f"{p_prefix}_SIDE_BOARD"
                if col in df.columns: provider_has_boards_for_type = provider_has_boards_for_type | (df[col].fillna(0) > 0)
            
            final_provider_counts[p_name].update(df[provider_has_boards_for_type]['PROFILE_ID'].dropna().unique())

    provider_metrics_list = [
        ProviderMetric(provider=p_name, count=len(unique_profile_ids))
        for p_name, unique_profile_ids in final_provider_counts.items()
    ]
    
    return FetchBoardsResponse(
        data=board_data_list,
        count=len(board_data_list), # Number of individual board entries matching filters
        providerMetrics=provider_metrics_list
    )