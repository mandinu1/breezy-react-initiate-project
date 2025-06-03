from fastapi import APIRouter, Depends, Query
from typing import List, Optional
import pandas as pd

from app.models import FilterOption # Assuming FilterOption is in app.models
from app.dependencies import get_boards_df, get_posm_df # Or a combined df

router = APIRouter()

def get_unique_options(df: pd.DataFrame, column_name: str, value_prefix: Optional[str] = None) -> List[FilterOption]:
    if df.empty or column_name not in df.columns:
        return []

    unique_values = df[column_name].dropna().unique()
    unique_values.sort()

    options = [
        FilterOption(
            value=f"{value_prefix}_{str(val).lower().replace(' ', '_')}" if value_prefix else str(val).lower().replace(' ', '_'), 
            label=str(val)
        ) for val in unique_values
    ]
    return [FilterOption(value="all", label=f"All {column_name.replace('_', ' ').title()}s")] + options

@router.get("/options/provinces", response_model=List[FilterOption])
async def get_province_options( # Using SALES_REGION from board/posm data as "province" for filters
    board_df: pd.DataFrame = Depends(get_boards_df) 
):
    # Decide which DataFrame is the source of truth for provinces or combine them
    # For BoardView, it might be 'SALES_REGION' or 'PROVINCE'
    # For PosmView, it might be 'PROVINCE' or 'SALES_REGION'
    # Let's assume 'PROVINCE' exists and is preferred, fallback to 'SALES_REGION' if not
    # For consistency with your frontend constants, let's try to use what's available.
    # Your board.csv has PROVINCE and SALES_REGION. posm.csv has PROVINCE and SALES_REGION.

    # We'll use 'PROVINCE' from board_df as an example. Adjust if needed.
    if 'PROVINCE' in board_df.columns:
         return get_unique_options(board_df, "PROVINCE")
    elif 'SALES_REGION' in board_df.columns: # Fallback for BoardView sales context
         return get_unique_options(board_df, "SALES_REGION")
    return [FilterOption(value="all", label="All Provinces")]


@router.get("/options/districts", response_model=List[FilterOption])
async def get_district_options(
    province: Optional[str] = Query(None), # This would be the 'value' from province FilterOption
    board_df: pd.DataFrame = Depends(get_boards_df)
):
    # Similar logic: use 'DISTRICT' or 'SALES_DISTRICT'
    # Filter board_df by province first if a province is provided
    # The 'province' query parameter here should correspond to the 'value' of the selected province option
    # e.g., 'western', 'central', etc.

    filtered_df = board_df.copy()
    province_column_to_filter = None
    if 'PROVINCE' in filtered_df.columns:
        province_column_to_filter = 'PROVINCE'
    elif 'SALES_REGION' in filtered_df.columns:
        province_column_to_filter = 'SALES_REGION'

    if province and province != "all" and province_column_to_filter:
        # The 'province' value from query needs to match how values are stored or compared
        # Assuming province values are like 'Western', 'Central'
        # We need to map the incoming 'value' (e.g. 'western') to the actual data if they differ in case/formatting
        actual_province_name = province.replace('_', ' ').title() # Example to match title case
        # A more robust way would be to fetch the label for the value, or ensure values match data

        # Find the label for the given province value to filter the dataframe accurately
        # This assumes the province value sent from frontend is the 'value' field of FilterOption (e.g. 'western')
        # and the dataframe contains 'Western'
        # This part is tricky without knowing the exact mapping.
        # For simplicity, let's assume direct match or simple transformation is enough for now.

        # Let's assume the province value passed is the one directly usable for filtering (e.g. already lowercased or matching df)
        # Or, we could fetch the corresponding label from the provinces list if we had it here.
        # To keep it simple, we'll assume a direct match attempt on a standardized column

        # Standardize before comparison:
        df_province_column = filtered_df[province_column_to_filter].astype(str).str.lower().str.replace(' ', '_')
        filtered_df = filtered_df[df_province_column == province]


    if 'DISTRICT' in filtered_df.columns:
        return get_unique_options(filtered_df, "DISTRICT")
    elif 'SALES_DISTRICT' in filtered_df.columns: # Fallback
        return get_unique_options(filtered_df, "SALES_DISTRICT")
    return [FilterOption(value="all", label="All Districts")]

# Add similar endpoints for /options/ds-divisions, /options/retailers
# For retailers, your existing /retailers endpoint is already dynamic.