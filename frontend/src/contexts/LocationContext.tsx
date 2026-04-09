import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Location {
  lat: number;
  lon: number;
  name: string;
  displayName?: string;
}

interface LocationContextType {
  selectedLocation: Location | null;
  setSelectedLocation: (location: Location) => void;
  clearLocation: () => void;
  isLocationSet: boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedLocation, setSelectedLocationState] = useState<Location | null>(null);

  // Load location from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('agromind_location');
    if (stored) {
      try {
        setSelectedLocationState(JSON.parse(stored));
      } catch (err) {
        console.error('Failed to parse stored location:', err);
      }
    }
  }, []);

  const setSelectedLocation = (location: Location) => {
    setSelectedLocationState(location);
    localStorage.setItem('agromind_location', JSON.stringify(location));
  };

  const clearLocation = () => {
    setSelectedLocationState(null);
    localStorage.removeItem('agromind_location');
  };

  return (
    <LocationContext.Provider
      value={{
        selectedLocation,
        setSelectedLocation,
        clearLocation,
        isLocationSet: !!selectedLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
}
