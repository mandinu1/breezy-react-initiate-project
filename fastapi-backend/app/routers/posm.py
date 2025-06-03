from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
import pandas as pd
import random # For mock data

from app.models import (
    FetchPosmGeneralResponse, PosmGeneralFiltersState, PosmData, ProviderMetric,
    PosmComparisonData, PosmBatchDetails, PosmBatchShare, FilterOption
)
from app.dependencies import get_posm_df
from app.data_loader import filter_by_max_capture_phase
from app.s3_utils import generate_presigned_url


router = APIRouter()

# Simplified from constants.ts
PROVIDERS_CONFIG_API = [
    {"value": "all", "label": "All Providers", "name": "All", "key": "all", "color": "#718096"},
    {"value": "dialog", "label": "Dialog", "name": "Dialog", "key": "dialog", "color": "#bb1118", "logoUrl": "/assets/provider-logos/Dialog.png"},
    {"value": "mobitel", "label": "Mobitel", "name": "Mobitel", "key": "mobitel", "color": "#53ba4e", "logoUrl": "/assets/provider-logos/mobitel.jpg"},
    {"value": "airtel", "label": "Airtel", "name": "Airtel", "key": "airtel", "color": "#ed1b25", "logoUrl": "/assets/provider-logos/airtel.png"},
    {"value": "hutch", "label": "Hutch", "name": "Hutch", "key": "hutch", "color": "#ff6b08", "logoUrl": "/assets/provider-logos/hutch.png"},
]

def get_provider_name_map():
    return {p["value"]: p["name"] for p in PROVIDERS_CONFIG_API}

@router.get("/posm/general", response_model=FetchPosmGeneralResponse)
async def fetch_posm_general_api(
    filters: PosmGeneralFiltersState = Depends(),
    posm_df_raw: pd.DataFrame = Depends(get_posm_df)
):
    if posm_df_raw.empty:
        return FetchPosmGeneralResponse(data=[], count=0, providerMetrics=[])

    df = filter_by_max_capture_phase(posm_df_raw, "posm_data")
    
    provider_name_map = get_provider_name_map()

    if filters.provider and filters.provider != 'all':
        provider_name_filter = provider_name_map.get(filters.provider)
        if provider_name_filter:
            # POSM data has DIALOG_AREA_PERCENTAGE, etc.
            # Need to infer a single 'provider' column or filter based on which percentage > 0
            # This logic is simplified. The Streamlit app might have more nuanced logic.
            # Assuming we filter rows where the selected provider has > 0 presence.
            if f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in df.columns:
                df = df[df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"] > 0]
    
    if filters.province and filters.province != 'all' and 'PROVINCE' in df.columns:
        df = df[df['PROVINCE'].str.lower() == filters.province.lower()]
    if filters.district and filters.district != 'all' and 'DISTRICT' in df.columns:
        df = df[df['DISTRICT'].str.lower() == filters.district.lower()]
    if filters.dsDivision and filters.dsDivision != 'all' and 'DS_DIVISION' in df.columns:
        df = df[df['DS_DIVISION'].str.lower() == filters.dsDivision.lower()]
    if filters.retailerId and filters.retailerId != 'all' and 'PROFILE_ID' in df.columns:
        df = df[df['PROFILE_ID'].astype(str) == filters.retailerId]

    # Visibility Range and POSM Status filtering
    # This is complex because status (increase/decrease) depends on comparison with other providers' shares
    # And visibility range applies to a specific provider's share.
    # Simplified: If a provider is selected, filter by its visibility range. Status is harder to mock simply.
    if filters.provider and filters.provider != 'all' and filters.visibilityRange:
        provider_name_filter = provider_name_map.get(filters.provider)
        if provider_name_filter and f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in df.columns:
            min_vis, max_vis = filters.visibilityRange
            df = df[
                (df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"] >= min_vis) &
                (df[f"{provider_name_filter.upper()}_AREA_PERCENTAGE"] <= max_vis)
            ]

    posm_data_list: List[PosmData] = []
    for _, row in df.iterrows():
        # Determine primary provider and its visibility for this row (simplified)
        main_provider = "Unknown"
        visibility_perc = 0.0
        
        max_share = 0
        for p_config in PROVIDERS_CONFIG_API:
            if p_config['name'] != "All":
                col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
                if col_name in row and pd.notna(row[col_name]) and row[col_name] > max_share:
                    max_share = row[col_name]
                    main_provider = p_config['name']
                    visibility_perc = float(row[col_name])
        
        if main_provider == "Unknown" and filters.provider and filters.provider != 'all':
            # If a specific provider was filtered, but no share found, use that provider with 0%
            # Or based on the frontend's expectation, this row might be excluded.
            provider_name_filter = provider_name_map.get(filters.provider)
            if provider_name_filter and f"{provider_name_filter.upper()}_AREA_PERCENTAGE" in row:
                 main_provider = provider_name_filter
                 visibility_perc = float(row.get(f"{provider_name_filter.upper()}_AREA_PERCENTAGE", 0.0))


        posm_data_list.append(PosmData(
            id=str(row.get('IMAGE_REF_ID', _)),
            retailerId=str(row['PROFILE_ID']),
            provider=main_provider, # Needs better logic
            visibilityPercentage=visibility_perc # Needs better logic
        ))

    # Provider Metrics (Average Visibility Percentage)
    provider_metrics_list: List[ProviderMetric] = []
    for p_config in PROVIDERS_CONFIG_API:
        if p_config['name'] == "All":
            continue
        col_name = f"{p_config['name'].upper()}_AREA_PERCENTAGE"
        if col_name in df.columns:
            valid_percentages = df[pd.notna(df[col_name]) & (df[col_name] > 0)][col_name]
            avg_perc = valid_percentages.mean() if not valid_percentages.empty else 0.0
            provider_metrics_list.append(ProviderMetric(
                provider=p_config['name'],
                percentage=round(float(avg_perc), 1),
                logoUrl=p_config.get('logoUrl')
            ))
            
    return FetchPosmGeneralResponse(
        data=posm_data_list,
        count=len(posm_data_list), # Or df.shape[0]
        providerMetrics=provider_metrics_list
    )


def mock_random_provider_shares() -> List[PosmBatchShare]:
    actual_providers = [p for p in PROVIDERS_CONFIG_API if p["key"] != "all"]
    num_providers_to_select = random.randint(1, min(len(actual_providers), 4))
    selected_providers = random.sample(actual_providers, num_providers_to_select)
    
    shares = [random.random() for _ in selected_providers]
    total_share = sum(shares)
    normalized_shares = [round((s / total_share) * 100, 1) for s in shares]

    # Adjust to make sum exactly 100
    sum_normalized = sum(normalized_shares)
    if sum_normalized != 100.0 and normalized_shares:
        normalized_shares[0] += round(100.0 - sum_normalized, 1)
        
    return [
        PosmBatchShare(provider=sp["name"], percentage=ns)
        for sp, ns in zip(selected_providers, normalized_shares) if ns > 0
    ]

@router.get("/posm/comparison", response_model=PosmComparisonData)
async def fetch_posm_comparison_data_api(
    profileId: str, batch1Id: str, batch2Id: str,
    # posm_df_all_phases: pd.DataFrame = Depends(get_posm_df) # Need all phases for comparison
):
    # This endpoint requires data from different capture phases (batches).
    # The current data_loader only provides max capture phase.
    # This needs access to the original DataFrame before max_capture_phase filtering.
    # For now, we will mock the response heavily.
    
    mock_capture_phases_display = ["2023 Q1", "2023 Q2", "2023 Q3", "2023 Q4", "2024 Q1"]

    batch1_shares = mock_random_provider_shares()
    batch2_shares = mock_random_provider_shares()
    
    # Use S3_ARN from posm_df if available for a real image, otherwise picsum
    # This part also needs the full `posm_df_raw` to query specific batches/profileId
    # For mock:
    img_base_url = f"https://picsum.photos/seed/{profileId}"
    batch1_image = f"{img_base_url}_{batch1Id}/300/200"
    batch2_image = f"{img_base_url}_{batch2Id}/300/200"


    differences: List[Dict[str, Any]] = []
    all_providers_in_comparison = set(s.provider for s in batch1_shares) | set(s.provider for s in batch2_shares)

    for provider_name in all_providers_in_comparison:
        b1_share = next((s.percentage for s in batch1_shares if s.provider == provider_name), 0.0)
        b2_share = next((s.percentage for s in batch2_shares if s.provider == provider_name), 0.0)
        differences.append({"provider": provider_name, "diff": round(b2_share - b1_share, 1)})

    return PosmComparisonData(
        batch1=PosmBatchDetails(image=batch1_image, shares=batch1_shares),
        batch2=PosmBatchDetails(
            image=batch2_image, 
            shares=batch2_shares,
            maxCapturePhase=random.choice(mock_capture_phases_display) # This should be specific to batch2Id
        ),
        differences=differences
    )


@router.get("/posm/available-batches/{profile_id}", response_model=List[FilterOption])
async def fetch_available_batches_api(profile_id: str, posm_df_all_phases: pd.DataFrame = Depends(get_posm_df)):
    if posm_df_all_phases.empty or 'PROFILE_ID' not in posm_df_all_phases.columns or 'CAPTURE_PHASE' not in posm_df_all_phases.columns:
        return []

    profile_data = posm_df_all_phases[posm_df_all_phases['PROFILE_ID'].astype(str) == profile_id]
    if profile_data.empty:
        return []

    # Mocking batch labels based on capture phase number.
    # In a real scenario, you'd map CAPTURE_PHASE to meaningful batch names/dates.
    # The streamlit app has a more sophisticated batch_mapping based on RECEIVED_DATE.
    # We'll simplify here.
    
    unique_capture_phases = sorted(profile_data['CAPTURE_PHASE'].dropna().unique())
    
    # Simulating the frontend's example batch options
    base_batches = [
        {"value": 'batch1_2023_q1', "label": '2023 Q1', "phase_num": 1},
        {"value": 'batch2_2023_q2', "label": '2023 Q2', "phase_num": 2},
        {"value": 'batch3_2023_q3', "label": '2023 Q3', "phase_num": 3},
        {"value": 'batch4_2023_q4', "label": '2023 Q4', "phase_num": 4},
        {"value": 'batch5_2024_q1', "label": '2024 Q1', "phase_num": 5},
    ]
    
    available_options: List[FilterOption] = []
    for cp in unique_capture_phases:
        # Find a matching base_batch by phase_num (assuming CAPTURE_PHASE maps to an order)
        # This is a rough mapping.
        matched_batch = next((b for b in base_batches if b["phase_num"] == cp), None)
        if matched_batch:
            available_options.append(FilterOption(value=matched_batch["value"], label=matched_batch["label"]))
        else:
            # Fallback if no direct match
            available_options.append(FilterOption(value=f"batch_cp_{int(cp)}", label=f"Capture Phase {int(cp)}"))
            
    # Mimic the random slicing from api.ts for variety, if desired
    # profile_hash = sum(ord(c) for c in profile_id)
    # start_index = profile_hash % 2
    # num_to_take = 3 + (profile_hash % 3)
    # return available_options[start_index : start_index + num_to_take]
    return available_options