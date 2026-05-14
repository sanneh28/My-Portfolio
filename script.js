const weatherIcons = {
  '01d':'☀️','01n':'🌙','02d':'⛅','02n':'☁️','03d':'☁️','03n':'☁️',
  '04d':'☁️','04n':'☁️','09d':'🌧️','09n':'🌧️','10d':'🌦️','10n':'🌧️',
  '11d':'⛈️','11n':'⛈️','13d':'❄️','13n':'❄️','50d':'🌫️','50n':'🌫️',
};

async function fetchAndRenderWeather(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('bad response');
  const data = await res.json();
  const icon = weatherIcons[data.weather?.[0]?.icon] || '🌡️';
  const temp = Math.round(data.main?.temp);
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('weather-temp').textContent = `${temp}°C`;
  document.getElementById('weather-city').textContent = data.name || '';
  const widget = document.getElementById('weather-widget');
  if (widget) widget.style.display = '';
}

async function loadHeroWeather() {
  const widget = document.getElementById('weather-widget');
  try {
    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    }).then(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      await fetchAndRenderWeather(`/api/weather?endpoint=weather&lat=${lat}&lon=${lon}&units=metric`);
    });
  } catch {
    if (widget) widget.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHeroWeather();
  // 0. Theme Toggle
  const themeToggleBtn = document.getElementById('theme-toggle');

  const applyTheme = (theme) => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeToggleBtn.textContent = '🌙';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeToggleBtn.textContent = '☀️';
    }
  };

  applyTheme(localStorage.getItem('theme') || 'dark');

  themeToggleBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });

  // 1. Mobile Navigation Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu');
  const navLinks = document.querySelector('.nav-links');

  mobileMenuBtn.addEventListener('click', () => {
    mobileMenuBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  // Close mobile menu when a link is clicked
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenuBtn.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });

  // 2. Dynamic Footer Year
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 3. Scroll Animations using Intersection Observer
  // Add animation class to elements dynamically to keep HTML clean
  const animatedElements = document.querySelectorAll(
    '.about-grid, .skill-card, .project-card, .section-title, .section-desc'
  );
  
  animatedElements.forEach(el => el.classList.add('fade-in-section'));

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in-section').forEach(section => {
    observer.observe(section);
  });

  // 4. Active Navigation State on Scroll
  const sections = document.querySelectorAll('section');
  const navItems = document.querySelectorAll('.nav-links a');

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= (sectionTop - sectionHeight / 3)) {
          current = section.getAttribute('id');
        }
      });

      navItems.forEach(item => {
        item.classList.remove('active');
        if (current && item.getAttribute('href').includes(current)) {
          item.classList.add('active');
        }
      });
      scrollTicking = false;
    });
  });
});
