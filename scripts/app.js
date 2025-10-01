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
		this.timerCircleContainer = document.querySelector('.timer-circle');
		this.minutesDisplay = document.querySelector('.minutes');
		this.secondsDisplay = document.querySelector('.seconds');
		this.timerLabel = document.querySelector('.timer-label');
		this.timerAnnouncement = document.getElementById('timerAnnouncement');

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

		// Web Audio API контекст для звуков
		this.audioContext = null;
		this.initAudioContext();

		// Состояние таймера
		this.state = {
			isRunning: false,
			isPaused: false,
			currentPhase: 'work', // 'work', 'shortBreak', 'longBreak'
			timeLeft: 25 * 60, // в секундах
			totalTime: 25 * 60,
			intervalId: null,
			startTime: null, // timestamp начала таймера
			pausedTime: 0, // сколько времени было на паузе
			lastTickMinute: -1, // для предотвращения дублирования tick звука
		};

		// Статистика сессий
		this.statistics = {
			workSessions: 0,
			shortBreaks: 0,
			longBreaks: 0,
		};
	}

	// Инициализация Web Audio API
	initAudioContext() {
		try {
			this.audioContext = new (window.AudioContext ||
				window.webkitAudioContext)();
		} catch (e) {
			console.warn('Web Audio API не поддерживается:', e);
		}
	}

	// Валидация числового значения
	validateNumber(value, min, max, defaultValue) {
		const num = parseInt(value);
		if (isNaN(num) || num < min || num > max) {
			return defaultValue;
		}
		return num;
	}

	// Загрузка настроек из localStorage
	loadSettings() {
		try {
			const savedSettings = localStorage.getItem('pomodoroSettings');
			if (!savedSettings) return;

			const settings = JSON.parse(savedSettings);
			if (!settings || typeof settings !== 'object') return;

			// Валидация и применение настроек
			if (settings.workDuration !== undefined) {
				this.settings.workDuration.value = this.validateNumber(
					settings.workDuration,
					1,
					60,
					25
				);
			}
			if (settings.shortBreakDuration !== undefined) {
				this.settings.shortBreakDuration.value = this.validateNumber(
					settings.shortBreakDuration,
					1,
					30,
					5
				);
			}
			if (settings.longBreakDuration !== undefined) {
				this.settings.longBreakDuration.value = this.validateNumber(
					settings.longBreakDuration,
					1,
					60,
					15
				);
			}
			if (settings.sessionsUntilLongBreak !== undefined) {
				this.settings.sessionsUntilLongBreak.value =
					this.validateNumber(
						settings.sessionsUntilLongBreak,
						2,
						8,
						4
					);
			}
			if (settings.enableNotifications !== undefined) {
				this.settings.enableNotifications.checked =
					!!settings.enableNotifications;
			}
			if (settings.enableSound !== undefined) {
				this.settings.enableSound.checked = !!settings.enableSound;
			}
		} catch (e) {
			console.warn('Ошибка загрузки настроек:', e);
			localStorage.removeItem('pomodoroSettings');
		}
	}

	// Сохранение настроек в localStorage
	saveSettings() {
		try {
			const settings = {
				workDuration: this.validateNumber(
					this.settings.workDuration.value,
					1,
					60,
					25
				),
				shortBreakDuration: this.validateNumber(
					this.settings.shortBreakDuration.value,
					1,
					30,
					5
				),
				longBreakDuration: this.validateNumber(
					this.settings.longBreakDuration.value,
					1,
					60,
					15
				),
				sessionsUntilLongBreak: this.validateNumber(
					this.settings.sessionsUntilLongBreak.value,
					2,
					8,
					4
				),
				enableNotifications: this.settings.enableNotifications.checked,
				enableSound: this.settings.enableSound.checked,
			};
			localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
		} catch (e) {
			console.warn('Ошибка сохранения настроек:', e);
		}
	}

	// Загрузка статистики из localStorage
	loadStatistics() {
		try {
			const savedStats = localStorage.getItem('pomodoroStatistics');
			if (!savedStats) {
				this.updateStatisticsDisplay();
				return;
			}

			const stats = JSON.parse(savedStats);
			if (!stats || typeof stats !== 'object') {
				this.updateStatisticsDisplay();
				return;
			}

			// Валидация статистики
			this.statistics = {
				workSessions: Math.max(0, parseInt(stats.workSessions) || 0),
				shortBreaks: Math.max(0, parseInt(stats.shortBreaks) || 0),
				longBreaks: Math.max(0, parseInt(stats.longBreaks) || 0),
			};
			this.updateStatisticsDisplay();
		} catch (e) {
			console.warn('Ошибка загрузки статистики:', e);
			localStorage.removeItem('pomodoroStatistics');
			this.updateStatisticsDisplay();
		}
	}

	// Сохранение статистики в localStorage
	saveStatistics() {
		try {
			localStorage.setItem(
				'pomodoroStatistics',
				JSON.stringify(this.statistics)
			);
		} catch (e) {
			console.warn('Ошибка сохранения статистики:', e);
		}
	}

	// Привязка событий
	bindEvents() {
		// Кнопки управления таймером
		this.startBtn.addEventListener('click', () => this.startTimer());
		this.pauseBtn.addEventListener('click', () => this.pauseTimer());
		this.resetBtn.addEventListener('click', () => this.resetTimer());

		// Keyboard shortcuts
		document.addEventListener('keydown', (e) => {
			// Игнорируем если фокус в input
			if (
				e.target.tagName === 'INPUT' ||
				e.target.tagName === 'TEXTAREA'
			) {
				return;
			}

			switch (e.key.toLowerCase()) {
				case ' ': // Space - старт/пауза
				case 'p': // P - пауза
					e.preventDefault();
					if (this.state.isRunning) {
						this.pauseTimer();
					} else {
						this.startTimer();
					}
					break;
				case 'r': // R - сброс
					e.preventDefault();
					this.resetTimer();
					break;
				case 's': // S - старт
					e.preventDefault();
					if (!this.state.isRunning) {
						this.startTimer();
					}
					break;
			}
		});

		// Сохранение настроек при изменении
		Object.keys(this.settings).forEach((key) => {
			this.settings[key].addEventListener('change', () => {
				this.saveSettings();
				if (!this.state.isRunning) {
					this.updateTimerFromSettings();
				}
			});
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
		const duration = this.validateNumber(
			this.settings.workDuration.value,
			1,
			60,
			25
		);
		this.state.totalTime = duration * 60;
		this.state.timeLeft = this.state.totalTime;
		this.state.currentPhase = 'work';
		this.state.lastTickMinute = -1;
		if (this.timerLabel) {
			this.timerLabel.textContent = 'Рабочая сессия';
		}
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

	// Объявление для скрин-ридеров
	announceToScreenReader(message) {
		if (this.timerAnnouncement) {
			this.timerAnnouncement.textContent = message;
		}
	}

	// Запуск таймера
	startTimer() {
		if (this.state.isRunning) return;

		this.state.isRunning = true;
		this.state.isPaused = false;

		// Устанавливаем время старта с учётом паузы
		this.state.startTime = Date.now() - this.state.pausedTime * 1000;

		this.startBtn.disabled = true;
		this.pauseBtn.disabled = false;

		// Используем requestAnimationFrame для более плавной анимации
		const tick = () => {
			if (!this.state.isRunning) return;
			this.tick();
			this.state.intervalId = requestAnimationFrame(tick);
		};
		this.state.intervalId = requestAnimationFrame(tick);

		this.updateDisplay();
		this.announceToScreenReader(
			`Таймер запущен. ${this.timerLabel.textContent}`
		);
	}

	// Пауза таймера
	pauseTimer() {
		if (!this.state.isRunning) return;

		this.state.isRunning = false;
		this.state.isPaused = true;

		// Сохраняем сколько времени прошло
		this.state.pausedTime = this.state.totalTime - this.state.timeLeft;

		if (this.state.intervalId) {
			cancelAnimationFrame(this.state.intervalId);
			this.state.intervalId = null;
		}

		this.startBtn.disabled = false;
		this.pauseBtn.disabled = true;

		const minutes = Math.floor(this.state.timeLeft / 60);
		const seconds = this.state.timeLeft % 60;
		this.announceToScreenReader(
			`Таймер на паузе. Осталось ${minutes} минут ${seconds} секунд`
		);
	}

	// Сброс таймера
	resetTimer() {
		this.pauseTimer();

		// Возврат к рабочей сессии
		this.state.currentPhase = 'work';
		const duration = this.validateNumber(
			this.settings.workDuration.value,
			1,
			60,
			25
		);
		this.state.totalTime = duration * 60;
		this.state.timeLeft = this.state.totalTime;
		this.state.startTime = null;
		this.state.pausedTime = 0;
		this.state.lastTickMinute = -1;

		this.startBtn.disabled = false;
		this.resetBtn.disabled = false;

		this.updateDisplay();
		this.announceToScreenReader('Таймер сброшен. Рабочая сессия.');
	}

	// Основной тик таймера
	tick() {
		// Вычисляем оставшееся время на основе timestamp
		const elapsed = Math.floor((Date.now() - this.state.startTime) / 1000);
		this.state.timeLeft = Math.max(0, this.state.totalTime - elapsed);

		if (this.state.timeLeft <= 0) {
			this.handleTimerComplete();
			return;
		}

		this.updateDisplay();

		// Звуковой сигнал каждую минуту (предотвращаем дублирование)
		const currentMinute = Math.floor(this.state.timeLeft / 60);
		if (
			this.state.timeLeft % 60 === 0 &&
			this.state.timeLeft > 0 &&
			this.settings.enableSound &&
			this.settings.enableSound.checked &&
			this.state.lastTickMinute !== currentMinute
		) {
			this.state.lastTickMinute = currentMinute;
			this.playSound('tick');
		}
	}

	// Обработка завершения таймера
	handleTimerComplete() {
		// Останавливаем текущий таймер
		if (this.state.intervalId) {
			cancelAnimationFrame(this.state.intervalId);
			this.state.intervalId = null;
		}

		this.playSound('alarm');
		this.showNotification();

		// Обновление статистики
		this.updateStatistics();

		// Объявление завершения
		this.announceToScreenReader(
			`${this.getPhaseTitle()} Переход к следующей фазе.`
		);

		// Переход к следующей фазе
		this.nextPhase();
	}

	// Переход к следующей фазе
	nextPhase() {
		switch (this.state.currentPhase) {
			case 'work':
				const sessionsUntilLongBreak = this.validateNumber(
					this.settings.sessionsUntilLongBreak.value,
					2,
					8,
					4
				);
				// Длинный перерыв после N завершённых рабочих сессий
				if (
					this.statistics.workSessions > 0 &&
					this.statistics.workSessions % sessionsUntilLongBreak === 0
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
		// Сохраняем флаг автозапуска перед сбросом
		const shouldAutoStart = this.state.isRunning;

		this.state.currentPhase = 'work';
		const duration = this.validateNumber(
			this.settings.workDuration.value,
			1,
			60,
			25
		);
		this.state.totalTime = duration * 60;
		this.state.timeLeft = this.state.totalTime;
		this.state.startTime = null;
		this.state.pausedTime = 0;
		this.state.lastTickMinute = -1;
		this.state.isRunning = false; // Сброс для корректного startTimer()
		this.timerLabel.textContent = 'Рабочая сессия';
		this.updateDisplay();

		// Автозапуск таймера если переходим от завершённой фазы
		if (shouldAutoStart) {
			this.startTimer();
		}
	}

	// Запуск короткого перерыва
	startShortBreak() {
		// Сохраняем флаг автозапуска перед сбросом
		const shouldAutoStart = this.state.isRunning;

		this.state.currentPhase = 'shortBreak';
		const duration = this.validateNumber(
			this.settings.shortBreakDuration.value,
			1,
			30,
			5
		);
		this.state.totalTime = duration * 60;
		this.state.timeLeft = this.state.totalTime;
		this.state.startTime = null;
		this.state.pausedTime = 0;
		this.state.lastTickMinute = -1;
		this.state.isRunning = false; // Сброс для корректного startTimer()
		this.timerLabel.textContent = 'Короткий перерыв';
		this.updateDisplay();

		// Автозапуск таймера если переходим от завершённой фазы
		if (shouldAutoStart) {
			this.startTimer();
		}
	}

	// Запуск длинного перерыва
	startLongBreak() {
		// Сохраняем флаг автозапуска перед сбросом
		const shouldAutoStart = this.state.isRunning;

		this.state.currentPhase = 'longBreak';
		const duration = this.validateNumber(
			this.settings.longBreakDuration.value,
			1,
			60,
			15
		);
		this.state.totalTime = duration * 60;
		this.state.timeLeft = this.state.totalTime;
		this.state.startTime = null;
		this.state.pausedTime = 0;
		this.state.lastTickMinute = -1;
		this.state.isRunning = false; // Сброс для корректного startTimer()
		this.timerLabel.textContent = 'Длинный перерыв';
		this.updateDisplay();

		// Автозапуск таймера если переходим от завершённой фазы
		if (shouldAutoStart) {
			this.startTimer();
		}
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
		if (this.workSessionsCount) {
			this.workSessionsCount.textContent = this.statistics.workSessions;
		}
		if (this.shortBreaksCount) {
			this.shortBreaksCount.textContent = this.statistics.shortBreaks;
		}
		if (this.longBreaksCount) {
			this.longBreaksCount.textContent = this.statistics.longBreaks;
		}
	}

	// Обновление визуального отображения таймера
	updateDisplay() {
		const minutes = Math.floor(this.state.timeLeft / 60);
		const seconds = this.state.timeLeft % 60;

		if (this.minutesDisplay) {
			this.minutesDisplay.textContent = minutes
				.toString()
				.padStart(2, '0');
		}
		if (this.secondsDisplay) {
			this.secondsDisplay.textContent = seconds
				.toString()
				.padStart(2, '0');
		}

		// Обновление прогресс-круга
		if (this.timerCircle) {
			const circumference = 2 * Math.PI * 142; // радиус 142px
			const progress =
				this.state.totalTime > 0
					? (this.state.totalTime - this.state.timeLeft) /
					  this.state.totalTime
					: 0;
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
		}

		// Анимация при завершении (используем кэшированную ссылку)
		if (this.timerCircleContainer) {
			if (this.state.timeLeft === 0) {
				this.timerCircleContainer.classList.add('finished');
				setTimeout(() => {
					if (this.timerCircleContainer) {
						this.timerCircleContainer.classList.remove('finished');
					}
				}, 1000);
			}

			// Анимация тревоги при последних 10 секундах
			if (this.state.timeLeft <= 10 && this.state.timeLeft > 0) {
				this.timerCircleContainer.classList.add('alarm');
			} else {
				this.timerCircleContainer.classList.remove('alarm');
			}
		}
	}

	// Воспроизведение звуков через Web Audio API
	playSound(type) {
		if (
			!this.settings.enableSound ||
			!this.settings.enableSound.checked ||
			!this.audioContext
		)
			return;

		try {
			// Возобновляем контекст если он приостановлен
			if (this.audioContext.state === 'suspended') {
				this.audioContext.resume();
			}

			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(this.audioContext.destination);

			if (type === 'tick') {
				// Короткий клик для tick
				oscillator.frequency.value = 800;
				oscillator.type = 'sine';
				gainNode.gain.setValueAtTime(
					0.3,
					this.audioContext.currentTime
				);
				gainNode.gain.exponentialRampToValueAtTime(
					0.01,
					this.audioContext.currentTime + 0.1
				);
				oscillator.start(this.audioContext.currentTime);
				oscillator.stop(this.audioContext.currentTime + 0.1);
			} else {
				// Alarm - три последовательных звука
				oscillator.frequency.value = 880;
				oscillator.type = 'square';
				gainNode.gain.setValueAtTime(
					0.2,
					this.audioContext.currentTime
				);
				gainNode.gain.setValueAtTime(
					0,
					this.audioContext.currentTime + 0.1
				);
				gainNode.gain.setValueAtTime(
					0.2,
					this.audioContext.currentTime + 0.15
				);
				gainNode.gain.setValueAtTime(
					0,
					this.audioContext.currentTime + 0.25
				);
				gainNode.gain.setValueAtTime(
					0.2,
					this.audioContext.currentTime + 0.3
				);
				gainNode.gain.exponentialRampToValueAtTime(
					0.01,
					this.audioContext.currentTime + 0.5
				);
				oscillator.start(this.audioContext.currentTime);
				oscillator.stop(this.audioContext.currentTime + 0.5);
			}
		} catch (e) {
			console.log('Не удалось воспроизвести звук:', e);
		}
	}

	// Показ уведомления браузера
	showNotification() {
		if (
			!this.settings.enableNotifications ||
			!this.settings.enableNotifications.checked ||
			!('Notification' in window) ||
			Notification.permission !== 'granted'
		)
			return;

		try {
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
		} catch (e) {
			console.warn('Не удалось показать уведомление:', e);
		}
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
		// Сообщение о следующей фазе, а не завершённой
		switch (this.state.currentPhase) {
			case 'work':
				return 'Время отдохнуть! Начните перерыв.';
			case 'shortBreak':
			case 'longBreak':
				return 'Время сосредоточиться! Начните следующую рабочую сессию.';
			default:
				return 'Таймер завершен!';
		}
	}

	// Получение данных для экспорта статистики
	exportStatistics() {
		return {
			statistics: this.statistics,
			settings: {
				workDuration: this.validateNumber(
					this.settings.workDuration.value,
					1,
					60,
					25
				),
				shortBreakDuration: this.validateNumber(
					this.settings.shortBreakDuration.value,
					1,
					30,
					5
				),
				longBreakDuration: this.validateNumber(
					this.settings.longBreakDuration.value,
					1,
					60,
					15
				),
				sessionsUntilLongBreak: this.validateNumber(
					this.settings.sessionsUntilLongBreak.value,
					2,
					8,
					4
				),
				enableNotifications: this.settings.enableNotifications.checked,
				enableSound: this.settings.enableSound.checked,
			},
			exportDate: new Date().toISOString(),
		};
	}

	// Импорт настроек и статистики
	importData(data) {
		if (data.statistics) {
			// Валидация статистики перед импортом
			this.statistics = {
				workSessions: Math.max(
					0,
					parseInt(data.statistics.workSessions) || 0
				),
				shortBreaks: Math.max(
					0,
					parseInt(data.statistics.shortBreaks) || 0
				),
				longBreaks: Math.max(
					0,
					parseInt(data.statistics.longBreaks) || 0
				),
			};
			this.updateStatisticsDisplay();
			this.saveStatistics();
		}

		if (data.settings) {
			// Валидация настроек перед импортом
			if (data.settings.workDuration !== undefined) {
				this.settings.workDuration.value = this.validateNumber(
					data.settings.workDuration,
					1,
					60,
					25
				);
			}
			if (data.settings.shortBreakDuration !== undefined) {
				this.settings.shortBreakDuration.value = this.validateNumber(
					data.settings.shortBreakDuration,
					1,
					30,
					5
				);
			}
			if (data.settings.longBreakDuration !== undefined) {
				this.settings.longBreakDuration.value = this.validateNumber(
					data.settings.longBreakDuration,
					1,
					60,
					15
				);
			}
			if (data.settings.sessionsUntilLongBreak !== undefined) {
				this.settings.sessionsUntilLongBreak.value =
					this.validateNumber(
						data.settings.sessionsUntilLongBreak,
						2,
						8,
						4
					);
			}
			if (data.settings.enableNotifications !== undefined) {
				this.settings.enableNotifications.checked =
					!!data.settings.enableNotifications;
			}
			if (data.settings.enableSound !== undefined) {
				this.settings.enableSound.checked = !!data.settings.enableSound;
			}
			this.saveSettings();
			this.updateTimerFromSettings();
		}
	}
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
	const pomodoroTimer = new PomodoroTimer();

	// Обработка ошибок
	window.addEventListener('error', (e) => {
		console.error('Ошибка в приложении Помодоро:', e.error);
	});

	// Предотвращение случайного закрытия страницы во время сессии
	// Современные браузеры показывают стандартное сообщение
	window.addEventListener('beforeunload', (e) => {
		if (pomodoroTimer.state.isRunning) {
			e.preventDefault();
			// Стандартное значение для совместимости
			e.returnValue = '';
		}
	});
});
