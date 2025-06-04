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
    retailerId: Optional[str] = None # Corresponds to PROFILE_ID

    # Raw data fields from your data source (board.csv)
    PROFILE_ID: Optional[str] = None
    PROFILE_NAME: Optional[str] = None
    PROVINCE: Optional[str] = None
    DISTRICT: Optional[str] = None
    DS_DIVISION: Optional[str] = None
    GN_DIVISION: Optional[str] = None
    SALES_DISTRICT: Optional[str] = None
    SALES_AREA: Optional[str] = None
    SALES_REGION: Optional[str] = None

    # Board type and provider determined by backend logic for this specific entry
    boardType: Optional[str] = "N/A" # Default if not determinable
    provider: Optional[str] = "Unknown" # Default if not determinable

    # Board counts (ensure these are numbers from your CSV or handled)
    DIALOG_NAME_BOARD: Optional[int] = Field(default=0)
    MOBITEL_NAME_BOARD: Optional[int] = Field(default=0)
    HUTCH_NAME_BOARD: Optional[int] = Field(default=0)
    AIRTEL_NAME_BOARD: Optional[int] = Field(default=0)
    DIALOG_SIDE_BOARD: Optional[int] = Field(default=0)
    MOBITEL_SIDE_BOARD: Optional[int] = Field(default=0)
    HUTCH_SIDE_BOARD: Optional[int] = Field(default=0)
    AIRTEL_SIDE_BOARD: Optional[int] = Field(default=0)
    DIALOG_TIN_BOARD: Optional[int] = Field(default=0)
    MOBITEL_TIN_BOARD: Optional[int] = Field(default=0)
    HUTCH_TIN_BOARD: Optional[int] = Field(default=0)
    AIRTEL_TIN_BOARD: Optional[int] = Field(default=0)
    
    originalBoardImageIdentifier: Optional[str] = None 
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
    id: str                   
    retailerId: Optional[str] = None        
    
    # Fields for table display as per your request
    PROFILE_NAME: Optional[str] = None
    PROVINCE: Optional[str] = None
    DISTRICT: Optional[str] = None
    DS_DIVISION: Optional[str] = None
    GN_DIVISION: Optional[str] = None
    SALES_REGION: Optional[str] = None
    SALES_DISTRICT: Optional[str] = None
    SALES_AREA: Optional[str] = None

    DIALOG_AREA_PERCENTAGE: Optional[float] = Field(default=0.0)
    AIRTEL_AREA_PERCENTAGE: Optional[float] = Field(default=0.0)
    MOBITEL_AREA_PERCENTAGE: Optional[float] = Field(default=0.0)
    HUTCH_AREA_PERCENTAGE: Optional[float] = Field(default=0.0)
    
    # These fields are no longer primary for table display but might be used by other logic (e.g., PercentageBar)
    provider: Optional[str] = "Unknown" # Main provider for the POSM entry (can be derived)
    visibilityPercentage: Optional[float] = Field(default=0.0) # Overall visibility (can be derived)

    originalPosmImageIdentifier: Optional[str] = None 
    detectedPosmImageIdentifier: Optional[str] = None 

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

# --- Other models remain the same (GeoJSON, ImageInfo, PosmBatch, etc.) ---
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
    type: str

class PosmBatchShare(BaseModel):
    provider: str
    percentage: float

class PosmBatchDetails(BaseModel):
    image: str 
    shares: List[PosmBatchShare]
    maxCapturePhase: Optional[str] = None

class PosmComparisonData(BaseModel):
    batch1: PosmBatchDetails
    batch2: PosmBatchDetails
    differences: List[Dict[str, Any]]