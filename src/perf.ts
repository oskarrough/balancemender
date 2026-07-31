/**
 * Frame timing. Every sample is a `performance.now()` pair kept in a ring buffer, so measuring
 * costs two clock reads and an array write — cheap enough to leave on in the real game, which is
 * the point: numbers from a build nobody plays are not numbers about the game.
 *
 * `window.perf.report()` in the browser console (or `agent-browser eval`) prints the table.
 */

const SAMPLES = 240 // ~4s of frames at 60fps — long enough to hold a whole burst

class Series {
	samples: number[] = []
	next = 0

	add(ms: number) {
		this.samples[this.next] = ms
		this.next = (this.next + 1) % SAMPLES
	}

	stats() {
		const sorted = [...this.samples].sort((a, b) => a - b)
		if (!sorted.length) return null
		const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
		return {
			count: sorted.length,
			mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
			p50: at(0.5),
			p95: at(0.95),
			max: sorted[sorted.length - 1],
		}
	}
}

const series = new Map<string, Series>()

/** Time `fn` under `label` and return whatever it returned. */
export function measure<T>(label: string, fn: () => T): T {
	const start = performance.now()
	try {
		return fn()
	} finally {
		const s = series.get(label) ?? new Series()
		series.set(label, s)
		s.add(performance.now() - start)
	}
}

/** Time the gap between successive calls under `label` — for frame intervals. */
const lastMark = new Map<string, number>()
export function interval(label: string) {
	const now = performance.now()
	const last = lastMark.get(label)
	lastMark.set(label, now)
	if (last === undefined) return
	const s = series.get(label) ?? new Series()
	series.set(label, s)
	s.add(now - last)
}

export function stats(label: string) {
	return series.get(label)?.stats() ?? null
}

export function reset() {
	series.clear()
	lastMark.clear()
}

/** Every series as rounded numbers, ready for `console.table`. */
export function report() {
	const rows: Record<string, unknown> = {}
	for (const [label, s] of series) {
		const st = s.stats()
		if (!st) continue
		const round = (n: number) => Math.round(n * 100) / 100
		rows[label] = {
			count: st.count,
			mean: round(st.mean),
			p50: round(st.p50),
			p95: round(st.p95),
			max: round(st.max),
		}
	}
	return rows
}
