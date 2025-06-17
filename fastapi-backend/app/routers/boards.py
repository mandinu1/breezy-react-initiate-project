from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd
from app.models import FetchBoardsResponse, BoardFiltersState, ProviderMetric, BoardData
from app.dependencies import get_boards_df
from app.data_loader import filter_by_max_capture_phase

# Create an APIRouter instance. This helps organize endpoints into separate files.
router = APIRouter()

PROVIDERS_CONFIG_SIMPLE_BOARDS = [
    {"value": "all", "name": "All"},
    {"value": "dialog", "name": "Dialog"},
    {"value": "mobitel", "name": "Mobitel"},
    {"value": "airtel", "name": "Airtel"},
    {"value": "hutch", "name": "Hutch"},
]


# --- Helper Functions ---

def get_provider_name_from_value_boards(value: str) -> Optional[str]:
    """Looks up the display name of a provider from its filter value."""
    for p_config in PROVIDERS_CONFIG_SIMPLE_BOARDS:
        if p_config["value"] == value:
            return p_config["name"]
    return None

def safe_int_convert(value, default_value: int = 0) -> Optional[int]:
    
    if pd.isna(value):
        return None 
    try:
        # First convert to float to handle string representations of floats (e.g., "10.0")
        numeric_value = float(value)
        return int(numeric_value)
    except (ValueError, TypeError):
        # Return the default value if conversion fails.
        return default_value

def safe_str_convert(value) -> Optional[str]:
    """Safely converts a value to a string, returning None for pandas NA/NaN values."""
    if pd.isna(value):
        return None
    return str(value)


# --- API Endpoint Definition ---

@router.get("/boards", response_model=FetchBoardsResponse)
async def fetch_boards_api(
    # `filters` are query parameters parsed into a Pydantic model by FastAPI.
    filters: BoardFiltersState = Depends(),
    # `board_df_raw` is the main DataFrame, injected by the `get_boards_df` dependency.
    board_df_raw: pd.DataFrame = Depends(get_boards_df)
):
   
    # --- Initial Data Validation ---
    if board_df_raw.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # Filter the DataFrame to only include rows from the latest capture phase.
    df = filter_by_max_capture_phase(board_df_raw, "board_data_for_api")
    if df.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # --- Filtering Logic ---

    # 1. Filter by Retailer ID (PROFILE_ID)
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        # Ensure PROFILE_ID is string type for reliable comparison
        df['PROFILE_ID_STR'] = df['PROFILE_ID'].astype(str)
        df = df[df['PROFILE_ID_STR'] == filters.retailerId]
        if df.empty:
            return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # 2. Complex Filtering by Provider and Board Type
    provider_name_filter = get_provider_name_from_value_boards(filters.provider) if filters.provider and filters.provider != 'all' else None
    board_type_filter = filters.boardType if filters.boardType and filters.boardType != 'all' else 'all'

    # This block applies filters if a specific provider or board type is selected.
    if provider_name_filter or board_type_filter != 'all':
        # Start with a Series of all False values. We will OR conditions into this.
        conditions = pd.Series(False, index=df.index)
        
        # Determine which providers to check. If a specific one is filtered, use it. Otherwise, use all.
        providers_to_check_for_filtering = [provider_name_filter] if provider_name_filter else [p['name'] for p in PROVIDERS_CONFIG_SIMPLE_BOARDS if p['name'] != 'All']
        
        # Map frontend board type values to the suffixes of columns in the DataFrame.
        board_suffixes_map_for_filtering = {
            'dealer': ['_NAME_BOARD'], 'tin': ['_TIN_BOARD'], 'vertical': ['_SIDE_BOARD'],
            'all': ['_NAME_BOARD', '_TIN_BOARD', '_SIDE_BOARD']
        }
        suffixes_to_check_for_filtering = board_suffixes_map_for_filtering.get(board_type_filter, [])

        # Iterate through providers and board types to build the filter condition.
        for p_name_check in providers_to_check_for_filtering:
            p_prefix_check = p_name_check.upper()
            for suffix_check in suffixes_to_check_for_filtering:
                col_check = f"{p_prefix_check}{suffix_check}"
                if col_check in df.columns:
                    # The '|' is a bitwise OR. A row is kept if it meets ANY of the conditions.
                    # We check if the board count in the column is greater than 0.
                    conditions = conditions | (pd.to_numeric(df[col_check], errors='coerce').fillna(0) > 0)
        
        # Apply the combined conditions to the DataFrame.
        if conditions.any():
            df = df[conditions]
        # If any filter was applied but resulted in no matches, return an empty result set.
        elif provider_name_filter or board_type_filter != 'all':
            df = pd.DataFrame(columns=df.columns)
            
        if df.empty:
            return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # 3. Geographical Filtering
    temp_df_for_geo_filtering = df.copy() # Use a copy to avoid SettingWithCopyWarning
    
    # Use 'PROVINCE' if it exists, otherwise fall back to 'SALES_REGION'.
    province_col_actual = 'PROVINCE' if 'PROVINCE' in temp_df_for_geo_filtering.columns else 'SALES_REGION'
    if filters.salesRegion and filters.salesRegion != 'all' and province_col_actual in temp_df_for_geo_filtering.columns:
        # Create a temporary column for case-insensitive matching.
        temp_df_for_geo_filtering[f"{province_col_actual}_LOWER_UNDERSCORE"] = temp_df_for_geo_filtering[province_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
        temp_df_for_geo_filtering = temp_df_for_geo_filtering[temp_df_for_geo_filtering[f"{province_col_actual}_LOWER_UNDERSCORE"] == filters.salesRegion.lower()]

    # Similar fallback and case-insensitive matching for District.
    district_col_actual = 'DISTRICT' if 'DISTRICT' in temp_df_for_geo_filtering.columns else 'SALES_DISTRICT'
    if filters.salesDistrict and filters.salesDistrict != 'all' and district_col_actual in temp_df_for_geo_filtering.columns:
        temp_df_for_geo_filtering[f"{district_col_actual}_LOWER_UNDERSCORE"] = temp_df_for_geo_filtering[district_col_actual].astype(str).str.lower().str.replace(' ', '_', regex=False)
        temp_df_for_geo_filtering = temp_df_for_geo_filtering[temp_df_for_geo_filtering[f"{district_col_actual}_LOWER_UNDERSCORE"] == filters.salesDistrict.lower()]
    
    # Filtering for DS Division.
    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in temp_df_for_geo_filtering.columns:
        temp_df_for_geo_filtering["DS_DIVISION_LOWER_UNDERSCORE"] = temp_df_for_geo_filtering['DS_DIVISION'].astype(str).str.lower().str.replace(' ', '_', regex=False)
        temp_df_for_geo_filtering = temp_df_for_geo_filtering[temp_df_for_geo_filtering["DS_DIVISION_LOWER_UNDERSCORE"] == filters.dsDivision.lower()]
    
    df = temp_df_for_geo_filtering
    
    if df.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # --- Data Processing and Transformation ---
    # Convert the filtered DataFrame rows into a list of Pydantic models.
    board_data_list: List[BoardData] = []
    for rowIndex, row_series in df.iterrows():
        row = row_series.to_dict()
        
        # Logic to determine the primary provider and board type for this specific entry.
        # This is for display purposes on the frontend.
        determined_provider_for_entry = "Unknown"
        determined_board_type_for_entry = "N/A"
        highest_count_for_entry = 0

        if provider_name_filter:
            # If filtering by a provider, that is the determined provider.
            determined_provider_for_entry = provider_name_filter
            # If also filtering by a board type, that is the determined board type.
            if board_type_filter != 'all':
                determined_board_type_for_entry = board_type_filter
            else:
                # Otherwise, find the first board type with a count > 0 for that provider.
                for bt_val_iter_entry, _, suffix_iter_entry in [('dealer', 'Dealer Board', '_NAME_BOARD'), ('tin', 'Tin Plate', '_TIN_BOARD'), ('vertical', 'Vertical Board', '_SIDE_BOARD')]:
                    col_name_iter_entry = f"{determined_provider_for_entry.upper()}{suffix_iter_entry}"
                    current_val_board_type_check = safe_int_convert(row.get(col_name_iter_entry), 0)
                    if current_val_board_type_check > 0:
                        determined_board_type_for_entry = bt_val_iter_entry
                        break
        else: 
            # If no provider filter, find the provider with the highest board count for this row.
            for p_cfg_iter_entry in PROVIDERS_CONFIG_SIMPLE_BOARDS:
                if p_cfg_iter_entry['name'] == 'All': continue
                p_key_iter_entry = p_cfg_iter_entry['name'].upper()
                for bt_val_iter_entry, _, suffix_iter_entry in [('dealer', 'Dealer Board', '_NAME_BOARD'), ('tin', 'Tin Plate', '_TIN_BOARD'), ('vertical', 'Vertical Board', '_SIDE_BOARD')]:
                    if board_type_filter != 'all' and bt_val_iter_entry != board_type_filter:
                        continue
                    col_name_iter_entry = f"{p_key_iter_entry}{suffix_iter_entry}"
                    current_val_entry = safe_int_convert(row.get(col_name_iter_entry), 0)
                    if current_val_entry > 0:
                        if current_val_entry > highest_count_for_entry:
                            highest_count_for_entry = current_val_entry
                            determined_provider_for_entry = p_cfg_iter_entry['name']
                            determined_board_type_for_entry = bt_val_iter_entry
                        elif determined_provider_for_entry == "Unknown":
                             # Fallback to the first one found if none have a higher count
                            determined_provider_for_entry = p_cfg_iter_entry['name']
                            determined_board_type_for_entry = bt_val_iter_entry
        
        # Logic to find the correct image ARN (Amazon Resource Name) for the detected board.
        original_id = safe_str_convert(row.get('S3_ARN'))
        detected_id = None
        inf_s3_arn_col_map = {
            "dealer": "_NAME_BOARD_INF_S3_ARN", "tin": "_TIN_BOARD_INF_S3_ARN", "vertical": "_SIDE_BOARD_INF_S3_ARN"
        }
        if determined_provider_for_entry != "Unknown" and determined_board_type_for_entry in inf_s3_arn_col_map:
            inf_col_suffix = inf_s3_arn_col_map[determined_board_type_for_entry]
            detected_id_col_specific = f'{determined_provider_for_entry.upper()}{inf_col_suffix}'
            detected_id_col_generic_key = inf_col_suffix.lstrip('_')
            
            # Prefer the specific ARN column (e.g., DIALOG_NAME_BOARD_INF_S3_ARN) but fall back to a generic one if needed.
            if detected_id_col_specific in row and pd.notna(row.get(detected_id_col_specific)):
                detected_id = safe_str_convert(row.get(detected_id_col_specific))
            elif detected_id_col_generic_key in row and pd.notna(row.get(detected_id_col_generic_key)):
                detected_id = safe_str_convert(row.get(detected_id_col_generic_key))

        # Create a Pydantic model instance for the current row. This validates the data types.
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
    
    # --- Metric Calculation ---
    # Calculate the total board counts for each provider based on the filtered data.
    provider_metrics_list_updated: List[ProviderMetric] = []
    if not df.empty:
        for p_config_metric in PROVIDERS_CONFIG_SIMPLE_BOARDS:
            p_name_metric = p_config_metric['name']
            if p_name_metric == 'All': continue
            
            total_boards_for_provider = 0
            p_prefix_metric = p_name_metric.upper()
            
            # Determine which board types to include in the sum based on the filter.
            suffixes_to_sum_metrics = []
            if board_type_filter == 'all':
                suffixes_to_sum_metrics = ['_NAME_BOARD', '_SIDE_BOARD', '_TIN_BOARD']
            elif board_type_filter == 'dealer':
                suffixes_to_sum_metrics = ['_NAME_BOARD']
            elif board_type_filter == 'tin':
                suffixes_to_sum_metrics = ['_TIN_BOARD']
            elif board_type_filter == 'vertical':
                suffixes_to_sum_metrics = ['_SIDE_BOARD']

            # Sum the counts from the relevant columns.
            for suffix_metric in suffixes_to_sum_metrics:
                col_metric = f"{p_prefix_metric}{suffix_metric}"
                if col_metric in df.columns:
                    total_boards_for_provider += pd.to_numeric(df[col_metric], errors='coerce').fillna(0).sum()
            
            provider_metrics_list_updated.append(ProviderMetric(provider=p_name_metric, count=int(total_boards_for_provider)))
    
    # --- Final Response Construction ---
    # Assemble the final response object according to the FetchBoardsResponse model.
    return FetchBoardsResponse(
        data=board_data_list,
        count=len(board_data_list),
        providerMetrics=provider_metrics_list_updated
    )