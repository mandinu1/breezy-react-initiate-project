from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd

from app.models import FetchBoardsResponse, BoardFiltersState, ProviderMetric, BoardData
from app.dependencies import get_boards_df
from app.data_loader import filter_by_max_capture_phase

router = APIRouter()

PROVIDERS_CONFIG_SIMPLE_BOARDS = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]

def get_provider_name_from_value_boards(value: str) -> Optional[str]:
    for p_config in PROVIDERS_CONFIG_SIMPLE_BOARDS:
        if p_config["value"] == value:
            return p_config["name"]
    return None

def safe_int_convert(value, default_value: Optional[int] = 0) -> Optional[int]:
    if pd.isna(value):
        return None
    try:
        return int(float(value))
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

    # Apply retailerId filter first if present, as it's the most specific
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]
        if df.empty: # If selected retailer has no data after this, no point proceeding
            return FetchBoardsResponse(data=[], count=0, providerMetrics=[])


    # Apply provider and boardType specific filtering
    # This logic tries to find rows where the specified provider has the specified board type.
    # If provider is 'all', it checks for the board type across all providers.
    # If boardType is 'all', it checks for any board type for the specified provider.

    provider_name_filter = get_provider_name_from_value_boards(filters.provider) if filters.provider and filters.provider != 'all' else None
    board_type_filter = filters.boardType if filters.boardType and filters.boardType != 'all' else 'all'

    if provider_name_filter or board_type_filter != 'all':
        conditions = pd.Series(False, index=df.index)
        providers_to_check = [provider_name_filter] if provider_name_filter else [p['name'] for p in PROVIDERS_CONFIG_SIMPLE_BOARDS if p['name'] != 'All']
        
        board_suffixes_map = {
            'dealer': ['_NAME_BOARD'],
            'tin': ['_TIN_BOARD'],
            'vertical': ['_SIDE_BOARD'],
            'all': ['_NAME_BOARD', '_TIN_BOARD', '_SIDE_BOARD']
        }
        suffixes_to_check = board_suffixes_map.get(board_type_filter, [])

        for p_name in providers_to_check:
            p_prefix = p_name.upper()
            for suffix in suffixes_to_check:
                col = f"{p_prefix}{suffix}"
                if col in df.columns:
                    conditions = conditions | (pd.to_numeric(df[col], errors='coerce').fillna(0) > 0)
        df = df[conditions]
        if df.empty:
             return FetchBoardsResponse(data=[], count=0, providerMetrics=[])


    # Geographic filters (applied after retailer and type/provider filters if they were specific)
    # If a retailerId was already applied, these geo filters act as a sub-filter IF that retailer matches the geo.
    # Or, if no retailerId, these broadly filter the dataset.
    province_col_actual = 'PROVINCE' if 'PROVINCE' in df.columns else 'SALES_REGION'
    if filters.salesRegion and filters.salesRegion != 'all' and province_col_actual in df.columns:
         df = df[df[province_col_actual].str.lower().replace(' ', '_', regex=False) == filters.salesRegion.lower()]

    district_col_actual = 'DISTRICT' if 'DISTRICT' in df.columns else 'SALES_DISTRICT'
    if filters.salesDistrict and filters.salesDistrict != 'all' and district_col_actual in df.columns:
         df = df[df[district_col_actual].str.lower().replace(' ', '_', regex=False) == filters.salesDistrict.lower()]
    
    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in df.columns:
         df = df[df['DS_DIVISION'].str.lower().replace(' ', '_', regex=False) == filters.dsDivision.lower()]
    
    if df.empty: # Check again after geo filters
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])


    board_data_list: List[BoardData] = []
    for rowIndex, row in df.iterrows():
        # Determine primary provider and boardType for this specific entry from the filtered row
        # This part is tricky if a row can represent multiple boards. Assuming one dominant one for display.
        determined_provider_for_entry = "Unknown"
        determined_board_type_for_entry = "N/A"

        # Logic to determine provider and boardType for *this specific row*
        # (This might be different from the filters applied if filters were 'all')
        highest_count = 0
        for p_cfg_iter in PROVIDERS_CONFIG_SIMPLE_BOARDS:
            if p_cfg_iter['name'] == 'All': continue
            p_key_iter = p_cfg_iter['name'].upper()
            for bt_val_iter, bt_label_iter, suffix_iter in [('dealer', 'Dealer Board', '_NAME_BOARD'), ('tin', 'Tin Plate', '_TIN_BOARD'), ('vertical', 'Vertical Board', '_SIDE_BOARD')]:
                col_name_iter = f"{p_key_iter}{suffix_iter}"
                if col_name_iter in row and pd.to_numeric(row[col_name_iter], errors='coerce').fillna(0) > 0:
                    current_val = pd.to_numeric(row[col_name_iter], errors='coerce').fillna(0)
                    if current_val > highest_count : # Simple heuristic: provider/type with most boards on this row
                        highest_count = current_val
                        determined_provider_for_entry = p_cfg_iter['name']
                        determined_board_type_for_entry = bt_val_iter
                    # If no single dominant, the first one found for this row.
                    elif determined_provider_for_entry == "Unknown":
                         determined_provider_for_entry = p_cfg_iter['name']
                         determined_board_type_for_entry = bt_val_iter


        original_id = safe_str_convert(row.get('S3_ARN')) # Main image for the retailer/location
        detected_id = None # This should be specific to the board type detected

        inf_s3_arn_col_map = {
            "dealer": "_NAME_BOARD_INF_S3_ARN",
            "tin": "_TIN_BOARD_INF_S3_ARN",
            "vertical": "_SIDE_BOARD_INF_S3_ARN"
        }
        if determined_provider_for_entry != "Unknown" and determined_board_type_for_entry in inf_s3_arn_col_map:
            inf_col_suffix = inf_s3_arn_col_map[determined_board_type_for_entry]
            detected_id_col = f'{determined_provider_for_entry.upper()}{inf_col_suffix}'
            if detected_id_col in row:
                 detected_id = safe_str_convert(row.get(detected_id_col))
            # Fallback if provider-specific inference ARN is not present, try generic ones
            if not detected_id:
                if determined_board_type_for_entry == "dealer" and "NAME_BOARD_INF_S3_ARN" in row:
                    detected_id = safe_str_convert(row.get("NAME_BOARD_INF_S3_ARN"))
                elif determined_board_type_for_entry == "tin" and "TIN_BOARD_INF_S3_ARN" in row:
                    detected_id = safe_str_convert(row.get("TIN_BOARD_INF_S3_ARN"))
                elif determined_board_type_for_entry == "vertical" and "SIDE_BOARD_INF_S3_ARN" in row:
                    detected_id = safe_str_convert(row.get("SIDE_BOARD_INF_S3_ARN"))


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
            boardType=determined_board_type_for_entry,
            provider=determined_provider_for_entry,
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

    # Calculate ProviderMetrics based on the *final filtered df* before converting to BoardData list
    # This should count unique PROFILE_IDs that have boards for each provider matching the filters
    final_provider_counts: Dict[str, set] = {p['name']: set() for p in PROVIDERS_CONFIG_SIMPLE_BOARDS if p['name'] != 'All'}
    if not df.empty and 'PROFILE_ID' in df.columns:
        for p_config_metric in PROVIDERS_CONFIG_SIMPLE_BOARDS:
            p_name_metric = p_config_metric['name']
            if p_name_metric == 'All': continue
            
            # Check if this provider has any boards of the filtered type (or any type if boardType filter is 'all')
            provider_has_relevant_boards_condition = pd.Series(False, index=df.index)
            p_prefix_metric = p_name_metric.upper()

            for suffix_metric in board_suffixes_map.get(board_type_filter, []): # Use already determined suffixes_to_check
                col_metric = f"{p_prefix_metric}{suffix_metric}"
                if col_metric in df.columns:
                    provider_has_relevant_boards_condition = provider_has_relevant_boards_condition | (pd.to_numeric(df[col_metric], errors='coerce').fillna(0) > 0)
            
            # Update count with unique PROFILE_IDs from the df rows that satisfy the condition for this provider
            final_provider_counts[p_name_metric].update(df[provider_has_relevant_boards_condition]['PROFILE_ID'].dropna().unique())

    provider_metrics_list = [
        ProviderMetric(provider=p_name, count=len(unique_profile_ids))
        for p_name, unique_profile_ids in final_provider_counts.items()
    ]

    return FetchBoardsResponse(
        data=board_data_list,
        count=len(board_data_list),
        providerMetrics=provider_metrics_list
    )