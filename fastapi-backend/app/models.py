# fastapi-backend/app/models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Any, Dict

class FilterOption(BaseModel):
    value: str
    label: str

class Retailer(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    imageIdentifier: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None

class BoardData(BaseModel):
    # Core derived/key fields
    id: str                   # Unique ID for the board entry (e.g., from IMAGE_REF_ID)
    retailerId: str           # Corresponds to PROFILE_ID

    # Raw data fields from your data source (board.csv)
    PROFILE_ID: Optional[str] = None
    PROFILE_NAME: Optional[str] = None
    PROVINCE: Optional[str] = None
    DISTRICT: Optional[str] = None
    DS_DIVISION: Optional[str] = None
    GN_DIVISION: Optional[str] = None
    SALES_DISTRICT: Optional[str] = None
    SALES_AREA: Optional[str] = None # Ensure this column exists in your board.csv
    SALES_REGION: Optional[str] = None

    # Board type and provider determined by backend logic
    boardType: str
    provider: str

    # Board counts
    DIALOG_NAME_BOARD: Optional[int] = None
    MOBITEL_NAME_BOARD: Optional[int] = None
    HUTCH_NAME_BOARD: Optional[int] = None
    AIRTEL_NAME_BOARD: Optional[int] = None
    DIALOG_SIDE_BOARD: Optional[int] = None
    MOBITEL_SIDE_BOARD: Optional[int] = None
    HUTCH_SIDE_BOARD: Optional[int] = None
    AIRTEL_SIDE_BOARD: Optional[int] = None
    DIALOG_TIN_BOARD: Optional[int] = None
    MOBITEL_TIN_BOARD: Optional[int] = None
    HUTCH_TIN_BOARD: Optional[int] = None
    AIRTEL_TIN_BOARD: Optional[int] = None
    
    # For Dual Image Display in BoardView
    # S3_ARN from board.csv can be the original image of the *board capture*
    originalBoardImageIdentifier: Optional[str] = None 
    # This would be the specific inference ARN, e.g., NAME_BOARD_INF_S3_ARN
    detectedBoardImageIdentifier: Optional[str] = None 

class ProviderMetric(BaseModel):
    provider: str
    count: Optional[int] = None
    percentage: Optional[float] = None
    logoUrl: Optional[str] = None

class FetchBoardsResponse(BaseModel):
    data: List[BoardData]
    count: int
    providerMetrics: List[ProviderMetric]

class BoardFiltersState(BaseModel):
    boardType: Optional[str] = None
    provider: Optional[str] = None
    salesRegion: Optional[str] = None
    salesDistrict: Optional[str] = None
    dsDivision: Optional[str] = None
    retailerId: Optional[str] = None

class PosmData(BaseModel):
    # Core derived/key fields
    id: str                   # Unique ID for the POSM entry (e.g., from IMAGE_REF_ID)
    retailerId: str           # Corresponds to PROFILE_ID
    
    # Main provider & visibility for this specific POSM entry
    provider: str
    visibilityPercentage: float 

    # Raw data fields from your data source (posm.csv)
    PROFILE_NAME: Optional[str] = None
    PROVINCE: Optional[str] = None
    DISTRICT: Optional[str] = None
    # Add other relevant fields from posm.csv that you want to pass to frontend:
    # DS_DIVISION: Optional[str] = None 
    # SALES_DISTRICT: Optional[str] = None
    # SALES_REGION: Optional[str] = None

    # Provider-specific area percentages
    DIALOG_AREA_PERCENTAGE: Optional[float] = None
    AIRTEL_AREA_PERCENTAGE: Optional[float] = None
    MOBITEL_AREA_PERCENTAGE: Optional[float] = None
    HUTCH_AREA_PERCENTAGE: Optional[float] = None
    
    # For images related to this POSM entry (if needed for a POSM-specific image display)
    originalPosmImageIdentifier: Optional[str] = None # e.g., S3_ARN from posm.csv
    detectedPosmImageIdentifier: Optional[str] = None # e.g., INF_S3_ARN from posm.csv

class FetchPosmGeneralResponse(BaseModel):
    data: List[PosmData]
    count: int
    providerMetrics: List[ProviderMetric]

class PosmGeneralFiltersState(BaseModel):
    provider: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    dsDivision: Optional[str] = None
    retailerId: Optional[str] = None
    posmStatus: Optional[str] = None
    visibilityRange: Optional[Tuple[float, float]] = Field(default=(0, 100))

class GeoJsonFeatureProperties(BaseModel):
    name: str
    value: Optional[float] = None
    ISO_1: Optional[str] = None

class GeoJsonGeometry(BaseModel):
    type: str
    coordinates: Any

class GeoJsonFeature(BaseModel):
    type: str = "Feature"
    properties: Dict[str, Any]
    geometry: GeoJsonGeometry

class GeoJsonCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJsonFeature]

class ImageInfo(BaseModel):
    id: str
    url: str
    type: str # 'original' | 'detected' (or others as defined by your backend logic)

class PosmBatchShare(BaseModel):
    provider: str
    percentage: float

class PosmBatchDetails(BaseModel):
    image: str # URL
    shares: List[PosmBatchShare]
    maxCapturePhase: Optional[str] = None

class PosmComparisonData(BaseModel):
    batch1: PosmBatchDetails
    batch2: PosmBatchDetails
    differences: List[Dict[str, Any]]