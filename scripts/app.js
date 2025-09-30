/**
 * Помодоро Таймер - приложение для повышения продуктивности
 * Реализует технику Помодоро с настройками, уведомлениями и статистикой
 */

class PomodoroTimer {
	constructor() {
		this.initializeElements();
		this.loadSettings();
		this.loadStatistics();
		this.bindEvents();
		this.updateDisplay();
		this.requestNotificationPermission();
	}

	// Инициализация DOM элементов
	initializeElements() {
		// Timer элементы
		this.timerCircle = document.querySelector('.progress-ring-circle');
		this.minutesDisplay = document.querySelector('.minutes');
		this.secondsDisplay = document.querySelector('.seconds');
		this.timerLabel = document.querySelector('.timer-label');

		// Кнопки управления
		this.startBtn = document.getElementById('startBtn');
		this.pauseBtn = document.getElementById('pauseBtn');
		this.resetBtn = document.getElementById('resetBtn');

		// Статистика
		this.workSessionsCount = document.getElementById('workSessions');
		this.shortBreaksCount = document.getElementById('shortBreaks');
		this.longBreaksCount = document.getElementById('longBreaks');

		// Настройки
		this.settings = {
			workDuration: document.getElementById('workDuration'),
			shortBreakDuration: document.getElementById('shortBreakDuration'),
			longBreakDuration: document.getElementById('longBreakDuration'),
			sessionsUntilLongBreak: document.getElementById(
				'sessionsUntilLongBreak'
			),
			enableNotifications: document.getElementById('enableNotifications'),
			enableSound: document.getElementById('enableSound'),
		};

		// Аудио
		this.tickSound = document.getElementById('tickSound');
		this.alarmSound = document.getElementById('alarmSound');

		// Состояние таймера
		this.state = {
			isRunning: false,
			isPaused: false,
			currentPhase: 'work', // 'work', 'shortBreak', 'longBreak'
			timeLeft: 25 * 60, // в секундах
			totalTime: 25 * 60,
			intervalId: null,
		};

		// Статистика сессий
		this.statistics = {
			workSessions: 0,
			shortBreaks: 0,
			longBreaks: 0,
		};
	}

	// Загрузка настроек из localStorage
	loadSettings() {
		const savedSettings = localStorage.getItem('pomodoroSettings');
		if (savedSettings) {
			const settings = JSON.parse(savedSettings);
			Object.keys(settings).forEach((key) => {
				if (
					this.settings[key] &&
					this.settings[key].type !== 'checkbox'
				) {
					this.settings[key].value = settings[key];
				} else if (
					this.settings[key] &&
					this.settings[key].type === 'checkbox'
				) {
					this.settings[key].checked = settings[key];
				}
			});
		}
	}

	// Сохранение настроек в localStorage
	saveSettings() {
		const settings = {};
		Object.keys(this.settings).forEach((key) => {
			if (this.settings[key].type === 'checkbox') {
				settings[key] = this.settings[key].checked;
			} else {
				settings[key] =
					parseInt(this.settings[key].value) ||
					this.settings[key].value;
			}
		});
		localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
	}

	// Загрузка статистики из localStorage
	loadStatistics() {
		const savedStats = localStorage.getItem('pomodoroStatistics');
		if (savedStats) {
			this.statistics = { ...this.statistics, ...JSON.parse(savedStats) };
		}
		this.updateStatisticsDisplay();
	}

	// Сохранение статистики в localStorage
	saveStatistics() {
		localStorage.setItem(
			'pomodoroStatistics',
			JSON.stringify(this.statistics)
		);
	}

	// Привязка событий
	bindEvents() {
		// Кнопки управления таймером
		this.startBtn.addEventListener('click', () => this.startTimer());
		this.pauseBtn.addEventListener('click', () => this.pauseTimer());
		this.resetBtn.addEventListener('click', () => this.resetTimer());

		// Сохранение настроек при изменении
		Object.keys(this.settings).forEach((key) => {
			this.settings[key].addEventListener('change', () => {
				this.saveSettings();
				if (!this.state.isRunning) {
					this.updateTimerFromSettings();
				}
			});
		});

		// Обработка видимости страницы (пауза при сворачивании)
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && this.state.isRunning) {
				this.pauseTimer();
			}
		});

		// Обработка закрытия страницы
		window.addEventListener('beforeunload', () => {
			if (this.state.isRunning) {
				this.saveStatistics();
			}
		});
	}

	// Обновление таймера из настроек
	updateTimerFromSettings() {
		this.state.totalTime = parseInt(this.settings.workDuration.value) * 60;
		this.state.timeLeft = this.state.totalTime;
		this.state.currentPhase = 'work';
		this.updateDisplay();
	}

	// Запрос разрешения на уведомления
	async requestNotificationPermission() {
		if ('Notification' in window && Notification.permission === 'default') {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				this.settings.enableNotifications.checked = false;
				this.saveSettings();
			}
		}
	}

	// Запуск таймера
	startTimer() {
		if (this.state.isRunning) return;

		this.state.isRunning = true;
		this.state.isPaused = false;

		this.startBtn.disabled = true;
		this.pauseBtn.disabled = false;

		this.state.intervalId = setInterval(() => {
			this.tick();
		}, 1000);

		this.updateDisplay();
	}

	// Пауза таймера
	pauseTimer() {
		if (!this.state.isRunning) return;

		this.state.isRunning = false;
		this.state.isPaused = true;

		if (this.state.intervalId) {
			clearInterval(this.state.intervalId);
			this.state.intervalId = null;
		}

		this.startBtn.disabled = false;
		this.pauseBtn.disabled = true;
	}

	// Сброс таймера
	resetTimer() {
		this.pauseTimer();

		// Возврат к рабочей сессии
		this.state.currentPhase = 'work';
		this.state.totalTime = parseInt(this.settings.workDuration.value) * 60;
		this.state.timeLeft = this.state.totalTime;

		this.startBtn.disabled = false;
		this.resetBtn.disabled = false;

		this.updateDisplay();
	}

	// Основной тик таймера
	tick() {
		if (this.state.timeLeft <= 0) {
			this.handleTimerComplete();
			return;
		}

		this.state.timeLeft--;
		this.updateDisplay();

		// Звуковой сигнал каждую минуту (кроме последней)
		if (
			this.state.timeLeft % 60 === 0 &&
			this.state.timeLeft > 0 &&
			this.settings.enableSound.checked
		) {
			this.playSound('tick');
		}
	}

	// Обработка завершения таймера
	handleTimerComplete() {
		this.playSound('alarm');
		this.showNotification();

		// Обновление статистики
		this.updateStatistics();

		// Переход к следующей фазе
		this.nextPhase();
	}

	// Переход к следующей фазе
	nextPhase() {
		switch (this.state.currentPhase) {
			case 'work':
				if (
					this.statistics.workSessions %
						parseInt(this.settings.sessionsUntilLongBreak.value) ===
					parseInt(this.settings.sessionsUntilLongBreak.value) - 1
				) {
					this.startLongBreak();
				} else {
					this.startShortBreak();
				}
				break;
			case 'shortBreak':
			case 'longBreak':
				this.startWorkSession();
				break;
		}
	}

	// Запуск рабочей сессии
	startWorkSession() {
		this.state.currentPhase = 'work';
		this.state.totalTime = parseInt(this.settings.workDuration.value) * 60;
		this.state.timeLeft = this.state.totalTime;
		this.timerLabel.textContent = 'Рабочая сессия';
		this.updateDisplay();
	}

	// Запуск короткого перерыва
	startShortBreak() {
		this.state.currentPhase = 'shortBreak';
		this.state.totalTime =
			parseInt(this.settings.shortBreakDuration.value) * 60;
		this.state.timeLeft = this.state.totalTime;
		this.timerLabel.textContent = 'Короткий перерыв';
		this.updateDisplay();
	}

	// Запуск длинного перерыва
	startLongBreak() {
		this.state.currentPhase = 'longBreak';
		this.state.totalTime =
			parseInt(this.settings.longBreakDuration.value) * 60;
		this.state.timeLeft = this.state.totalTime;
		this.timerLabel.textContent = 'Длинный перерыв';
		this.updateDisplay();
	}

	// Обновление статистики
	updateStatistics() {
		switch (this.state.currentPhase) {
			case 'work':
				this.statistics.workSessions++;
				break;
			case 'shortBreak':
				this.statistics.shortBreaks++;
				break;
			case 'longBreak':
				this.statistics.longBreaks++;
				break;
		}
		this.updateStatisticsDisplay();
		this.saveStatistics();
	}

	// Обновление отображения статистики
	updateStatisticsDisplay() {
		this.workSessionsCount.textContent = this.statistics.workSessions;
		this.shortBreaksCount.textContent = this.statistics.shortBreaks;
		this.longBreaksCount.textContent = this.statistics.longBreaks;
	}

	// Обновление визуального отображения таймера
	updateDisplay() {
		const minutes = Math.floor(this.state.timeLeft / 60);
		const seconds = this.state.timeLeft % 60;

		this.minutesDisplay.textContent = minutes.toString().padStart(2, '0');
		this.secondsDisplay.textContent = seconds.toString().padStart(2, '0');

		// Обновление прогресс-круга
		const circumference = 2 * Math.PI * 142; // радиус 142px
		const progress =
			(this.state.totalTime - this.state.timeLeft) / this.state.totalTime;
		const offset = circumference - progress * circumference;

		this.timerCircle.style.strokeDasharray = `${circumference} ${circumference}`;
		this.timerCircle.style.strokeDashoffset = offset;

		// Цвет в зависимости от фазы
		switch (this.state.currentPhase) {
			case 'work':
				this.timerCircle.style.stroke = '#FF6B6B';
				break;
			case 'shortBreak':
				this.timerCircle.style.stroke = '#4ECDC4';
				break;
			case 'longBreak':
				this.timerCircle.style.stroke = '#45B7D1';
				break;
		}

		// Анимация при завершении
		if (this.state.timeLeft === 0) {
			document.querySelector('.timer-circle').classList.add('finished');
			setTimeout(() => {
				document
					.querySelector('.timer-circle')
					.classList.remove('finished');
			}, 1000);
		}

		// Анимация тревоги при последних 10 секундах
		if (this.state.timeLeft <= 10 && this.state.timeLeft > 0) {
			document.querySelector('.timer-circle').classList.add('alarm');
		} else {
			document.querySelector('.timer-circle').classList.remove('alarm');
		}
	}

	// Воспроизведение звуков
	playSound(type) {
		if (!this.settings.enableSound.checked) return;

		const sound = type === 'tick' ? this.tickSound : this.alarmSound;
		if (sound) {
			sound.currentTime = 0;
			sound
				.play()
				.catch((e) => console.log('Не удалось воспроизвести звук:', e));
		}
	}

	// Показ уведомления браузера
	showNotification() {
		if (
			!this.settings.enableNotifications.checked ||
			Notification.permission !== 'granted'
		)
			return;

		const title = `Помодоро: ${this.getPhaseTitle()}`;
		const options = {
			body: this.getNotificationMessage(),
			icon: '/favicon.ico',
			badge: '/badge-icon.png',
			tag: 'pomodoro-timer',
			requireInteraction: true,
			actions: [
				{ action: 'continue', title: 'Продолжить' },
				{ action: 'close', title: 'Закрыть' },
			],
		};

		const notification = new Notification(title, options);

		notification.onclick = () => {
			window.focus();
			notification.close();
		};

		// Автозакрытие через 10 секунд
		setTimeout(() => {
			notification.close();
		}, 10000);
	}

	// Получение заголовка фазы для уведомления
	getPhaseTitle() {
		switch (this.state.currentPhase) {
			case 'work':
				return 'Рабочая сессия завершена!';
			case 'shortBreak':
				return 'Короткий перерыв завершен!';
			case 'longBreak':
				return 'Длинный перерыв завершен!';
			default:
				return 'Таймер завершен!';
		}
	}

	// Получение сообщения для уведомления
	getNotificationMessage() {
		switch (this.state.currentPhase) {
			case 'work':
				return 'Время сосредоточиться! Начните следующую рабочую сессию.';
			case 'shortBreak':
				return 'Время отдохнуть! Начните короткий перерыв.';
			case 'longBreak':
				return 'Отличная работа! Наслаждайтесь длинным перерывом.';
			default:
				return 'Таймер завершен!';
		}
	}

	// Получение данных для экспорта статистики
	exportStatistics() {
		return {
			statistics: this.statistics,
			settings: Object.keys(this.settings).reduce((acc, key) => {
				if (this.settings[key].type === 'checkbox') {
					acc[key] = this.settings[key].checked;
				} else {
					acc[key] =
						parseInt(this.settings[key].value) ||
						this.settings[key].value;
				}
				return acc;
			}, {}),
			exportDate: new Date().toISOString(),
		};
	}

	// Импорт настроек и статистики
	importData(data) {
		if (data.statistics) {
			this.statistics = { ...this.statistics, ...data.statistics };
			this.updateStatisticsDisplay();
			this.saveStatistics();
		}

		if (data.settings) {
			Object.keys(data.settings).forEach((key) => {
				if (this.settings[key]) {
					if (this.settings[key].type === 'checkbox') {
						this.settings[key].checked = data.settings[key];
					} else {
						this.settings[key].value = data.settings[key];
					}
				}
			});
			this.saveSettings();
			this.updateTimerFromSettings();
		}
	}
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
	const pomodoroTimer = new PomodoroTimer();

	// Добавление глобальной ссылки для отладки (можно удалить в продакшене)
	window.pomodoroTimer = pomodoroTimer;

	// Обработка ошибок
	window.addEventListener('error', (e) => {
		console.error('Ошибка в приложении Помодоро:', e.error);
	});

	// Предотвращение случайного закрытия страницы во время сессии
	window.addEventListener('beforeunload', (e) => {
		if (pomodoroTimer.state.isRunning) {
			e.preventDefault();
			e.returnValue =
				'Таймер запущен. Вы уверены, что хотите покинуть страницу?';
		}
	});
});
