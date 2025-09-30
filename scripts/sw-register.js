/**
 * Регистрация Service Worker для Помодоро таймера
 * Обеспечивает фоновую работу таймера и уведомления
 */

if ('serviceWorker' in navigator) {
	window.addEventListener('load', async () => {
		try {
			const registration = await navigator.serviceWorker.register(
				'/sw.js'
			);
			console.log(
				'Service Worker зарегистрирован успешно:',
				registration.scope
			);

			// Обработка обновлений Service Worker
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (newWorker) {
					newWorker.addEventListener('statechange', () => {
						if (
							newWorker.state === 'installed' &&
							navigator.serviceWorker.controller
						) {
							// Новый Service Worker установлен, предложить обновление
							if (
								confirm(
									'Доступно обновление приложения. Обновить сейчас?'
								)
							) {
								window.location.reload();
							}
						}
					});
				}
			});
		} catch (error) {
			console.log('Ошибка регистрации Service Worker:', error);
		}
	});
}
