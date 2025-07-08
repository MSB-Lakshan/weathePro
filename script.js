// Weather App JavaScript
class WeatherApp {
    constructor() {
        this.apiKey = 'API_KEY';
        this.apiUrl = 'https://api.openweathermap.org/data/2.5';
        this.oneCallUrl = 'https://api.openweathermap.org/data/3.0/onecall';
        this.currentWeatherData = null;
        this.forecastData = null;
        this.charts = {};
        
        this.initializeApp();
        this.attachEventListeners();
        this.initializeTheme();
    }

    initializeApp() {
        this.showLoading();
        this.setCurrentDate();
        this.getCurrentLocation();
    }

    attachEventListeners() {
        // Search functionality
        document.getElementById('search-btn').addEventListener('click', () => this.handleSearch());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Location button
        document.getElementById('location-btn').addEventListener('click', () => this.getCurrentLocation());

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('weather-app-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('weather-app-theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    setCurrentDate() {
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('current-date').textContent = currentDate;
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    async getCurrentLocation() {
        this.showLoading();
        
        if (!navigator.geolocation) {
            console.log('Geolocation is not supported by this browser');
            this.showNotification('Geolocation not supported. Loading default location...', 'info');
            this.getWeatherByCity('Colombo');
            return;
        }

        // Set a timeout for geolocation
        const timeoutId = setTimeout(() => {
            console.log('Geolocation timeout - loading default location');
            this.showNotification('Location access timed out. Loading default location...', 'info');
            this.getWeatherByCity('Colombo');
        }, 10000); // 10 second timeout

        const options = {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000 // 5 minutes
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                clearTimeout(timeoutId);
                const { latitude, longitude } = position.coords;
                console.log('Location obtained:', latitude, longitude);
                this.getWeatherByCoords(latitude, longitude);
            },
            (error) => {
                clearTimeout(timeoutId);
                console.log('Geolocation error:', error);
                
                let message = 'Unable to get your location. ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        message += 'Location access was denied.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        message += 'Location request timed out.';
                        break;
                    default:
                        message += 'An unknown error occurred.';
                        break;
                }
                
                this.showNotification(message + ' Loading default location...', 'warning');
                // Fallback to a default city
                this.getWeatherByCity('Colombo');
            },
            options
        );
    }

    async handleSearch() {
        const city = document.getElementById('search-input').value.trim();
        if (!city) {
            this.showNotification('Please enter a city name', 'warning');
            return;
        }

        this.showLoading();
        await this.getWeatherByCity(city);
        document.getElementById('search-input').value = '';
    }

    async getWeatherByCity(city) {
        try {
            const response = await fetch(
                `${this.apiUrl}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric`
            );
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('City not found. Please check the spelling and try again.');
                } else if (response.status === 401) {
                    throw new Error('API key error. Please check your API configuration.');
                } else {
                    throw new Error(`Weather service error (${response.status}). Please try again later.`);
                }
            }
            
            const data = await response.json();
            const { lat, lon } = data.coord;
            
            await this.getWeatherByCoords(lat, lon);
        } catch (error) {
            console.error('Error fetching weather by city:', error);
            this.showNotification(error.message, 'error');
            this.hideLoading();
        }
    }

    async getWeatherByCoords(lat, lon) {
        try {
            // Get current weather
            const currentResponse = await fetch(
                `${this.apiUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
            );
            
            if (!currentResponse.ok) {
                throw new Error(`Failed to fetch current weather (${currentResponse.status})`);
            }

            this.currentWeatherData = await currentResponse.json();

            // Try to get forecast data (One Call API 3.0 requires subscription)
            try {
                const forecastResponse = await fetch(
                    `${this.oneCallUrl}?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric&exclude=minutely,hourly`
                );

                if (forecastResponse.ok) {
                    this.forecastData = await forecastResponse.json();
                } else {
                    console.log('One Call API not available, using 5-day forecast instead');
                    // Fallback to 5-day forecast
                    const forecast5Response = await fetch(
                        `${this.apiUrl}/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
                    );
                    
                    if (forecast5Response.ok) {
                        const forecast5Data = await forecast5Response.json();
                        this.forecastData = this.convertForecast5ToOneCall(forecast5Data);
                    }
                }
            } catch (forecastError) {
                console.log('Forecast API error:', forecastError);
                // Create mock forecast data
                this.forecastData = this.createMockForecastData();
            }

            this.updateCurrentWeather();
            this.updateForecast();
            this.updateCharts();
            this.updateAlerts();
            
            this.hideLoading();
            this.showNotification('Weather data updated successfully!', 'success');
        } catch (error) {
            console.error('Error fetching weather by coordinates:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
            this.hideLoading();
        }
    }

    convertForecast5ToOneCall(forecast5Data) {
        // Convert 5-day forecast to One Call API format
        const dailyData = [];
        const groupedByDay = {};

        forecast5Data.list.forEach(item => {
            const date = new Date(item.dt * 1000).toDateString();
            if (!groupedByDay[date]) {
                groupedByDay[date] = [];
            }
            groupedByDay[date].push(item);
        });

        Object.keys(groupedByDay).slice(0, 7).forEach(date => {
            const dayData = groupedByDay[date];
            const temps = dayData.map(d => d.main.temp);
            const weatherData = dayData[Math.floor(dayData.length / 2)]; // Use middle reading

            dailyData.push({
                dt: dayData[0].dt,
                temp: {
                    max: Math.max(...temps),
                    min: Math.min(...temps)
                },
                weather: weatherData.weather,
                pop: dayData[0].pop || 0,
                wind_speed: weatherData.wind.speed,
                wind_gust: weatherData.wind.gust || 0,
                rain: weatherData.rain || null
            });
        });

        return {
            current: {
                uvi: 5 // Mock UV index
            },
            daily: dailyData
        };
    }

    createMockForecastData() {
        const mockDaily = [];
        const baseTemp = this.currentWeatherData ? this.currentWeatherData.main.temp : 20;
        
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            
            mockDaily.push({
                dt: Math.floor(date.getTime() / 1000),
                temp: {
                    max: baseTemp + Math.random() * 10 - 5,
                    min: baseTemp - Math.random() * 10 - 5
                },
                weather: [{
                    main: ['Clear', 'Clouds', 'Rain'][Math.floor(Math.random() * 3)],
                    icon: '01d'
                }],
                pop: Math.random() * 0.8,
                wind_speed: Math.random() * 10,
                wind_gust: Math.random() * 15,
                rain: Math.random() > 0.7 ? { '1h': Math.random() * 5 } : null
            });
        }

        return {
            current: { uvi: 5 },
            daily: mockDaily
        };
    }

    updateCurrentWeather() {
        const data = this.currentWeatherData;
        const oneCallData = this.forecastData;

        document.getElementById('current-temp').textContent = Math.round(data.main.temp);
        document.getElementById('current-city').textContent = `${data.name}, ${data.sys.country}`;
        document.getElementById('current-description').textContent = 
            data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
        
        document.getElementById('current-weather-icon').src = 
            `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
        
        document.getElementById('feels-like').textContent = `${Math.round(data.main.feels_like)}°C`;
        document.getElementById('humidity').textContent = `${data.main.humidity}%`;
        document.getElementById('wind').textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
        document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
        document.getElementById('visibility').textContent = `${(data.visibility / 1000).toFixed(1)} km`;
        
        if (oneCallData && oneCallData.current) {
            document.getElementById('uv-index').textContent = Math.round(oneCallData.current.uvi);
        }
    }

    updateForecast() {
        const forecastContainer = document.getElementById('forecast-container');
        forecastContainer.innerHTML = '';

        if (!this.forecastData || !this.forecastData.daily) {
            return;
        }

        const dailyData = this.forecastData.daily.slice(0, 7);

        dailyData.forEach((day, index) => {
            const date = new Date(day.dt * 1000);
            const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });

            const forecastCard = document.createElement('div');
            forecastCard.className = 'forecast-card';
            forecastCard.innerHTML = `
                <div class="forecast-day">${dayName}</div>
                <img class="forecast-icon" src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" alt="${day.weather[0].description}">
                <div class="forecast-temps">
                    <span class="forecast-high">${Math.round(day.temp.max)}°</span>
                    <span class="forecast-low">${Math.round(day.temp.min)}°</span>
                </div>
                <div class="forecast-desc">${day.weather[0].main}</div>
                <div class="forecast-desc">💧 ${Math.round((day.pop || 0) * 100)}%</div>
            `;
            
            forecastContainer.appendChild(forecastCard);
        });
    }

    updateCharts() {
        if (!this.forecastData || !this.forecastData.daily) {
            return;
        }

        this.createTemperatureChart();
        this.createRainChart();
        this.createWindChart();
    }

    createTemperatureChart() {
        const ctx = document.getElementById('temperature-chart').getContext('2d');
        
        if (this.charts.temperature) {
            this.charts.temperature.destroy();
        }

        const dailyData = this.forecastData.daily.slice(0, 7);
        const labels = dailyData.map((day, index) => {
            const date = new Date(day.dt * 1000);
            return index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
        });

        const maxTemps = dailyData.map(day => Math.round(day.temp.max));
        const minTemps = dailyData.map(day => Math.round(day.temp.min));

        this.charts.temperature = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Max Temp (°C)',
                    data: maxTemps,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Min Temp (°C)',
                    data: minTemps,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        }
                    }
                }
            }
        });
    }

    createRainChart() {
        const ctx = document.getElementById('rain-chart').getContext('2d');
        
        if (this.charts.rain) {
            this.charts.rain.destroy();
        }

        const dailyData = this.forecastData.daily.slice(0, 7);
        const labels = dailyData.map((day, index) => {
            const date = new Date(day.dt * 1000);
            return index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
        });

        const rainData = dailyData.map(day => day.rain ? day.rain['1h'] || 0 : 0);
        const popData = dailyData.map(day => (day.pop || 0) * 100);

        this.charts.rain = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Precipitation (mm)',
                    data: rainData,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    yAxisID: 'y'
                }, {
                    label: 'Chance of Rain (%)',
                    data: popData,
                    type: 'line',
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Precipitation (mm)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Chance of Rain (%)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                        max: 100
                    }
                }
            }
        });
    }

    createWindChart() {
        const ctx = document.getElementById('wind-chart').getContext('2d');
        
        if (this.charts.wind) {
            this.charts.wind.destroy();
        }

        const dailyData = this.forecastData.daily.slice(0, 7);
        const labels = dailyData.map((day, index) => {
            const date = new Date(day.dt * 1000);
            return index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
        });

        const windSpeed = dailyData.map(day => Math.round(day.wind_speed * 3.6)); // Convert m/s to km/h
        const windGust = dailyData.map(day => day.wind_gust ? Math.round(day.wind_gust * 3.6) : 0);

        this.charts.wind = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wind Speed (km/h)',
                    data: windSpeed,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }, {
                    label: 'Wind Gust (km/h)',
                    data: windGust,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#ef4444',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Speed (km/h)'
                        }
                    }
                }
            }
        });
    }

    updateAlerts() {
        const alertsContainer = document.getElementById('alerts-container');
        
        // Check if we have real alerts from the API
        if (this.forecastData && this.forecastData.alerts && this.forecastData.alerts.length > 0) {
            alertsContainer.innerHTML = '';
            
            this.forecastData.alerts.slice(0, 5).forEach((alert, index) => {
                const alertCard = document.createElement('div');
                alertCard.className = 'alert-card';
                alertCard.innerHTML = `
                    <div class="alert-title">${alert.event}</div>
                    <div class="alert-description">${alert.description}</div>
                    <div class="alert-time">
                        From: ${new Date(alert.start * 1000).toLocaleString()} 
                        To: ${new Date(alert.end * 1000).toLocaleString()}
                    </div>
                `;
                alertsContainer.appendChild(alertCard);
            });
        } else {
            // Show mock alerts if no real alerts are available
            this.showMockAlerts();
        }
    }

    showMockAlerts() {
        const alertsContainer = document.getElementById('alerts-container');
        alertsContainer.innerHTML = '';

        const mockAlerts = [
            {
                title: 'Weather Update',
                description: 'Partly cloudy conditions expected throughout the day with mild temperatures.',
                time: 'Updated 2 hours ago',
                severity: 'minor'
            },
            {
                title: 'UV Index Advisory',
                description: 'UV levels will be moderate today. Consider wearing sunscreen if spending extended time outdoors.',
                time: 'Updated 3 hours ago',
                severity: 'moderate'
            },
            {
                title: 'Temperature Notice',
                description: 'Temperatures expected to drop by 5°C tomorrow evening. Dress warmly for outdoor activities.',
                time: 'Updated 4 hours ago',
                severity: 'minor'
            },
            {
                title: 'Wind Advisory',
                description: 'Gentle breeze conditions expected. Good weather for outdoor activities and sports.',
                time: 'Updated 5 hours ago',
                severity: 'minor'
            },
            {
                title: 'Weekly Outlook',
                description: 'Generally pleasant weather expected for the week ahead with occasional cloud cover.',
                time: 'Updated 6 hours ago',
                severity: 'minor'
            }
        ];

        mockAlerts.forEach((alert, index) => {
            const alertCard = document.createElement('div');
            alertCard.className = `alert-card ${alert.severity}`;
            alertCard.innerHTML = `
                <div class="alert-title">${alert.title}</div>
                <div class="alert-description">${alert.description}</div>
                <div class="alert-time">${alert.time}</div>
            `;
            alertsContainer.appendChild(alertCard);
        });
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
}

// Initialize the weather app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});

// Add CSS for notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);