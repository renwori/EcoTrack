'use strict';
// Погода через Open-Meteo: бесплатно, без ключа, работает без VPN.
/* exported Weather */
const Weather = (() => {
  const CODES = {
    0: ['Ясно', '☀️', '🌙'],
    1: ['Преимущественно ясно', '🌤️', '🌙'],
    2: ['Переменная облачность', '⛅', '☁️'],
    3: ['Пасмурно', '☁️', '☁️'],
    45: ['Туман', '🌫️', '🌫️'],
    48: ['Изморозь, туман', '🌫️', '🌫️'],
    51: ['Лёгкая морось', '🌦️', '🌧️'],
    53: ['Морось', '🌦️', '🌧️'],
    55: ['Сильная морось', '🌧️', '🌧️'],
    56: ['Ледяная морось', '🌧️', '🌧️'],
    57: ['Ледяная морось', '🌧️', '🌧️'],
    61: ['Небольшой дождь', '🌦️', '🌧️'],
    63: ['Дождь', '🌧️', '🌧️'],
    65: ['Ливень', '🌧️', '🌧️'],
    66: ['Ледяной дождь', '🌧️', '🌧️'],
    67: ['Ледяной дождь', '🌧️', '🌧️'],
    71: ['Небольшой снег', '🌨️', '🌨️'],
    73: ['Снег', '🌨️', '🌨️'],
    75: ['Сильный снег', '❄️', '❄️'],
    77: ['Снежная крупа', '🌨️', '🌨️'],
    80: ['Ливневый дождь', '🌦️', '🌧️'],
    81: ['Ливни', '🌧️', '🌧️'],
    82: ['Сильные ливни', '⛈️', '⛈️'],
    85: ['Снегопад', '🌨️', '🌨️'],
    86: ['Сильный снегопад', '❄️', '❄️'],
    95: ['Гроза', '⛈️', '⛈️'],
    96: ['Гроза с градом', '⛈️', '⛈️'],
    99: ['Гроза с градом', '⛈️', '⛈️'],
  };

  function describe(code, isDay = 1) {
    const c = CODES[code] || ['—', '🌡️', '🌡️'];
    return { text: c[0], icon: isDay ? c[1] : c[2] };
  }

  const DIRS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  const windDir = (deg) => DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

  async function search(name) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?count=6&language=ru&format=json&name=' + encodeURIComponent(name);
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j.results || []).map((x) => ({
      name: x.name,
      region: [x.admin1, x.country].filter(Boolean).join(', '),
      lat: x.latitude,
      lon: x.longitude,
    }));
  }

  async function forecast(lat, lon) {
    const p = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation',
      hourly: 'temperature_2m,weather_code,is_day,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum',
      timezone: 'auto',
      forecast_days: '7',
      wind_speed_unit: 'ms',
    });
    const r = await fetch('https://api.open-meteo.com/v1/forecast?' + p);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  return { describe, windDir, search, forecast };
})();
