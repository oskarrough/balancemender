import Pino from 'pino'
import {html} from './utils'

interface LogEvent {
	level: {label: string, value: number}
	messages: (string | number | object)[]
	ts: number
}

const logs: LogEvent[] = []

const formatter = new Intl.DateTimeFormat('de', {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	fractionalSecondDigits: 2, // include milliseconds
})

function formatTimestamp(timestamp: number) {
	return formatter.format(new Date(timestamp))
}

export function createLogger(logLevel?: string, renderToDom = true) {
	const logger = Pino({
		browser: {
			transmit: {
				send(_level, logEvent) {
					logs.push(logEvent)
					if (renderToDom) afterLog(logEvent)
				},
			},
		},
	})
	if (logLevel) logger.level = logLevel
	return logger
}

function afterLog(log: LogEvent) {
	const el = document.querySelector('.Combatlog ul')
	if (!el) {
		console.warn('Failed to render log event. Missing container element', log)
		return
	}
	const li = html`
		<li class=${log.level.label}>
			<em>${log.level.label}</em>
			<time>${formatTimestamp(log.ts)}</time>
			<span>${log.messages.map((msg) => html`<span>${msg}</span>`)}</span>
		</li>
	`.toDOM()
	el.appendChild(li)
	el.scrollTop = el.scrollHeight
}
