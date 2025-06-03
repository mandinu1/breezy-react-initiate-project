import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster'; 
import { Retailer, GeoJsonCollection } from '../../types';

// Fix for default icon issue with Webpack/React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


interface InteractiveMapProps {
  retailers: Retailer[];
  geoJsonData?: GeoJsonCollection | null; 
  center?: LatLngExpression;
  zoom?: number;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  retailers,
  geoJsonData,
  center = [6.9271, 79.8612], 
  zoom = 8,
}) => {

  const onEachFeature = (feature: any, layer: L.Layer) => {
    if (feature.properties && feature.properties.name) {
      // Popup content styling could be enhanced here for dark mode if needed via CSS classes set on the popup
      const popupContent = `<div class="map-popup-content dark:text-gray-800"> <!-- Ensure text is readable on light popup bg -->
                              <strong>${feature.properties.name}</strong><br/>Value: ${feature.properties.value?.toFixed(2) || 'N/A'}
                            </div>`;
      layer.bindPopup(popupContent);
    }
  };

  const styleGeoJson = (feature: any) => {
    const value = feature?.properties?.value || 0;
    let fillColor = '#FED976'; 
    if (value > 75) fillColor = '#BD0026';
    else if (value > 50) fillColor = '#F03B20';
    else if (value > 25) fillColor = '#FD8D3C';
    
    return {
      fillColor: fillColor,
      weight: 1,
      opacity: 1,
      color: 'white', // Border color for polygons
      dashArray: '3',
      fillOpacity: 0.7
    };
  };


  return (
    // MapContainer itself doesn't directly support dark mode via tailwind classes in the same way.
    // Its background is usually the tiles. Popups are regular HTML.
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} className="h-[400px] md:h-[500px] rounded-lg shadow-md z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        // For dark mode tiles, you might consider a different tile provider or one that supports dark styles, e.g., CartoDB dark matter:
        // url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        // attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      
      <MarkerClusterGroup chunkedLoading>
        {retailers.map(retailer => (
          <Marker key={retailer.id} position={[retailer.latitude, retailer.longitude]}>
            <Popup> 
              <div className="map-popup-content dark:text-gray-800"> {/* Ensure text is readable on light popup bg */}
                <strong>{retailer.name}</strong>
                {retailer.imageIdentifier && (
                  <img src={`https://picsum.photos/seed/${retailer.imageIdentifier}/100/75`} alt={retailer.name} className="mt-2 rounded"/>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

      {geoJsonData && (
        <GeoJSON 
            data={geoJsonData as any} 
            style={styleGeoJson}
            onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
};

export default InteractiveMap;