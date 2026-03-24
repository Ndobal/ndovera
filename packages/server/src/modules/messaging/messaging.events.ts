type MessagingStreamEvent =
	| { type: 'connected'; timestamp: string }
	| { type: 'contacts_changed'; timestamp: string; reason?: 'presence' | 'thread' | 'system' }
	| { type: 'thread_changed'; timestamp: string; peerId: string }
	| { type: 'typing_changed'; timestamp: string; peerId: string; isTyping: boolean };

type MessagingEventListener = (event: MessagingStreamEvent) => void;

const listenersByUser = new Map<string, Set<MessagingEventListener>>();

function getListeners(userId: string) {
	let listeners = listenersByUser.get(userId);
	if (!listeners) {
		listeners = new Set<MessagingEventListener>();
		listenersByUser.set(userId, listeners);
	}
	return listeners;
}

export function getMessagingConnectionCount(userId: string) {
	return listenersByUser.get(userId)?.size || 0;
}

export function subscribeMessagingEvents(userId: string, listener: MessagingEventListener) {
	const listeners = getListeners(userId);
	listeners.add(listener);
	return {
		connectionCount: listeners.size,
		unsubscribe() {
			const current = listenersByUser.get(userId);
			if (!current) return;
			current.delete(listener);
			if (current.size === 0) listenersByUser.delete(userId);
		},
	};
}

export function publishMessagingEvent(userId: string, event: MessagingStreamEvent) {
	const listeners = listenersByUser.get(userId);
	if (!listeners || listeners.size === 0) return;
	for (const listener of listeners) listener(event);
}

export function publishMessagingEventToUsers(userIds: Iterable<string>, event: MessagingStreamEvent) {
	const delivered = new Set<string>();
	for (const userId of userIds) {
		if (!userId || delivered.has(userId)) continue;
		delivered.add(userId);
		publishMessagingEvent(userId, event);
	}
}

export function broadcastMessagingEvent(event: MessagingStreamEvent) {
	for (const listeners of listenersByUser.values()) {
		for (const listener of listeners) listener(event);
	}
}