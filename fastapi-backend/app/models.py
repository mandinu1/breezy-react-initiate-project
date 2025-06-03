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
    id: str
    retailerId: str
    boardType: str
    provider: str

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
    salesRegion: Optional[str] = None # province
    salesDistrict: Optional[str] = None # district
    dsDivision: Optional[str] = None
    retailerId: Optional[str] = None

class PosmData(BaseModel):
    id: str
    retailerId: str
    provider: str
    visibilityPercentage: float

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
    ISO_1: Optional[str] = None # Example property from api.ts mock

class GeoJsonGeometry(BaseModel):
    type: str
    coordinates: Any

class GeoJsonFeature(BaseModel):
    type: str = "Feature"
    properties: Dict[str, Any] # Keeping it flexible based on api.ts mock
    geometry: GeoJsonGeometry

class GeoJsonCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJsonFeature]

class ImageInfo(BaseModel):
    id: str
    url: str
    type: str # 'original' | 'detected'

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
    differences: List[Dict[str, Any]] # provider: str, diff: float