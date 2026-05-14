/* =============================================
   ZENITH — High-Performance Weather Intelligence
   API: OpenWeatherMap (free tier), via /api/weather proxy
============================================= */

// All requests go through our Vercel serverless function, which injects the
// API key server-side. Path is relative so it works at any deploy URL.
const PROXY_URL = '/api/weather';
const owmUrl = (endpoint, params) =>
  `${PROXY_URL}?endpoint=${endpoint}&${new URLSearchParams(params)}`;

// =============================================
//  STATE
// =============================================
let currentUnit = 'metric'; // 'metric' or 'imperial'
let currentWeatherData = null;
let currentForecastData = null;
let currentAqiData = null;

// =============================================
//  DOM ELEMENTS
// =============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const searchInput = $('#search-input');
const searchBtn = $('#search-btn');
const geoBtn = $('#geo-btn');
const unitToggle = $('#unit-toggle');
const btnCelsius = $('#btn-celsius');
const btnFahrenheit = $('#btn-fahrenheit');
const loadingOverlay = $('#loading-overlay');
const errorState = $('#error-state');
const welcomeState = $('#welcome-state');
const weatherContent = $('#weather-content');
const errorRetryBtn = $('#error-retry-btn');
const recentSearches = $('#recent-searches');
const recentList = $('#recent-list');
const clearRecentBtn = $('#clear-recent-btn');
const welcomeGeoBtn = $('#welcome-geo-btn');
const particlesContainer = $('#particles-container');

// =============================================
//  WEATHER ICON MAP
// =============================================
const weatherIcons = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};

// =============================================
//  WEATHER GRADIENTS
// =============================================
const weatherGradients = {
  clear_day: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
  clear_night: 'linear-gradient(135deg, #0f172a 0%, #000000 100%)',
  clouds_day: 'linear-gradient(135deg, #7dd3fc 0%, #f1f5f9 100%)',
  clouds_night: 'linear-gradient(135deg, #1e293b 0%, #020617 100%)',
  rain_day: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)',
  rain_night: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
  thunder_day: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
  thunder_night: 'linear-gradient(135deg, #1e1b4b 0%, #000000 100%)',
  snow_day: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
  snow_night: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  mist_day: 'linear-gradient(135deg, #bae6fd 0%, #f1f5f9 100%)',
  mist_night: 'linear-gradient(135deg, #1e293b 0%, #020617 100%)',
  default: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
};

// =============================================
//  INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  loadRecentSearches();
  setupEventListeners();
  spawnWelcomeParticles();
  handleGeolocation({ auto: true });
});

function spawnWelcomeParticles() {
  const count = window.innerWidth < 600 ? 12 : 22;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      background:rgba(255,255,255,${Math.random() * 0.15 + 0.05});
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 14 + 10}s;
      animation-delay:${Math.random() * 8}s;
      filter:blur(1px);
    `;
    particlesContainer.appendChild(p);
  }
}

function setupEventListeners() {
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  geoBtn.addEventListener('click', handleGeolocation);
  welcomeGeoBtn.addEventListener('click', handleGeolocation);
  errorRetryBtn.addEventListener('click', () => {
    showView('welcome');
    searchInput.focus();
  });
  clearRecentBtn.addEventListener('click', clearRecentSearches);

  // Unit toggle
  unitToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.unit-btn');
    if (!btn || btn.classList.contains('active')) return;

    btnCelsius.classList.toggle('active');
    btnFahrenheit.classList.toggle('active');
    currentUnit = btn.dataset.unit;

    if (currentWeatherData && currentForecastData) {
      renderWeather(currentWeatherData, currentForecastData, currentAqiData);
    }
  });
}

// =============================================
//  SEARCH & GEOLOCATION
// =============================================
function handleSearch() {
  const city = searchInput.value.trim();
  if (!city) return;
  fetchWeatherByCity(city);
  searchInput.value = '';
}

let geoInProgress = false;

function handleGeolocation({ auto = false } = {}) {
  if (!navigator.geolocation) {
    if (!auto) showError('Geolocation Error', 'Your browser does not support geolocation.');
    return;
  }

  if (geoInProgress) return;
  geoInProgress = true;

  geoBtn.style.opacity = '0.6';
  geoBtn.style.pointerEvents = 'none';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geoInProgress = false;
      geoBtn.style.opacity = '1';
      geoBtn.style.pointerEvents = 'auto';
      fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      geoInProgress = false;
      geoBtn.style.opacity = '1';
      geoBtn.style.pointerEvents = 'auto';
      const msgs = {
        1: 'Location permission denied. Please allow it in Safari → Settings → Websites → Location.',
        2: 'Your location could not be determined. Try searching for your city instead.',
        3: 'Location request timed out. Try searching for your city instead.',
      };
      if (auto) {
        showView('welcome');
      } else {
        showError('Location Error', msgs[err.code] || 'Could not get your location. Please search manually.');
      }
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

// =============================================
//  API CALLS
// =============================================
async function fetchWeatherByCity(city) {
  showView('loading');
  try {
    const weatherRes = await fetch(owmUrl('weather', { q: city, units: 'metric' }));
    if (!weatherRes.ok) {
      if (weatherRes.status === 401 || weatherRes.status === 500) {
        showError('Server Configuration Error', 'The weather service is misconfigured. Please try again later.');
        return;
      }
      showError('City Not Found', `We couldn't find "${city}". Please check the spelling and try again.`);
      return;
    }
    const weatherData = await weatherRes.json();
    saveRecentSearch(weatherData.name);
    const { lat, lon } = weatherData.coord;

    const forecastRes = await fetch(owmUrl('forecast', { lat, lon, units: 'metric' }));
    if (!forecastRes.ok) {
      throw new Error(`Forecast API Error: ${forecastRes.status}`);
    }
    const forecastData = await forecastRes.json();

    // Fetch AQI
    const aqiRes = await fetch(owmUrl('air_pollution', { lat, lon }));
    const aqiData = aqiRes.ok ? await aqiRes.json() : null;

    currentWeatherData = weatherData;
    currentForecastData = forecastData;
    currentAqiData = aqiData;

    renderWeather(weatherData, forecastData, aqiData);
    updateParticles(weatherData);
    showView('weather');
  } catch (err) {
    console.error('Weather Pulse Error:', err);
    showError('Network Error', `Details: ${err.message}. Please check your connection or API key.`);
  }
}

async function fetchWeatherByCoords(lat, lon) {
  showView('loading');
  try {
    const weatherRes = await fetch(owmUrl('weather', { lat, lon, units: 'metric' }));
    if (!weatherRes.ok) {
      if (weatherRes.status === 401 || weatherRes.status === 500) {
        showError('Server Configuration Error', 'The weather service is misconfigured. Please try again later.');
        return;
      }
      showError('Error', 'Could not fetch weather data for this location.');
      return;
    }
    const weatherData = await weatherRes.json();

    const forecastRes = await fetch(owmUrl('forecast', { lat, lon, units: 'metric' }));
    if (!forecastRes.ok) {
      throw new Error(`Forecast API Error: ${forecastRes.status}`);
    }
    const forecastData = await forecastRes.json();

    // Fetch AQI
    const aqiRes = await fetch(owmUrl('air_pollution', { lat, lon }));
    const aqiData = aqiRes.ok ? await aqiRes.json() : null;

    currentWeatherData = weatherData;
    currentForecastData = forecastData;
    currentAqiData = aqiData;

    saveRecentSearch(weatherData.name);
    searchInput.value = '';

    renderWeather(weatherData, forecastData, aqiData);
    updateParticles(weatherData);
    showView('weather');
  } catch (err) {
    console.error('Weather Pulse Error:', err);
    showError('Network Error', `Details: ${err.message}. Please check your connection or API key.`);
  }
}

// =============================================
//  RENDER WEATHER DATA
// =============================================
function renderWeather(weather, forecast, aqi) {
  const speedUnit = currentUnit === 'metric' ? 'km/h' : 'mph';
  const rawWind = weather.wind?.speed || 0;
  const windSpeed = convertSpeed(rawWind).toFixed(1);

  // Current weather
  if ($('#cw-temp')) $('#cw-temp').textContent = Math.round(convertTemp(weather.main?.temp || 0));
  if ($('#cw-unit')) $('#cw-unit').textContent = '°';
  if ($('#cw-condition')) $('#cw-condition').textContent = weather.weather?.[0]?.description || 'Unknown';
  
  const gradient = getGradient(weather);
  document.body.style.setProperty('--weather-gradient', gradient);
  
  // High/Low for today from forecast
  const todayForecasts = forecast.list?.slice(0, 8) || [];
  const temps = todayForecasts.map(f => f.main.temp);
  const highVal = Math.max(...temps, weather.main?.temp_max || 0);
  const lowVal = Math.min(...temps, weather.main?.temp_min || 0);

  if ($('#cw-high')) $('#cw-high').textContent = Math.round(convertTemp(highVal));
  if ($('#cw-low')) $('#cw-low').textContent = Math.round(convertTemp(lowVal));

  if ($('#cw-city')) $('#cw-city').textContent = `${weather.sys?.country ? weather.sys.country + ' · ' : ''}${weather.name}`;

  // Highlights
  renderHighlights(weather, windSpeed, speedUnit, aqi);

  // Forecasts
  renderHourlyForecast(forecast);
  renderDailyForecast(forecast);
}

function renderHighlights(weather, windSpeed, speedUnit, aqi) {
  // Zenith Intelligence (AQI & Insights)
  const aqiStatus = $('#aqi-status');
  const aqiBar = $('#aqi-bar');
  const insightMsg = $('#insight-msg');
  
  if (aqi && aqi.list?.[0]) {
    const aqiVal = aqi.list[0].main.aqi; // 1 to 5
    const aqiMap = {
      1: { text: 'Good', color: '#10b981', width: '20%' },
      2: { text: 'Fair', color: '#84cc16', width: '40%' },
      3: { text: 'Moderate', color: '#f59e0b', width: '60%' },
      4: { text: 'Poor', color: '#f97316', width: '80%' },
      5: { text: 'Very Poor', color: '#ef4444', width: '100%' }
    };
    const info = aqiMap[aqiVal];
    if (aqiStatus) aqiStatus.textContent = info.text;
    if (aqiBar) {
      aqiBar.style.width = info.width;
      aqiBar.style.background = info.color;
    }
    
    if (insightMsg) insightMsg.textContent = getSmartInsight(weather, aqiVal);
  }

  // Sunrise & Sunset (Solar Journey)
  const sunriseTS = weather.sys.sunrise;
  const sunsetTS = weather.sys.sunset;
  const nowTS = weather.dt; // Current time from API
  
  const localSunrise = new Date((sunriseTS + weather.timezone) * 1000);
  const localSunset = new Date((sunsetTS + weather.timezone) * 1000);
  
  if ($('#hl-sunrise')) $('#hl-sunrise').textContent = formatTime(localSunrise);
  if ($('#hl-sunset')) $('#hl-sunset').textContent = formatTime(localSunset);

  // Calculate position on the arc
  const totalDaylight = sunsetTS - sunriseTS;
  const elapsed = nowTS - sunriseTS;
  let progress = elapsed / totalDaylight;
  progress = Math.max(0, Math.min(1, progress)); // Clamp between 0 and 1

  // Update SVG Arc & Indicator
  const path = $('#solar-active-path');
  const indicator = $('#sun-indicator');
  
  if (path && indicator) {
    // Total length of the path arc is roughly 125.6 (PI * R)
    const pathLength = 125.6; 
    path.style.strokeDasharray = `${progress * pathLength}, 1000`;
    
    // Calculate coordinates on semi-circle
    // Angle from 180 (sunrise) to 0 (sunset)
    const angle = 180 - (progress * 180);
    const rad = angle * (Math.PI / 180);
    const r = 40; // Radius matches A40,40 in SVG
    const cx = 50 + (r * Math.cos(rad));
    const cy = 45 - (r * Math.sin(rad));
    
    indicator.setAttribute('cx', cx);
    indicator.setAttribute('cy', cy);
    
    // Change icon based on day/night
    const isDay = weather.weather?.[0]?.icon?.endsWith('d');
    indicator.setAttribute('fill', isDay ? '#fbbf24' : '#94a3b8');
    indicator.style.filter = isDay ? 'drop-shadow(0 0 8px #fbbf24)' : 'none';
  }

  // Humidity
  const humidity = weather.main.humidity;
  const hlHumVal = $('#hl-humidity-val');
  const hlHumBar = $('#hl-humidity-bar');
  if (hlHumVal) hlHumVal.textContent = `${humidity}%`;
  if (hlHumBar) hlHumBar.style.width = `${humidity}%`;
  
  // Dew point calculation (simplified formula)
  const t = weather.main.temp;
  const rh = weather.main.humidity;
  const dewPoint = t - ((100 - rh) / 5);
  const cwDew = $('#cw-dew');
  if (cwDew) cwDew.textContent = Math.round(convertTemp(dewPoint));

  // Wind
  const hlWindVal = $('#stat-wind-val');
  const hlCompass = $('#hl-compass-arrow');
  const hlWindDirTxt = $('#hl-wind-dir');
  
  if (hlWindVal) hlWindVal.innerHTML = `${windSpeed} <small>${speedUnit}</small>`;
  const windDeg = weather.wind.deg || 0;
  if (hlCompass) hlCompass.style.transform = `rotate(${windDeg}deg)`;
  if (hlWindDirTxt) hlWindDirTxt.textContent = degToCompass(windDeg);

  // Visibility
  const visKm = (weather.visibility / 1000).toFixed(1);
  const hlVisVal = $('#hl-vis-val');
  if (hlVisVal) hlVisVal.innerHTML = `${visKm} <small>km</small>`;

  // Pressure
  const hlPressVal = $('#hl-pressure-val');
  if (hlPressVal) hlPressVal.innerHTML = `${weather.main.pressure} <small>hPa</small>`;
}

function renderHourlyForecast(forecast) {
  const container = $('#hourly-scroll');
  container.innerHTML = '';

  const items = forecast.list.slice(0, 12);

  items.forEach((item, i) => {
    const localDate = new Date((item.dt + forecast.city.timezone) * 1000);
    
    const card = document.createElement('div');
    card.className = 'hourly-card' + (i === 0 ? ' now' : '');
    card.innerHTML = `
      <div class="h-time">${i === 0 ? 'Now' : formatHour(localDate)}</div>
      <div class="h-icon">${weatherIcons[item.weather[0].icon] || '🌡️'}</div>
      <div class="h-temp">${Math.round(convertTemp(item.main.temp))}°</div>
    `;
    container.appendChild(card);
  });
}

function renderDailyForecast(forecast) {
  const container = $('#daily-list');
  container.innerHTML = '';

  // Group by day
  const days = {};
  forecast.list.forEach((item) => {
    const localDate = new Date((item.dt + forecast.city.timezone) * 1000);
    
    const key = localDate.toDateString();
    if (!days[key]) {
      days[key] = { temps: [], icons: [], conditions: [], date: localDate };
    }
    days[key].temps.push(item.main.temp);
    days[key].icons.push(item.weather[0].icon);
    days[key].conditions.push(item.weather[0].description);
  });

  const dayKeys = Object.keys(days).slice(0, 5);

  dayKeys.forEach((key, i) => {
    const day = days[key];
    const high = Math.round(convertTemp(Math.max(...day.temps)));
    const low = Math.round(convertTemp(Math.min(...day.temps)));
    // Pick the most common icon
    const icon = mostFrequent(day.icons);
    const condition = mostFrequent(day.conditions);

    const card = document.createElement('div');
    card.className = 'daily-card';
    card.style.animationDelay = `${i * 0.05}s`;

    const dayName = i === 0 ? 'Today' : formatDayName(day.date);

    card.innerHTML = `
      <div class="d-day">${dayName}</div>
      <div class="d-icon">${weatherIcons[icon] || '🌡️'}</div>
      <div class="d-cond">${condition}</div>
      <div class="d-temps">
        <span class="d-hi">${high}°</span>
        <span class="d-lo">${low}°</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// =============================================
//  DYNAMIC BACKGROUND & PARTICLES
// =============================================
function getGradient(weather) {
  const code = weather.weather?.[0]?.id || 800;
  const isDay = weather.weather?.[0]?.icon?.endsWith('d');
  
  if (code >= 200 && code < 300) return isDay ? weatherGradients.thunder_day : weatherGradients.thunder_night;
  if (code >= 300 && code < 600) return isDay ? weatherGradients.rain_day : weatherGradients.rain_night;
  if (code >= 600 && code < 700) return isDay ? weatherGradients.snow_day : weatherGradients.snow_night;
  if (code >= 700 && code < 800) return isDay ? weatherGradients.mist_day : weatherGradients.mist_night;
  if (code === 800) return isDay ? weatherGradients.clear_day : weatherGradients.clear_night;
  if (code > 800) return isDay ? weatherGradients.clouds_day : weatherGradients.clouds_night;
  return weatherGradients.default;
}

function updateParticles(weather) {
  particlesContainer.innerHTML = '';
  const bgGlow = $('#bg-glow');
  const code = weather.weather?.[0]?.id || 800;
  const isDay = weather.weather?.[0]?.icon?.endsWith('d');
  const gradient = getGradient(weather);
  const isMobile = window.innerWidth < 600;
  
  // Update bg-glow
  if (bgGlow) {
    bgGlow.style.background = gradient;
    bgGlow.style.filter = 'blur(100px) opacity(0.4)';
  }

  let particleCount = 0;
  let particleClass = '';

  if (code >= 200 && code < 300) {
    particleCount = isMobile ? 30 : 60;
    particleClass = 'particle-rain';
  } else if (code >= 300 && code < 500) {
    particleCount = isMobile ? 10 : 15;
    particleClass = 'particle-rain';
  } else if (code >= 500 && code < 600) {
    particleCount = isMobile ? 25 : 45;
    particleClass = 'particle-rain';
  } else if (code >= 600 && code < 700) {
    particleCount = isMobile ? 15 : 30;
    particleClass = 'particle-snow';
  } else if (!isDay) {
    // Show some stars at night regardless of weather, but more if clear
    particleCount = code === 800 ? (isMobile ? 15 : 25) : (isMobile ? 5 : 10);
    particleClass = '';
  }

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = `particle ${particleClass}`;

    const size = particleClass === 'particle-rain' ? 1.5 : Math.random() * 3 + 2;
    const left = Math.random() * 100;
    const duration = particleClass === 'particle-rain'
      ? Math.random() * 0.8 + 0.4
      : Math.random() * 10 + 8;
    const delay = Math.random() * 5;

    if (particleClass === 'particle-rain') {
      p.style.width = `${size}px`;
      p.style.height = `${Math.random() * 20 + 15}px`;
      p.style.background = 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.3))';
    } else {
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.background = `rgba(255, 255, 255, ${Math.random() * 0.2 + 0.1})`;
      p.style.filter = 'blur(1px)';
    }

    p.style.left = `${left}%`;
    p.style.animationDuration = `${duration}s`;
    p.style.animationDelay = `${delay}s`;

    particlesContainer.appendChild(p);
  }
}

// =============================================
//  VIEW MANAGEMENT
// =============================================
function showView(view) {
  welcomeState.style.display = 'none';
  loadingOverlay.style.display = 'none';
  errorState.style.display = 'none';
  weatherContent.style.display = 'none';
  recentSearches.style.display = view === 'weather' ? 'none' : '';

  switch (view) {
    case 'welcome': welcomeState.style.display = 'flex'; loadRecentSearches(); break;
    case 'loading': loadingOverlay.style.display = 'flex'; break;
    case 'error': errorState.style.display = 'flex'; break;
    case 'weather': weatherContent.style.display = 'block'; break;
  }
}

function showError(title, msg) {
  $('#error-title').textContent = title;
  $('#error-msg').textContent = msg;
  showView('error');
}

// =============================================
//  RECENT SEARCHES (localStorage)
// =============================================
function saveRecentSearch(city) {
  let searches = JSON.parse(localStorage.getItem('wp_recent') || '[]');
  // Remove duplicate (case insensitive)
  searches = searches.filter((s) => s.toLowerCase() !== city.toLowerCase());
  searches.unshift(city);
  searches = searches.slice(0, 3);
  localStorage.setItem('wp_recent', JSON.stringify(searches));
  loadRecentSearches();
}

function loadRecentSearches() {
  const searches = JSON.parse(localStorage.getItem('wp_recent') || '[]');
  if (searches.length === 0) {
    recentSearches.style.display = 'none';
    return;
  }

  recentSearches.style.display = 'flex';
  recentList.innerHTML = '';
  searches.forEach((city) => {
    const chip = document.createElement('button');
    chip.className = 'recent-chip';
    chip.textContent = city;
    chip.addEventListener('click', () => {
      searchInput.value = city;
      fetchWeatherByCity(city);
    });
    recentList.appendChild(chip);
  });
}

function clearRecentSearches() {
  localStorage.removeItem('wp_recent');
  loadRecentSearches();
}

// =============================================
//  UTILITY FUNCTIONS
// =============================================
// Note: callers build `date` as `new Date((utcSeconds + tzOffsetSeconds) * 1000)`,
// which shifts the UTC instant by the city's offset. Formatting with `timeZone: 'UTC'`
// then prints those shifted numbers verbatim — yielding the city's local wall-clock time
// regardless of the viewer's own timezone.
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
}

function formatHour(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC'
  });
}

function formatDayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function degToCompass(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Unit Helpers
function convertTemp(c) {
  return currentUnit === 'metric' ? c : (c * 9/5) + 32;
}

function convertSpeed(ms) {
  // input is always m/s from API
  return currentUnit === 'metric' ? (ms * 3.6) : (ms * 2.237);
}

function mostFrequent(arr) {
  const counts = {};
  let maxItem = arr[0];
  let maxCount = 1;
  arr.forEach((item) => {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  });
  return maxItem;
}

function getSmartInsight(weather, aqi) {
  const temp = weather.main.temp;
  const code = weather.weather[0].id;
  
  if (code >= 200 && code < 600) return "Rainy day patterns detected. Best to stay indoors or keep an umbrella close! ☔";
  if (code >= 600 && code < 700) return "Snowfall alert. Dress in warm layers and watch for icy paths! ❄️";
  if (aqi >= 4) return "Air quality is low today. Consider wearing a mask or limiting outdoor activity. 😷";
  if (temp >= 30) return "Intense heat detected. Stay hydrated and find some shade! 💧";
  if (temp <= 5) return "Bracing cold today. A heavy coat and warm drinks are recommended! 🧣";
  if (code === 800) return "Clear skies ahead! Perfect conditions for outdoor activities and fresh air. ☀️";
  
  return "Stable conditions today. A great time to tackle your to-do list! ✨";
}
