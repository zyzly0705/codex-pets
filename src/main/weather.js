function normalizePlacePart(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[，,、]+/g, '')
    .replace(/市$/u, '')
    .replace(/区$/u, '')
    .replace(/县$/u, '');
}

function formatPlaceName(city, regionName) {
  const rawCity = String(city || '').trim();
  const rawRegion = String(regionName || '').trim();
  const cityNorm = normalizePlacePart(rawCity);
  const regionNorm = normalizePlacePart(rawRegion);

  if (!rawCity && !rawRegion) return '本地天气';
  if (!rawRegion) return rawCity || rawRegion;
  if (!rawCity) return rawRegion;
  if (cityNorm && regionNorm && (cityNorm === regionNorm || regionNorm.includes(cityNorm) || cityNorm.includes(regionNorm))) {
    return rawCity;
  }
  return `${rawCity} ${rawRegion}`;
}

async function getWeather() {
  let latitude, longitude, placeName;
  try {
    const ipResponse = await fetch('http://ip-api.com/json/?fields=status,city,regionName,lat,lon&lang=zh-CN');
    if (!ipResponse.ok) throw new Error(`IP locate failed: ${ipResponse.status}`);
    const ipData = await ipResponse.json();
    if (ipData.status !== 'success') throw new Error('IP locate returned failure');
    latitude = ipData.lat;
    longitude = ipData.lon;
    placeName = formatPlaceName(ipData.city, ipData.regionName);
  } catch {
    return { ok: false, error: '无法定位当前位置。' };
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weathercode,windspeed_10m&forecast_days=2&timezone=auto`;
  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    return { ok: false, error: '天气服务不可用。' };
  }
  const weather = await weatherResponse.json();

  let tempDrop = false;
  let rainComing = false;
  let windWarning = false;
  let minTemp6h = null;
  let maxTemp6h = null;
  let forecast = [];

  if (weather.hourly && weather.hourly.time) {
    const nowISO = new Date().toISOString();
    const hourlyTimes = weather.hourly.time;
    let startIdx = 0;
    for (let i = 0; i < hourlyTimes.length; i++) {
      if (hourlyTimes[i] >= nowISO.slice(0, 16)) {
        startIdx = i;
        break;
      }
    }
    const endIdx = Math.min(startIdx + 6, hourlyTimes.length);
    const temps6h = weather.hourly.temperature_2m.slice(startIdx, endIdx);
    const codes6h = (weather.hourly.weathercode || []).slice(startIdx, endIdx);
    const winds6h = (weather.hourly.windspeed_10m || []).slice(startIdx, endIdx);

    forecast = temps6h;
    if (temps6h.length > 0) {
      minTemp6h = Math.min(...temps6h);
      maxTemp6h = Math.max(...temps6h);
      const currentTemp = weather.current.temperature_2m;
      tempDrop = (currentTemp - minTemp6h) > 5;
    }
    rainComing = codes6h.some(code => (code >= 51 && code <= 67) || (code >= 80 && code <= 82));
    windWarning = winds6h.some(speed => speed > 40);
  }

  return {
    ok: true,
    place: placeName,
    current: weather.current,
    forecast,
    tempDrop,
    rainComing,
    windWarning,
    minTemp6h,
    maxTemp6h
  };
}

function registerWeatherIpc({ ipcMain }) {
  ipcMain.handle('weather:get', () => getWeather());
}

module.exports = { getWeather, registerWeatherIpc };
