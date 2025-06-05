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

    # Apply retailerId filter first
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df['PROFILE_ID_STR'] = df['PROFILE_ID'].astype(str)
        df = df[df['PROFILE_ID_STR'] == filters.retailerId]
        if df.empty:
            return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # Apply provider and boardType specific filtering to the df
    provider_name_filter = get_provider_name_from_value_boards(filters.provider) if filters.provider and filters.provider != 'all' else None
    board_type_filter = filters.boardType if filters.boardType and filters.boardType != 'all' else 'all'

    # This section filters the DataFrame `df` based on provider and boardType.
    if provider_name_filter or board_type_filter != 'all':
        conditions = pd.Series(False, index=df.index)
        providers_to_check_for_filtering = [provider_name_filter] if provider_name_filter else [p['name'] for p in PROVIDERS_CONFIG_SIMPLE_BOARDS if p['name'] != 'All']
        
        board_suffixes_map_for_filtering = {
            'dealer': ['_NAME_BOARD'], 'tin': ['_TIN_BOARD'], 'vertical': ['_SIDE_BOARD'],
            'all': ['_NAME_BOARD', '_TIN_BOARD', '_SIDE_BOARD']
        }
        suffixes_to_check_for_filtering = board_suffixes_map_for_filtering.get(board_type_filter, [])

        for p_name_check in providers_to_check_for_filtering:
            p_prefix_check = p_name_check.upper()
            for suffix_check in suffixes_to_check_for_filtering:
                col_check = f"{p_prefix_check}{suffix_check}"
                if col_check in df.columns:
                    conditions = conditions | (pd.to_numeric(df[col_check], errors='coerce').fillna(0) > 0)
        
        if conditions.any():
            df = df[conditions]
        elif provider_name_filter or board_type_filter != 'all': # If specific filters applied but no rows match
            df = pd.DataFrame(columns=df.columns) # Make df empty
            
        if df.empty:
             return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # Geographic filters (applied after other primary filters)
    temp_df_for_geo_filtering = df.copy() # Avoid chained assignment warnings
    province_col_actual = 'PROVINCE' if 'PROVINCE' in temp_df_for_geo_filtering.columns else 'SALES_REGION'
    if filters.salesRegion and filters.salesRegion != 'all' and province_col_actual in temp_df_for_geo_filtering.columns:
         temp_df_for_geo_filtering[f"{province_col_actual}_LOWER_UNDERSCORE"] = temp_df_for_geo_filtering[province_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
         temp_df_for_geo_filtering = temp_df_for_geo_filtering[temp_df_for_geo_filtering[f"{province_col_actual}_LOWER_UNDERSCORE"] == filters.salesRegion.lower()]

    district_col_actual = 'DISTRICT' if 'DISTRICT' in temp_df_for_geo_filtering.columns else 'SALES_DISTRICT'
    if filters.salesDistrict and filters.salesDistrict != 'all' and district_col_actual in temp_df_for_geo_filtering.columns:
         temp_df_for_geo_filtering[f"{district_col_actual}_LOWER_UNDERSCORE"] = temp_df_for_geo_filtering[district_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
         temp_df_for_geo_filtering = temp_df_for_geo_filtering[temp_df_for_geo_filtering[f"{district_col_actual}_LOWER_UNDERSCORE"] == filters.salesDistrict.lower()]
    
    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in temp_df_for_geo_filtering.columns:
         temp_df_for_geo_filtering["DS_DIVISION_LOWER_UNDERSCORE"] = temp_df_for_geo_filtering['DS_DIVISION'].astype(str).str.lower().str.replace(' ', '_', regex=False)
         temp_df_for_geo_filtering = temp_df_for_geo_filtering[temp_df_for_geo_filtering["DS_DIVISION_LOWER_UNDERSCORE"] == filters.dsDivision.lower()]
    df = temp_df_for_geo_filtering
    
    if df.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    board_data_list: List[BoardData] = []
    for rowIndex, row_series in df.iterrows():
        row = row_series.to_dict()
        # Determine primary provider and boardType for this specific entry
        determined_provider_for_entry = "Unknown"
        determined_board_type_for_entry = "N/A" # Default, will be updated if specific board found
        highest_count_for_entry = 0

        if provider_name_filter: # If a provider is filtered, this entry is for that provider
            determined_provider_for_entry = provider_name_filter
            # Determine its board type from the row based on the board_type_filter
            if board_type_filter != 'all':
                determined_board_type_for_entry = board_type_filter
            else: # Find any board type for this provider
                for bt_val_iter_entry, _, suffix_iter_entry in [('dealer', 'Dealer Board', '_NAME_BOARD'), ('tin', 'Tin Plate', '_TIN_BOARD'), ('vertical', 'Vertical Board', '_SIDE_BOARD')]:
                    col_name_iter_entry = f"{determined_provider_for_entry.upper()}{suffix_iter_entry}"
                    if pd.to_numeric(row.get(col_name_iter_entry), errors='coerce').fillna(0) > 0:
                        determined_board_type_for_entry = bt_val_iter_entry
                        break
        else: # Provider filter is 'all', determine by max count or first found
            for p_cfg_iter_entry in PROVIDERS_CONFIG_SIMPLE_BOARDS:
                if p_cfg_iter_entry['name'] == 'All': continue
                p_key_iter_entry = p_cfg_iter_entry['name'].upper()
                for bt_val_iter_entry, _, suffix_iter_entry in [('dealer', 'Dealer Board', '_NAME_BOARD'), ('tin', 'Tin Plate', '_TIN_BOARD'), ('vertical', 'Vertical Board', '_SIDE_BOARD')]:
                    # If board_type_filter is specific, only check that type
                    if board_type_filter != 'all' and bt_val_iter_entry != board_type_filter:
                        continue
                    col_name_iter_entry = f"{p_key_iter_entry}{suffix_iter_entry}"
                    current_val_entry = pd.to_numeric(row.get(col_name_iter_entry), errors='coerce').fillna(0)
                    if current_val_entry > 0:
                        if current_val_entry > highest_count_for_entry:
                            highest_count_for_entry = current_val_entry
                            determined_provider_for_entry = p_cfg_iter_entry['name']
                            determined_board_type_for_entry = bt_val_iter_entry
                        elif determined_provider_for_entry == "Unknown":
                            determined_provider_for_entry = p_cfg_iter_entry['name']
                            determined_board_type_for_entry = bt_val_iter_entry
        
        original_id = safe_str_convert(row.get('S3_ARN'))
        detected_id = None
        inf_s3_arn_col_map = {
            "dealer": "_NAME_BOARD_INF_S3_ARN", "tin": "_TIN_BOARD_INF_S3_ARN", "vertical": "_SIDE_BOARD_INF_S3_ARN"
        }
        if determined_provider_for_entry != "Unknown" and determined_board_type_for_entry != "N/A" and determined_board_type_for_entry in inf_s3_arn_col_map:
            inf_col_suffix = inf_s3_arn_col_map[determined_board_type_for_entry]
            detected_id_col_specific = f'{determined_provider_for_entry.upper()}{inf_col_suffix}'
            detected_id_col_generic_key = inf_col_suffix.lstrip('_') # e.g. NAME_BOARD_INF_S3_ARN
            
            if detected_id_col_specific in row and pd.notna(row.get(detected_id_col_specific)):
                 detected_id = safe_str_convert(row.get(detected_id_col_specific))
            elif detected_id_col_generic_key in row and pd.notna(row.get(detected_id_col_generic_key)):
                 detected_id = safe_str_convert(row.get(detected_id_col_generic_key))


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
    
    # ProviderMetrics: Sum of actual board counts for each provider from the filtered df
    provider_metrics_list_updated: List[ProviderMetric] = []
    if not df.empty:
        for p_config_metric in PROVIDERS_CONFIG_SIMPLE_BOARDS:
            p_name_metric = p_config_metric['name']
            if p_name_metric == 'All': continue
            
            total_boards_for_provider = 0
            p_prefix_metric = p_name_metric.upper()
            
            suffixes_to_sum_metrics = [] # These are from board_suffixes_map_for_filtering
            if board_type_filter == 'all':
                suffixes_to_sum_metrics = ['_NAME_BOARD', '_SIDE_BOARD', '_TIN_BOARD']
            elif board_type_filter == 'dealer':
                suffixes_to_sum_metrics = ['_NAME_BOARD']
            elif board_type_filter == 'tin':
                suffixes_to_sum_metrics = ['_TIN_BOARD']
            elif board_type_filter == 'vertical':
                suffixes_to_sum_metrics = ['_SIDE_BOARD']

            for suffix_metric in suffixes_to_sum_metrics:
                col_metric = f"{p_prefix_metric}{suffix_metric}"
                if col_metric in df.columns:
                    total_boards_for_provider += pd.to_numeric(df[col_metric], errors='coerce').fillna(0).sum()
            
            provider_metrics_list_updated.append(ProviderMetric(provider=p_name_metric, count=int(total_boards_for_provider)))
    
    return FetchBoardsResponse(
        data=board_data_list,
        count=len(board_data_list),
        providerMetrics=provider_metrics_list_updated
    )