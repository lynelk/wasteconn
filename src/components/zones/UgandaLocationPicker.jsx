import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const NONE = '__none__';

function LevelSelect({ label, value, options, onChange, loading, disabled, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Select value={value || NONE} onValueChange={v => onChange(v === NONE ? '' : v)} disabled={disabled || loading}>
        <SelectTrigger className="w-full">
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading...
            </span>
          ) : (
            <SelectValue placeholder={placeholder || `Select ${label}`} />
          )}
        </SelectTrigger>
        <SelectContent className="max-h-60 overflow-y-auto">
          <SelectItem value={NONE}>— None —</SelectItem>
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * UgandaLocationPicker
 * Props:
 *   value: { region, district, county, subcounty, parish, village }
 *   onChange: (newValue) => void
 *   levels: array of levels to show. Default: ['region','district','county','subcounty','parish','village']
 *   required: which fields are required (for label styling)
 */
export default function UgandaLocationPicker({ value = {}, onChange, levels, required = [] }) {
  const showLevels = levels || ['region', 'district', 'county', 'subcounty', 'parish', 'village'];

  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [counties, setCounties] = useState([]);
  const [subcounties, setSubcounties] = useState([]);
  const [parishes, setParishes] = useState([]);
  const [villages, setVillages] = useState([]);

  const [loadingLevel, setLoadingLevel] = useState(null);

  const callApi = async (level, params = {}) => {
    setLoadingLevel(level);
    try {
      const res = await base44.functions.invoke('getAdminUnits', { level, ...params });
      return res.data?.options || [];
    } catch (e) {
      console.error('Admin units fetch error:', e);
      return [];
    } finally {
      setLoadingLevel(null);
    }
  };

  // Load regions on mount
  useEffect(() => {
    if (showLevels.includes('region')) {
      callApi('regions').then(setRegions);
    }
  }, []);

  // Load districts when region changes
  useEffect(() => {
    if (!showLevels.includes('district')) return;
    if (!value.region) { setDistricts([]); return; }
    callApi('districts', { region: value.region }).then(setDistricts);
  }, [value.region]);

  // Load counties when district changes
  useEffect(() => {
    if (!showLevels.includes('county')) return;
    if (!value.district) { setCounties([]); return; }
    callApi('counties', { region: value.region, district: value.district }).then(setCounties);
  }, [value.district]);

  // Load subcounties when county changes
  useEffect(() => {
    if (!showLevels.includes('subcounty')) return;
    if (!value.county) { setSubcounties([]); return; }
    callApi('subcounties', { region: value.region, district: value.district, county: value.county }).then(setSubcounties);
  }, [value.county]);

  // Load parishes when subcounty changes
  useEffect(() => {
    if (!showLevels.includes('parish')) return;
    if (!value.subcounty) { setParishes([]); return; }
    callApi('parishes', { region: value.region, district: value.district, county: value.county, subcounty: value.subcounty }).then(setParishes);
  }, [value.subcounty]);

  // Load villages when parish changes
  useEffect(() => {
    if (!showLevels.includes('village')) return;
    if (!value.parish) { setVillages([]); return; }
    callApi('villages', { region: value.region, district: value.district, county: value.county, subcounty: value.subcounty, parish: value.parish }).then(setVillages);
  }, [value.parish]);

  const update = (field, val) => {
    // Reset all downstream fields when a parent changes
    const hierarchy = ['region', 'district', 'county', 'subcounty', 'parish', 'village'];
    const idx = hierarchy.indexOf(field);
    const reset = {};
    hierarchy.slice(idx + 1).forEach(f => { reset[f] = ''; });
    onChange({ ...value, ...reset, [field]: val });
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {showLevels.includes('region') && (
        <LevelSelect
          label={`Region${required.includes('region') ? ' *' : ''}`}
          value={value.region}
          options={regions}
          onChange={v => update('region', v)}
          loading={loadingLevel === 'regions'}
          placeholder="Select region"
        />
      )}
      {showLevels.includes('district') && (
        <LevelSelect
          label={`District${required.includes('district') ? ' *' : ''}`}
          value={value.district}
          options={districts}
          onChange={v => update('district', v)}
          loading={loadingLevel === 'districts'}
          disabled={!value.region}
          placeholder={value.region ? 'Select district' : 'Select region first'}
        />
      )}
      {showLevels.includes('county') && (
        <LevelSelect
          label="County / Constituency"
          value={value.county}
          options={counties}
          onChange={v => update('county', v)}
          loading={loadingLevel === 'counties'}
          disabled={!value.district}
          placeholder={value.district ? 'Select county' : 'Select district first'}
        />
      )}
      {showLevels.includes('subcounty') && (
        <LevelSelect
          label="Sub-county / Division"
          value={value.subcounty}
          options={subcounties}
          onChange={v => update('subcounty', v)}
          loading={loadingLevel === 'subcounties'}
          disabled={!value.county}
          placeholder={value.county ? 'Select sub-county' : 'Select county first'}
        />
      )}
      {showLevels.includes('parish') && (
        <LevelSelect
          label="Parish / Ward"
          value={value.parish}
          options={parishes}
          onChange={v => update('parish', v)}
          loading={loadingLevel === 'parishes'}
          disabled={!value.subcounty}
          placeholder={value.subcounty ? 'Select parish' : 'Select sub-county first'}
        />
      )}
      {showLevels.includes('village') && (
        <LevelSelect
          label="Village / Cell / Zone"
          value={value.village}
          options={villages}
          onChange={v => update('village', v)}
          loading={loadingLevel === 'villages'}
          disabled={!value.parish}
          placeholder={value.parish ? 'Select village' : 'Select parish first'}
        />
      )}
    </div>
  );
}