import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';

interface WeatherData {
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  wind_speed?: number;
  condition?: string;
  forecast?: Array<{ date: string; condition: string; high: number; low: number; rainfall: number }>;
}

interface CommodityPrice {
  commodity: string;
  price: number;
  unit: string;
  change_pct?: number;
  market?: string;
  updated_at?: string;
}

const CROPS = ['maize', 'rice', 'sorghum', 'wheat', 'cassava', 'yam', 'groundnut', 'soybean', 'cotton', 'cocoa'];

const WeatherScreen: React.FC = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState('Kano');
  const [searchInput, setSearchInput] = useState('Kano');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherRisk, setWeatherRisk] = useState<Record<string, unknown> | null>(null);
  const [commodityPrices, setCommodityPrices] = useState<CommodityPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'weather' | 'prices'>('weather');

  useEffect(() => {
    fetchWeather();
    fetchCommodityPrices();
  }, []);

  const fetchWeather = async () => {
    setLoading(true);
    setError('');
    try {
      const [weatherData, riskData] = await Promise.all([
        agricultureService.getWeatherForecast(location),
        agricultureService.getWeatherRisk(location),
      ]);
      setWeather(weatherData as WeatherData);
      setWeatherRisk(riskData);
    } catch {
      setError('Failed to load weather data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommodityPrices = async () => {
    setPricesLoading(true);
    try {
      const prices = await agricultureService.getCommodityPrices();
      if (prices.length > 0) {
        setCommodityPrices(prices as unknown as CommodityPrice[]);
      } else {
        const specific = await Promise.all(
          CROPS.slice(0, 6).map((crop) =>
            agricultureService.getCommodityPriceByType(crop).then((data) => ({
              commodity: crop,
              price: Number(data.price || data.current_price || 0),
              unit: String(data.unit || 'per MT'),
              change_pct: Number(data.change_pct || data.change_percentage || 0),
              market: String(data.market || 'National'),
              updated_at: String(data.updated_at || new Date().toISOString()),
            })).catch(() => null)
          )
        );
        setCommodityPrices(specific.filter(Boolean) as CommodityPrice[]);
      }
    } catch {
      // silently fail
    } finally {
      setPricesLoading(false);
    }
  };

  const handleSearch = () => {
    setLocation(searchInput);
    setTimeout(fetchWeather, 0);
  };

  const getConditionEmoji = (condition?: string) => {
    const c = condition?.toLowerCase() || '';
    if (c.includes('rain') || c.includes('shower')) return '🌧️';
    if (c.includes('storm') || c.includes('thunder')) return '⛈️';
    if (c.includes('cloud')) return '⛅';
    if (c.includes('sun') || c.includes('clear') || c.includes('fair')) return '☀️';
    if (c.includes('haze') || c.includes('fog')) return '🌫️';
    return '🌤️';
  };

  const getRiskColor = (level?: string) => {
    const l = String(level || '').toLowerCase();
    if (l === 'high' || l === 'critical') return 'text-red-600 bg-red-50';
    if (l === 'medium' || l === 'moderate') return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const forecast = weather?.forecast || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/agriculture')} className="text-gray-500 hover:text-gray-700 mr-2">
            ←
          </button>
          <h1 className="text-xl font-bold flex-1">Weather & Prices</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('weather')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'weather' ? 'bg-white dark:bg-gray-700 text-green-700 shadow-sm' : 'text-gray-500'}`}
          >
            🌦️ Weather Advisory
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'prices' ? 'bg-white dark:bg-gray-700 text-green-700 shadow-sm' : 'text-gray-500'}`}
          >
            📊 Commodity Prices
          </button>
        </div>

        {/* Weather Tab */}
        {activeTab === 'weather' && (
          <>
            {/* Location Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <label className="block text-xs text-gray-500 mb-2 uppercase font-medium">Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter city or region..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  Search
                </button>
              </div>
            </div>

            {loading && (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
                {error}
                <button className="ml-2 underline" onClick={fetchWeather}>Retry</button>
              </div>
            )}

            {!loading && weather && (
              <>
                {/* Current Weather */}
                <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl p-6 shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-green-100 text-sm">{location}</p>
                      <p className="text-4xl font-bold">{weather.temperature != null ? `${weather.temperature}°C` : '—'}</p>
                      <p className="text-green-100 capitalize mt-1">{weather.condition || 'No data'}</p>
                    </div>
                    <span className="text-6xl">{getConditionEmoji(weather.condition)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 border-t border-green-500/50 pt-4">
                    <div className="text-center">
                      <p className="text-xs text-green-200">Humidity</p>
                      <p className="font-semibold">{weather.humidity != null ? `${weather.humidity}%` : '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-green-200">Rainfall</p>
                      <p className="font-semibold">{weather.rainfall != null ? `${weather.rainfall}mm` : '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-green-200">Wind</p>
                      <p className="font-semibold">{weather.wind_speed != null ? `${weather.wind_speed}km/h` : '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Risk Advisory */}
                {weatherRisk && Object.keys(weatherRisk).length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-3">⚠️ Risk Advisory</h3>
                    {Object.entries(weatherRisk).slice(0, 5).map(([key, val]) => (
                      <div key={key} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${getRiskColor(String(val))}`}>
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 5-Day Forecast */}
                {forecast.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-3">📅 Forecast</h3>
                    <div className="space-y-2">
                      {forecast.map((day, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-600">
                            {day.date ? new Date(day.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : `Day ${i + 1}`}
                          </span>
                          <span className="text-lg">{getConditionEmoji(day.condition)}</span>
                          <span className="text-sm text-blue-600">{day.rainfall != null ? `${day.rainfall}mm` : ''}</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white">
                            {day.high != null ? `${day.high}°` : '—'} / {day.low != null ? `${day.low}°` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!weather.condition && forecast.length === 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                    <p className="text-4xl mb-3">🌤️</p>
                    <p>Weather data unavailable for this location</p>
                  </div>
                )}
              </>
            )}

            {!loading && !weather && !error && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-4xl mb-3">🔍</p>
                <p>Search a location to see weather data</p>
              </div>
            )}
          </>
        )}

        {/* Commodity Prices Tab */}
        {activeTab === 'prices' && (
          <>
            {pricesLoading && (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
              </div>
            )}
            {!pricesLoading && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 uppercase font-medium">Market Prices</p>
                </div>
                {commodityPrices.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-4xl mb-3">📊</p>
                    <p>No commodity price data available</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {commodityPrices.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white capitalize">{item.commodity}</p>
                          <p className="text-xs text-gray-500">{item.market || 'National'} • {item.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800 dark:text-white">
                            ₦{item.price ? item.price.toLocaleString() : '—'}
                          </p>
                          {item.change_pct != null && item.change_pct !== 0 && (
                            <p className={`text-xs font-medium ${item.change_pct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.change_pct > 0 ? '▲' : '▼'} {Math.abs(item.change_pct).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WeatherScreen;
