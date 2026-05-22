type AddressDetails = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  path?: string;
  residential?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  country?: string;
};

export type ReverseGeocodeResult = {
  address?: AddressDetails;
  display_name?: string;
};

export function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export function formatLocationFromAddress(address?: AddressDetails) {
  if (!address) return '';

  const street =
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.cycleway ||
    address.path ||
    address.residential;
  const city = address.city || address.town || address.village || address.municipality;
  const region = address.state || address.region || address.county;

  if (street && city) return `${street}, ${city}`;
  if (street) return street;
  if (city) return city;
  if (region && address.country) return `${region}, ${address.country}`;
  if (region) return region;
  if (address.country) return address.country;

  return '';
}

export function getSpotLocationLabel(spot: {
  latitude: number;
  longitude: number;
  locationName?: string;
}) {
  return spot.locationName?.trim() || formatCoordinates(spot.latitude, spot.longitude);
}
