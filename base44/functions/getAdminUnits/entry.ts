import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Uganda administrative data - extracted from official hierarchy
// Structured as: { region: { district: { county: { subcounty: { parish: [villages] } } } } }
// Data is loaded lazily per request level to keep responses small

const FILE_URL = "https://media.base44.com/files/public/69df3818ebae6501453e9c01/1c352a2a0_UgandaAdministrativeUnitsHierarchy.xlsx";

// We parse the CSV-style data embedded from the Excel file
// The data follows: Region, District Code, District, County, Subcounty, Parish, Village

// Pre-extracted unique values per level for performance
// These are derived from the 71,230 row dataset

const REGIONS = ["Central", "Eastern", "Northern", "Western"];

const DISTRICTS_BY_REGION = {
  "Central": ["BUIKWE","BUKOMANSIMBI","BUTAMBALA","BUVUMA","GOMBA","KALANGALA","KALUNGU","KAMPALA","KAYUNGA","KIBOGA","KYANKWANZI","LUWERO","LYANTONDE","MASAKA","MITYANA","MPIGI","MUBENDE","MUKONO","NAKASEKE","NAKASONGOLA","RAKAI","SEMBABULE","WAKISO","BUNYANGABU","KAGADI","KAKUMIRO","KIBAALE","KYEGEGWA","MBARARA"],
  "Eastern": ["AMURIA","BUDAKA","BUDUDA","BUGIRI","BUGWERI","BUKEDEA","BUKWO","BULAMBULI","BUSIA","BUTEBO","BUYENDE","IGANGA","JINJA","KABERAMAIDO","KALIRO","KAMULI","KAPCHORWA","KATAKWI","KIBUKU","KUMI","KWEEN","LUUKA","MANAFWA","MAYUGE","MBALE","NAMAYINGO","NAMISINDWA","NAMUTUMBA","NGORA","PALLISA","SERERE","SIRONKO","SOROTI","TORORO","BUTEBO","NABILATUK","KAPELEBYONG","KALAKI","KWANIA"],
  "Northern": ["ABIM","ADJUMANI","AGAGO","ALEBTONG","AMOLATAR","AMUDAT","AMURU","APAC","ARUA","DOKOLO","GULU","KAABONG","KITGUM","KOBOKO","KOLE","KOTIDO","LAMWO","LIRA","MARACHA","MOROTO","MOYO","NAPAK","NEBBI","NWOYA","OTUKE","OYAM","PADER","PAKWACH","YUMBE","ZOMBO","OMORO","OBONGI","KIKUUBE","KWANIA","KAPELEBYONG"],
  "Western": ["BUHWEJU","BULIISA","BUNDIBUGYO","BUSHENYI","HOIMA","IBANDA","ISINGIRO","KABALE","KABAROLE","KAMWENGE","KANUNGU","KASESE","KIRYANDONGO","KISORO","KYEGEGWA","KYENJOJO","MASINDI","MITOOMA","NTOROKO","NTUNGAMO","RUBANDA","RUBIRIZI","RUKIGA","RUKUNGIRI","SHEEMA","KAGADI","KAKUMIRO","KIBAALE"]
};

// Full hierarchical data - we'll serve this filtered by request
// For performance, this is a representative sample structure
// The full data would be imported from the Excel file in production

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { level, region, district, county, subcounty, parish } = body;

    // Return regions
    if (!level || level === 'regions') {
      return Response.json({ options: REGIONS });
    }

    // Return districts for a region
    if (level === 'districts') {
      if (!region) return Response.json({ options: [] });
      const districts = DISTRICTS_BY_REGION[region] || [];
      return Response.json({ options: districts.sort() });
    }

    // For deeper levels, we need to parse the actual data
    // We fetch and parse only what's needed
    if (level === 'counties' || level === 'subcounties' || level === 'parishes' || level === 'villages') {
      const rows = await fetchAndParseData();
      
      if (level === 'counties') {
        if (!region || !district) return Response.json({ options: [] });
        const counties = [...new Set(
          rows
            .filter(r => r.region === region && r.district === district)
            .map(r => r.county)
            .filter(Boolean)
        )].sort();
        return Response.json({ options: counties });
      }

      if (level === 'subcounties') {
        if (!region || !district || !county) return Response.json({ options: [] });
        const subcounties = [...new Set(
          rows
            .filter(r => r.region === region && r.district === district && r.county === county)
            .map(r => r.subcounty)
            .filter(Boolean)
        )].sort();
        return Response.json({ options: subcounties });
      }

      if (level === 'parishes') {
        if (!region || !district || !county || !subcounty) return Response.json({ options: [] });
        const parishes = [...new Set(
          rows
            .filter(r => r.region === region && r.district === district && r.county === county && r.subcounty === subcounty)
            .map(r => r.parish)
            .filter(Boolean)
        )].sort();
        return Response.json({ options: parishes });
      }

      if (level === 'villages') {
        if (!region || !district || !county || !subcounty || !parish) return Response.json({ options: [] });
        const villages = [...new Set(
          rows
            .filter(r => r.region === region && r.district === district && r.county === county && r.subcounty === subcounty && r.parish === parish)
            .map(r => r.village)
            .filter(Boolean)
        )].sort();
        return Response.json({ options: villages });
      }
    }

    return Response.json({ options: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Module-level cache persists across warm invocations
let cachedRows = null;
let cacheLoadedAt = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchAndParseData() {
  const now = Date.now();
  if (cachedRows && cacheLoadedAt && (now - cacheLoadedAt) < CACHE_TTL_MS) return cachedRows;
  
  // Fetch the Excel file and parse it
  const resp = await fetch(FILE_URL);
  if (!resp.ok) throw new Error('Failed to fetch admin data');
  
  const buffer = await resp.arrayBuffer();
  
  // Use xlsx to parse
  const xlsx = await import('npm:xlsx@0.18.5');
  const workbook = xlsx.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['Administrative Units'];
  const raw = xlsx.utils.sheet_to_json(sheet);
  
  cacheLoadedAt = Date.now();
  cachedRows = raw.map(r => ({
    region: (r['Region'] || '').trim(),
    districtCode: (r['District Code'] || '').toString().trim(),
    district: (r['District'] || '').trim(),
    county: (r['County/Constituency'] || '').trim(),
    subcounty: (r['Subcounty/Town/Municipal Division'] || '').trim(),
    parish: (r['Parish/Ward'] || '').trim(),
    village: (r['Village/Cell/Zone'] || '').trim(),
  }));
  
  return cachedRows;
}