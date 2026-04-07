'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

interface PlacePrediction {
  description: string;
  place_id: string;
}

interface AddressMapPickerProps {
  id: string;
  label: string;
  locale: 'zh-HK' | 'en';
  value: string;
  onChange: (value: string) => void;
  selectedLabel: string;
  onSelectedLabelChange: (value: string) => void;
}

interface GoogleMapsPlaceResult {
  formatted_address?: string;
  name?: string;
  place_id?: string;
  url?: string;
}

interface GoogleMapsPlacesService {
  getDetails(
    request: {
      placeId: string;
      fields: string[];
    },
    callback: (place: GoogleMapsPlaceResult | null, status: string) => void
  ): void;
}

interface GoogleMapsAutocompleteService {
  getPlacePredictions(
    request: {
      input: string;
      componentRestrictions?: { country: string | string[] };
    },
    callback: (predictions: PlacePrediction[] | null, status: string) => void
  ): void;
}

interface GoogleMapsNamespace {
  places: {
    AutocompleteService: new () => GoogleMapsAutocompleteService;
    PlacesService: new (container: HTMLDivElement) => GoogleMapsPlacesService;
    PlacesServiceStatus: {
      OK: string;
    };
  };
}

function getGoogleMaps() {
  return (window as Window & { google?: { maps?: GoogleMapsNamespace } }).google?.maps;
}

let googleMapsLoader: Promise<void> | null = null;

function loadGoogleMapsPlaces() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (getGoogleMaps()?.places) {
    return Promise.resolve();
  }

  if (googleMapsLoader) {
    return googleMapsLoader;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
  }

  googleMapsLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

export function AddressMapPicker({
  id,
  label,
  locale,
  value,
  onChange,
  selectedLabel,
  onSelectedLabelChange,
}: AddressMapPickerProps) {
  const [query, setQuery] = useState(selectedLabel);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteRef = useRef<GoogleMapsAutocompleteService | null>(null);
  const placesRef = useRef<GoogleMapsPlacesService | null>(null);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    let active = true;

    loadGoogleMapsPlaces()
      .then(() => {
        if (!active) return;
        const maps = getGoogleMaps();
        if (!maps || !containerRef.current) return;
        autocompleteRef.current = new maps.places.AutocompleteService();
        placesRef.current = new maps.places.PlacesService(containerRef.current);
        setApiReady(true);
        setError('');
      })
      .catch(() => {
        if (!active) return;
        setApiReady(false);
        setError(
          locale === 'zh-HK'
            ? '未設定 Google Maps API key。請加入 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY。'
            : 'Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.'
        );
      });

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!apiReady || !autocompleteRef.current) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      autocompleteRef.current?.getPlacePredictions(
        {
          input: trimmed,
          componentRestrictions: { country: 'hk' },
        },
        (results, status) => {
          const maps = getGoogleMaps();
          if (status !== maps?.places.PlacesServiceStatus.OK || !results) {
            setPredictions([]);
            return;
          }

          setPredictions(results);
        }
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [apiReady, query]);

  const selectPrediction = (prediction: PlacePrediction) => {
    if (!placesRef.current) return;

    setLoading(true);
    setError('');

    placesRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'name', 'place_id', 'url'],
      },
      (place, status) => {
        setLoading(false);
        const maps = getGoogleMaps();
        if (status !== maps?.places.PlacesServiceStatus.OK || !place) {
          setError(locale === 'zh-HK' ? '未能讀取地點資料。' : 'Could not load place details.');
          return;
        }

        const labelText = place.formatted_address || place.name || prediction.description;
        const mapUrl = place.url || (place.place_id ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}` : '');

        setQuery(labelText);
        onSelectedLabelChange(labelText);
        onChange(mapUrl);
        setPredictions([]);
      }
    );
  };

  const placeholder = locale === 'zh-HK' ? '搜尋地址或商戶地點' : 'Search for an address or business location';

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-[#3D3D3D]">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
          <MapPin size={14} />
        </div>
        <input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelectedLabelChange(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full h-9 rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3.5 text-sm text-[#111111] placeholder:text-[#D1D5DB] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
        />
        {predictions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                onClick={() => selectPrediction(prediction)}
                className="block w-full border-b border-[#F3F4F6] px-3 py-2 text-left text-sm text-[#111111] last:border-b-0 hover:bg-[#F9FAFB]"
              >
                {prediction.description}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading && (
        <p className="text-xs text-[#6B7280]">
          {locale === 'zh-HK' ? '正在載入地點資料...' : 'Loading place details...'}
        </p>
      )}
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#0F766E] hover:underline"
        >
          <span>{locale === 'zh-HK' ? '查看 Google 地圖連結' : 'Open Google Maps link'}</span>
          <ExternalLink size={12} />
        </a>
      )}
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
      <div ref={containerRef} className="hidden" />
    </div>
  );
}
