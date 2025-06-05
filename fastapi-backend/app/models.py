from pydantic import BaseModel, Field, field_validator
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
    id: str
    retailerId: Optional[str] = None
    PROFILE_ID: Optional[str] = None
    PROFILE_NAME: Optional[str] = None
    PROVINCE: Optional[str] = None
    DISTRICT: Optional[str] = None
    DS_DIVISION: Optional[str] = None
    GN_DIVISION: Optional[str] = None
    SALES_DISTRICT: Optional[str] = None
    SALES_AREA: Optional[str] = None
    SALES_REGION: Optional[str] = None
    boardType: Optional[str] = "N/A"
    provider: Optional[str] = "Unknown"
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
    boardType: Optional[str] = 'all'
    provider: Optional[str] = 'all'
    salesRegion: Optional[str] = 'all'
    salesDistrict: Optional[str] = 'all'
    dsDivision: Optional[str] = 'all'
    retailerId: Optional[str] = 'all'

class PosmData(BaseModel):
    id: str
    retailerId: Optional[str] = None
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
    provider: Optional[str] = "Unknown"
    visibilityPercentage: Optional[float] = Field(default=0.0)
    originalPosmImageIdentifier: Optional[str] = None
    detectedPosmImageIdentifier: Optional[str] = None

class FetchPosmGeneralResponse(BaseModel):
    data: List[PosmData]
    count: int
    providerMetrics: List[ProviderMetric]

# ** CORRECTED PosmGeneralFiltersState Model **
class PosmGeneralFiltersState(BaseModel):
    provider: Optional[str] = 'all'
    province: Optional[str] = 'all'
    district: Optional[str] = 'all'
    dsDivision: Optional[str] = 'all'
    retailerId: Optional[str] = 'all'
    posmStatus: Optional[str] = 'all'
    # Accept visibilityRange as a simple string from the query. We will parse it in the router.
    visibilityRange: Optional[str] = '0,100'


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