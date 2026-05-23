if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('load', () => window.scrollTo(0, 0));

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
  if (widget) widget.style.display = 'inline-flex';
}

async function loadHeroWeather() {
  const widget = document.getElementById('weather-widget');
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
    );
    const { latitude: lat, longitude: lon } = pos.coords;
    await fetchAndRenderWeather(`/api/weather?endpoint=weather&lat=${lat}&lon=${lon}&units=metric`);
  } catch {
    try {
      const ip = await fetch('https://ipapi.co/json/');
      const loc = await ip.json();
      if (loc.latitude && loc.longitude) {
        await fetchAndRenderWeather(`/api/weather?endpoint=weather&lat=${loc.latitude}&lon=${loc.longitude}&units=metric`);
      } else {
        if (widget) widget.style.display = 'none';
      }
    } catch {
      if (widget) widget.style.display = 'none';
    }
  }
}

function initSliders() {
  document.querySelectorAll('.project-slider').forEach(slider => {
    const slides = slider.querySelectorAll('.slide');
    const dots = slider.querySelectorAll('.slider-dot');
    let current = 0;

    function goTo(index) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = index % slides.length;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
    setInterval(() => goTo(current + 1), 15000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadHeroWeather();
  initSliders();
  // 0. Theme Toggle
  const themeToggleBtn = document.getElementById('theme-toggle');

  const sunIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  const moonIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const applyTheme = (theme) => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeToggleBtn.innerHTML = moonIcon;
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeToggleBtn.innerHTML = sunIcon;
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
  const animatedElements = document.querySelectorAll(
    '.about-grid, .skill-card, .project-card, .section-title, .section-desc'
  );

  // Stagger cards within their parent grid
  document.querySelectorAll('.skill-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 50}ms`;
  });
  document.querySelectorAll('.project-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 80}ms`;
  });

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

  // 4. Active Navigation State on Scroll + Nav scrolled shadow
  const sections = document.querySelectorAll('section');
  const navItems = document.querySelectorAll('.nav-links a');
  const navEl = document.querySelector('nav');

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      // Nav shadow when scrolled
      navEl.classList.toggle('nav-scrolled', window.scrollY > 10);

      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.scrollY >= (sectionTop - sectionHeight / 3)) {
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
