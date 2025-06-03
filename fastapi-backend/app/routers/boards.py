from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import pandas as pd

from app.models import FetchBoardsResponse, BoardFiltersState, ProviderMetric, BoardData
from app.dependencies import get_boards_df
from app.data_loader import filter_by_max_capture_phase

router = APIRouter()

# Constants from your constants.ts (simplified)
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


@router.get("/boards", response_model=FetchBoardsResponse)
async def fetch_boards_api(
    filters: BoardFiltersState = Depends(), # FastAPI will populate this from query params
    board_df_raw: pd.DataFrame = Depends(get_boards_df)
):
    if board_df_raw.empty:
        return FetchBoardsResponse(data=[], count=0, providerMetrics=[])

    # Apply max capture phase filter first
    df = filter_by_max_capture_phase(board_df_raw, "board_data")

    # Apply filters from BoardFiltersState
    if filters.boardType and filters.boardType != 'all':
        # This depends on how board types are stored.
        # Assuming board.csv has columns like DIALOG_NAME_BOARD, MOBITEL_NAME_BOARD etc.
        # and we need to check if any of these are > 0 for a given type and provider.
        # The logic from host (4).py is more complex here.
        # For simplicity, we'll assume a 'BOARD_TYPE_CATEGORY' column exists or can be derived.
        # This part needs careful mapping from your Streamlit logic.
        # Example: if boardType is 'dealer', filter where relevant dealer board columns are present.
        # Let's assume for now the CSVs are pre-filtered or this is handled by provider filter.
        pass # Placeholder for complex board type filtering

    if filters.provider and filters.provider != 'all':
        provider_name_filter = get_provider_name_from_value(filters.provider)
        if provider_name_filter:
            # Check for columns like DIALOG_NAME_BOARD, DIALOG_TIN_BOARD etc.
            # This requires knowing which columns correspond to which provider and board type.
            # Example for 'Dealer Board' and 'Dialog'
            if filters.boardType == 'dealer' and 'DIALOG_NAME_BOARD' in df.columns:
                 df = df[df['DIALOG_NAME_BOARD'] > 0]
            elif filters.boardType == 'tin' and 'DIALOG_TIN_BOARD' in df.columns:
                 df = df[df['DIALOG_TIN_BOARD'] > 0]
            elif filters.boardType == 'vertical' and 'DIALOG_SIDE_BOARD' in df.columns: # Assuming 'vertical' maps to 'SIDE_BOARD'
                 df = df[df['DIALOG_SIDE_BOARD'] > 0]
            # Add similar logic for Mobitel, Hutch, Airtel based on boardType
            # This is a simplified interpretation. The Streamlit code is more dynamic.

    if filters.salesRegion and filters.salesRegion != 'all' and 'PROVINCE' in df.columns:
         df = df[df['PROVINCE'].str.lower() == filters.salesRegion.lower()]
    
    if filters.salesDistrict and filters.salesDistrict != 'all' and 'DISTRICT' in df.columns:
         df = df[df['DISTRICT'].str.lower() == filters.salesDistrict.lower()]

    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in df.columns:
         df = df[df['DS_DIVISION'].str.lower() == filters.dsDivision.lower()]

    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]

    # Prepare BoardData list
    board_data_list: List[BoardData] = []
    for _, row in df.iterrows():
        # Determine provider and boardType for this row (can be complex)
        # This mock assumes you can derive a single provider and boardType per row.
        # Your CSV has multiple provider columns per board type.
        # For now, let's take the first found provider.
        # This part needs significant refinement to match your data structure accurately.
        
        provider_for_row = "Unknown"
        board_type_for_row = filters.boardType or "Unknown"

        # Simplified logic to pick a provider based on non-zero columns
        # (This needs to align with how `api.ts` expects the `provider` field in `BoardData`)
        if row.get('DIALOG_NAME_BOARD', 0) > 0 or row.get('DIALOG_TIN_BOARD', 0) > 0 or row.get('DIALOG_SIDE_BOARD', 0) > 0:
            provider_for_row = "Dialog"
        elif row.get('MOBITEL_NAME_BOARD', 0) > 0     # ... and so on for other providers:

        board_data_list.append(BoardData(
            id=str(row.get('IMAGE_REF_ID', _)), # Assuming IMAGE_REF_ID is unique for a board instance
            retailerId=str(row['PROFILE_ID']),
            boardType=board_type_for_row, # This needs accurate determination
            provider=provider_for_row    # This needs accurate determination
        ))
    
    # Calculate ProviderMetrics
    # This also depends on how you define a "board" for a provider.
    # Let's count based on the main provider columns for the selected boardType.
    provider_metrics_dict: Dict[str, int] = {p['name']: 0 for p in PROVIDERS_CONFIG_SIMPLE if p['name'] != 'All'}

    if filters.boardType == 'dealer':
        for p_config in PROVIDERS_CONFIG_SIMPLE:
            if p_config['name'] != 'All' and f"{p_config['name'].upper()}_NAME_BOARD" in df.columns:
                provider_metrics_dict[p_config['name']] = int(df[df[f"{p_config['name'].upper()}_NAME_BOARD"] > 0].shape[0])
    # Add similar for 'tin' and 'vertical'
    elif filters.boardType == 'tin':
         for p_config in PROVIDERS_CONFIG_SIMPLE:
            if p_config['name'] != 'All' and f"{p_config['name'].upper()}_TIN_BOARD" in df.columns:
                provider_metrics_dict[p_config['name']] = int(df[df[f"{p_config['name'].upper()}_TIN_BOARD"] > 0].shape[0])
    elif filters.boardType == 'vertical': # Assuming vertical means side_board
         for p_config in PROVIDERS_CONFIG_SIMPLE:
            if p_config['name'] != 'All' and f"{p_config['name'].upper()}_SIDE_BOARD" in df.columns:
                provider_metrics_dict[p_config['name']] = int(df[df[f"{p_config['name'].upper()}_SIDE_BOARD"] > 0].shape[0])


    provider_metrics_list = [
        ProviderMetric(provider=p_name, count=p_count)
        for p_name, p_count in provider_metrics_dict.items()
    ]

    return FetchBoardsResponse(
        data=board_data_list,
        count=len(board_data_list), # Or df.shape[0] if rows directly map to boards
        providerMetrics=provider_metrics_list
    )