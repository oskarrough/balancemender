/**
 * Where a piece of ability art lives. Auras take their caster ability's id, so the same slug rule
 * gets a Renew chip on a unit frame and the Renew button in the action bar to the same file.
 */
export function spellIconPath(slug: string) {
	return `/assets/generated/spells/${slug.toLowerCase().replaceAll(' ', '-')}.png`
}
