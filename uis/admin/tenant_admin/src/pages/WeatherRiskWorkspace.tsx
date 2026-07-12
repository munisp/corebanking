import { useState } from 'react';
import { CloudRain, Search, Wind, Droplets, Thermometer, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentWeather, useWeatherForecast, useWeatherRisk } from '../hooks/useAgriculture';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];
const CROP_OPTIONS = ['maize', 'cassava', 'rice', 'yam', 'cocoa', 'palm_oil', 'sorghum', 'millet', 'wheat', 'soybean'];

const RISK_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'default',
  medium: 'secondary',
  high: 'destructive',
  very_high: 'destructive',
};

function CurrentWeatherPanel() {
  const [stateInput, setStateInput] = useState('');
  const [lgaInput, setLgaInput] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState<string | undefined>();

  const { data, isLoading } = useCurrentWeather(state, lga);

  function handleSearch() {
    setState(stateInput.trim());
    setLga(lgaInput.trim() || undefined);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <select
            value={stateInput}
            onChange={e => setStateInput(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background w-40"
          >
            <option value="">Select state…</option>
            {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">LGA (optional)</Label>
          <Input
            placeholder="e.g. Nassarawa"
            value={lgaInput}
            onChange={e => setLgaInput(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleSearch} disabled={!stateInput}>
            <Search className="w-4 h-4 mr-1" /> Get Weather
          </Button>
        </div>
      </div>

      {!state && <p className="text-sm text-muted-foreground py-8 text-center">Select a state to view current weather conditions.</p>}
      {state && isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

      {state && !isLoading && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Thermometer className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Temperature</p>
                  <p className="text-2xl font-bold">{data.temperature}°C</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Droplets className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Humidity</p>
                  <p className="text-2xl font-bold">{data.humidity}%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <CloudRain className="w-8 h-8 text-cyan-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Rainfall</p>
                  <p className="text-2xl font-bold">{data.rainfall_mm}mm</p>
                </div>
              </CardContent>
            </Card>
            {data.wind_speed != null && (
              <Card>
                <CardContent className="pt-4 flex items-center gap-3">
                  <Wind className="w-8 h-8 text-slate-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Wind Speed</p>
                    <p className="text-2xl font-bold">{data.wind_speed} km/h</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{data.state}{data.lga ? `, ${data.lga}` : ''}</p>
                  <p className="text-muted-foreground text-sm capitalize">{data.conditions}</p>
                </div>
                <p className="text-xs text-muted-foreground">{data.timestamp}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {state && !isLoading && !data && (
        <p className="text-sm text-muted-foreground text-center py-4">No weather data available for {state}.</p>
      )}
    </div>
  );
}

function ForecastPanel() {
  const [stateInput, setStateInput] = useState('');
  const [state, setState] = useState('');

  const { data, isLoading } = useWeatherForecast(state);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <select
            value={stateInput}
            onChange={e => setStateInput(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background w-40"
          >
            <option value="">Select state…</option>
            {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => setState(stateInput)} disabled={!stateInput}>
            <Search className="w-4 h-4 mr-1" /> Get Forecast
          </Button>
        </div>
      </div>

      {!state && <p className="text-sm text-muted-foreground py-8 text-center">Select a state to view the 7-day weather forecast.</p>}
      {state && isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

      {state && !isLoading && data && data.days.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {data.days.map((d, i) => (
            <Card key={i}>
              <CardContent className="pt-3 pb-3 text-center">
                <p className="text-xs text-muted-foreground">{d.date}</p>
                <CloudRain className="w-6 h-6 mx-auto my-2 text-blue-400" />
                <p className="text-xs font-medium capitalize">{d.conditions}</p>
                <p className="text-sm font-bold mt-1">{d.temperature_min}° – {d.temperature_max}°</p>
                <p className="text-xs text-blue-600 mt-1">{d.rainfall_probability}% rain</p>
                {d.rainfall_mm != null && <p className="text-xs text-muted-foreground">{d.rainfall_mm}mm</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {state && !isLoading && (!data || data.days.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">No forecast data available for {state}.</p>
      )}
    </div>
  );
}

function LoanRiskPanel() {
  const [stateInput, setStateInput] = useState('');
  const [cropInput, setCropInput] = useState('');
  const [state, setState] = useState('');
  const [crop, setCrop] = useState('');

  const { data, isLoading } = useWeatherRisk(state, crop);

  function handleSearch() {
    setState(stateInput.trim());
    setCrop(cropInput.trim());
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">State</Label>
          <select
            value={stateInput}
            onChange={e => setStateInput(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background w-40"
          >
            <option value="">Select state…</option>
            {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Crop Type</Label>
          <select
            value={cropInput}
            onChange={e => setCropInput(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm bg-background w-40"
          >
            <option value="">Select crop…</option>
            {CROP_OPTIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleSearch} disabled={!stateInput || !cropInput}>
            <Search className="w-4 h-4 mr-1" /> Assess Risk
          </Button>
        </div>
      </div>

      {!state && <p className="text-sm text-muted-foreground py-8 text-center">Select a state and crop type to assess weather-related loan risk.</p>}
      {state && isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>}

      {state && !isLoading && data && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{data.state} — <span className="capitalize">{data.crop_type.replace(/_/g, ' ')}</span></h3>
                  <p className="text-sm text-muted-foreground mt-1">Weather-linked loan risk assessment</p>
                </div>
                <div className="text-right">
                  <Badge variant={RISK_BADGE[data.risk_level] ?? 'outline'} className="capitalize">{data.risk_level.replace(/_/g, ' ')} Risk</Badge>
                  <p className="text-2xl font-bold mt-2">{data.risk_score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                </div>
              </div>
              {data.recommendation && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-amber-800">{data.recommendation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {data.factors.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Risk Factors</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.factors.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {state && !isLoading && !data && (
        <p className="text-sm text-muted-foreground text-center py-4">No risk data available for {state} / {crop}.</p>
      )}
    </div>
  );
}

export default function WeatherRiskWorkspace() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CloudRain className="w-6 h-6 text-blue-600" />
          Weather &amp; Climate Risk
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time weather, 7-day forecast, and weather-linked loan risk assessment by state and crop type
        </p>
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current"><Thermometer className="w-4 h-4 mr-1" />Current Weather</TabsTrigger>
          <TabsTrigger value="forecast"><CloudRain className="w-4 h-4 mr-1" />7-Day Forecast</TabsTrigger>
          <TabsTrigger value="risk"><AlertTriangle className="w-4 h-4 mr-1" />Loan Risk Assessment</TabsTrigger>
        </TabsList>
        <TabsContent value="current" className="mt-4">
          <CurrentWeatherPanel />
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          <ForecastPanel />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <LoanRiskPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
