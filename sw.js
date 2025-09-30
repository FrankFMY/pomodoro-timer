/**
 * Service Worker для Помодоро таймера
 * Обеспечивает фоновую работу таймера и уведомления даже при закрытой вкладке
 */

const CACHE_NAME = 'pomodoro-timer-v1';
const urlsToCache = [
	'/',
	'/index.html',
	'/styles/style.css',
	'/scripts/app.js',
	'/scripts/sw-register.js',
	'/manifest.json',
];

// Установка Service Worker
self.addEventListener('install', (event) => {
	console.log('Service Worker: Установка...');

	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				console.log('Service Worker: Кэширование ресурсов');
				return cache.addAll(urlsToCache);
			})
			.then(() => {
				console.log('Service Worker: Установка завершена');
				// Пропустить ожидание и активировать сразу
				return self.skipWaiting();
			})
	);
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
	console.log('Service Worker: Активация...');

	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME) {
							console.log(
								'Service Worker: Удаление старого кэша',
								cacheName
							);
							return caches.delete(cacheName);
						}
					})
				);
			})
			.then(() => {
				console.log('Service Worker: Активация завершена');
				// Принять контроль над всеми клиентами
				return self.clients.claim();
			})
	);
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
	// Пропустить кросс-доменные запросы
	if (!event.request.url.startsWith(self.location.origin)) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((response) => {
			// Возвращаем кэшированный ответ, если он есть
			if (response) {
				return response;
			}

			// Иначе делаем сетевой запрос
			return fetch(event.request).then((response) => {
				// Проверяем, что получили корректный ответ
				if (
					!response ||
					response.status !== 200 ||
					response.type !== 'basic'
				) {
					return response;
				}

				// Клонируем ответ для кэша
				const responseToCache = response.clone();

				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			});
		})
	);
});

// Обработка уведомлений
self.addEventListener('notificationclick', (event) => {
	console.log('Service Worker: Клик по уведомлению');

	event.notification.close();

	// Открываем приложение
	event.waitUntil(
		self.clients.matchAll({ type: 'window' }).then((clients) => {
			// Если окно уже открыто, фокусируемся на нём
			for (let client of clients) {
				if (client.url === '/' && 'focus' in client) {
					return client.focus();
				}
			}

			// Иначе открываем новое окно
			if (self.clients.openWindow) {
				return self.clients.openWindow('/');
			}
		})
	);
});

// Обработка сообщений от основного приложения
self.addEventListener('message', (event) => {
	console.log('Service Worker: Получено сообщение', event.data);

	if (event.data && event.data.type === 'TIMER_ALARM') {
		// Показываем уведомление о завершении таймера
		const { phase, title, body } = event.data;

		const options = {
			body: body,
			icon: '/favicon.ico',
			badge: '/badge-icon.png',
			tag: 'pomodoro-timer-alarm',
			requireInteraction: true,
			actions: [
				{ action: 'continue', title: 'Продолжить' },
				{ action: 'close', title: 'Закрыть' },
			],
			data: { phase: phase },
		};

		self.registration.showNotification(title, options);
	}
});

// Фоновая синхронизация (если поддерживается)
self.addEventListener('sync', (event) => {
	if (event.tag === 'background-sync') {
		event.waitUntil(doBackgroundSync());
	}
});

async function doBackgroundSync() {
	console.log('Service Worker: Фоновая синхронизация');
	// Здесь можно добавить логику для синхронизации данных с сервером
	// Пока просто логируем
}
