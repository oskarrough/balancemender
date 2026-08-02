# The Universe

A living draft — we are still jabbing at this together. Nothing here is canon until it survives a few
more rounds. When it settles, one sentence of it graduates to the README.

This doc is the mood: the world, its four countries, the people in them, and the words we use. What a
painting literally depicts lives with the painting — every prompt is in `assets/image-assets.json`
(`bun run asset:prompt -- <id>`), and how art gets made is [asset-pipeline.md](./asset-pipeline.md).
Who fights in which room lives in `src/nodes/dungeon.ts`. Neither is repeated here.

## The one world

Balance Mender happens in a single universe, not an anthology of biomes. It starts pastoral and gets
stranger the further you walk — Ghibli warmth sliding into Moebius silence. Nothing out there is
evil. The land's balance is disturbed, and every creature you fight is inflamed by it — agitated,
overgrown, out of tune. You are a mender walking toward the wound, and even fighting is mending:
when a creature's health reaches zero, the inflammation breaks — not the animal. It slumps, breathes
evenly for the first time in the fight, and limps off. Mending your allies and subduing your enemies
are the same gesture from opposite sides: restoring flow to something blocked.

Nothing here is taken from. The healing only looks one-way: Oak's shield is why you have the seconds
to cast in, Wren's sling is why a fight ends before your mana does, the enemy you subdue keeps its
life, and the river you give its flow back to is the road you walk on. That mutualism is the floor
under the soft combat premise — an enemy at zero settles not out of mercy, but because this world has
no transactions in it. Nothing outward-facing says so, because nothing mechanises it yet; mana flows
out of the mender and nothing flows back in. If an ability, a person or a dungeon ever hands the
mender something back, it comes from here.

Touchstones, each with the thing we steal from it:

- **Ghibli** — warmth without safety: bystanders with their own business, creatures that are
  animals not monsters, no villains. Nausicaä's jungle is beautiful _and_ toxic at once; Mononoke's
  boars are our enemies exactly — maddened by a wound, not wicked.
- **Moebius** — silence, flat color fields, vast negative space, and proper nouns dropped without
  explanation (_Arzach_ never explains itself; neither does the old tongue). The Nettle icon prompt
  asks for "late-1970s French science-fiction comic mood" — it did so back when the spell was still
  called Wither; the universe was leaking in before we named it.
- **Hiro Isono** — dense luminous botany, vegetation as cathedral (the splash wallpaper already in
  `public/assets/` is his). The Glow lives entirely in this register.
- **Warhammer** — totality and unforgettable persons. Sigmar's realms are named as concepts and
  sized like weather, which is where The Green and The Rust already live. The Old World teaches the
  other half: Grimgor Ironhide is unforgettable because his name is a plain fact about his body, not
  a title granted to him. Steal the fact, never the epithet — that is why the Green's boss is Haruk
  and not Nakroth the Destroyer. Our persons should be as total as his and a tenth as loud.
- **Star Trek** — places named like phenomena encountered rather than places settled (the Badlands,
  the Expanse). This is where the color names come from: The Green, The Rust, The Glow, The White
  are what travelers would call them, half in awe.

## Death lives in the land, not in your hands

The soft combat premise is not a no-death universe. The Rust is a land dying of thirst; the
herders' beasts did not all get out; things upstream were dead before you ever arrived. The game
names death plainly and walks past it with respect — what it refuses is death as the player's
transaction, dispensed two hundred times an hour until it means nothing. Ghibli's softness works
exactly this way: Mononoke is soaked in death, and none of it is spectacle. No life without death;
no death as a reward sound.

The player-facing vocabulary (the code keeps `alive`, `kill` and `wipe` — that is the coders'
register, not the narrator's):

- An enemy reaching zero **settles** — the word disturbed water uses when balance returns.
  "The Skulker settles."
- A boss earns the full sentence: "The fever breaks. Haruk breathes evenly for the first time."
- A party member **falls** — knocked down, folk-plain, honestly not death. Defeat stays real.
- A room won is **Mended.** — the game's own verb, restated at every clear. Not "Victory!";
  that is a conqueror's word.

## The red thread: walking upstream

A river runs through all four dungeons, and its state is the story. In The Green it chatters along
beside the path. In The Rust you walk its dry bed — the water is _gone_, and that absence is the
first real clue. In The Glow the water returns wrong: glowing, thick, feeding growth that shouldn't
be. The White is the source itself. The whole game is one walk upstream, and healing is the same
gesture writ small — restoring flow to something blocked.

Two smaller threads run beside the river. A rider is always ahead of you: the silhouette
one-too-many on The Rust's horizon and the shape that keeps its distance in The White are the same
figure — Gale, who went ahead to see the source. And the masked pilgrims you pass in The Glow are
walking the other way, down from the First Water, so somebody has already been where you are going.

A room is a place, not a fight floating over a color field, and the land carries the story while the
unit frames carry the fight. The painting establishes the encounter rather than illustrating combat
literally: a narrow ford explains an animal holding the crossing, high cover explains an ambush,
circling birds explain why the weakest traveler is in danger. Adjacent rooms carry landmarks
forward — above all the river and the path beside it — so pressing Next feels like walking farther
into the same country.

Weirdness curve: familiar → familiar-but-off → lush-weird → sublime.

## The journey

Each dungeon owns one pressure, and that pressure is the progression. The six abilities you
already hold mean something different under each one:

1. **The Green — you learn your hands.** The kit arrives a room at a time. Shipped.
2. **The Rust — you learn to time.** Roha's toll cuts the cast you are in the middle of, so the
   fight has a rhythm you play around instead of a number you outheal. The cut itself is rehearsed
   before she arrives — fair warning, same shape as the Green's rooms that teach a button before
   they ask you to live on it.
3. **The Glow — you learn you are visible.** The sivi drift toward whoever glows brightest, and
   that is the healer. Healing draws attention; the threat table stops being the tank's private
   business.
4. **The White — you learn scarcity.** Thin air at a blocked source. Mana does not come back the
   way it did downstream, and the finale is one long fight out of a closing purse.

Two things grow as you walk, and neither is a bigger spellbook:

- **Company.** One more body beside you per dungeon. More bodies is more to keep standing — the
  difficulty and the story are the same curve, and by the White the party is a crowd of mud-boots
  under white stone, which is the whole point of them.
- **One ability per dungeon**, each answering that dungeon's pressure — something that survives an
  interruption, something that puts attention back where it belongs, something that stretches a last
  mouthful of mana. The Rust's is named: **Steep** (#81), the brew that pays out even when the cast
  carrying it is cut. The Glow's and the White's wait for their dungeons, register one holding —
  small warm words a village healer would use. The Green teaches Mend in its first quiet room and
  Patch when a burst first demands one (#71).
- **The mender's journal.** The player's own book of the walk, opened outside the fight: places
  mended, folk met, wounds tended, each room marked **Mended.** when it is. A record, not a trophy
  room. The craft is written in the same book — what your hands know, the page growing as the walk
  teaches it, never a spell book. Nothing is announced; a new page simply appears, found rather than
  pushed. When the walk is done it stays the place the endgame is decided from (#93, #83).

When the river is mended, the gating comes off: the mender chooses their own kit freely. You walked
the whole length of it — you have earned the right to decide what you carry.

## Three registers

Everything nameable speaks one of three languages, and which one tells you what it is:

1. **Your hands** — the player's abilities stay in plain, warm, small words. The kit in code speaks
   it now: Patch, Mend, Renew, Shield — and even the damage is the healer's craft, Lance (a
   boil, drained) and Nettle (a patient herbal sting). A village healer's trade, no mystique about
   itself.
2. **The map** — the dungeons are named for the color you are inside, nothing else: **The Green,
   The Rust, The Glow, The White**. Flat gouache color fields mean each dungeon _is_ a palette; the
   name just admits it. Room names within a dungeon are the narrator's voice — plain scene titles
   like "The stray pup".
3. **The living** — creatures and persons carry the old tongue, untranslated, on a gradient: in The
   Green your language still works (pup, snapjaw, skulker — folk-names for animals) and only the
   boss carries an old-tongue name, the first hint of depth. The further upstream, the fewer names
   translate. In The White, almost nothing does.

## The party

You are a village healer from the shire end of the map — your abilities are register one because
they are literally your hands, a craft learned at home. Everyone who walks with you is from that
same downstream world, and one joins per dungeon. They keep their language the whole way up, and
that is the point of them: the further upstream you get, the more out of place their mud-boots and
shield-straps look against the white stone. The party is the piece of home you carry into the
sublime.

Their names obey one law: **named for a plain thing of home** — a word you could point at. A bird, a
tree, ground, weather. The old tongue's first rule is never an English word hiding inside; these
break it on purpose by being nothing but the word, so the roster can never confuse one of them with
a guardian. And where the Green's animals wear what they _do_ (Snapjaw, Howler), these wear what
they are _like_. Each takes a different shelf of home.

- **Oak** — the shield-carrier, joins in the Green (#82). The tree you shelter under, which is the
  job. The class in code stays `Tank`; that is the coders' register.
- **Wren** — the herder, joins in the Rust (#76). Small, quick, never built for fighting, all of it
  audible in the name. Came back too late for the herd; the bell in the dry bed was theirs to hang.
- **Clover** — the beekeeper, joins in the Glow (#88). The meadow flower bees work all day, the
  trade audible in the name. A beekeeper's craft is standing veiled and calm while a cloud of
  stinging things drifts around you, and in the Glow that is the job: the sivi drift to whoever
  glows brightest, so the mender paints the heal-mark on Clover on purpose and Clover holds the
  drift.
- **Gale** — the messenger, joins in the White (#90). A plain thing you hear coming before you see
  it; the name says what they are like, always ahead. The rider who has kept their distance since
  the Rust's horizon — at the First Water they stop and let the party catch up.

## The old tongue

A sound-palette so invented names feel like cousins, not random fantasy syllables:

- Open vowels, sometimes doubled: a, o, u, i — _aa_, _uu_ for old or large things.
- Soft consonants carry the weight: m, n, l, r, v, s, h.
- At most one hard stop (k, t, g) per name — a spine, not armor. No harsh clusters (kr, th, zz).
- Hard stops thin out upstream: a Green name gets its full spine, a White name has none at all —
  pure vowel and breath. The journey should be audible in the names alone.
- Creatures get one or two syllables; persons and guardians get more.
- Never an English word hiding inside.

The names so far: the boss of The Green is **Haruk** — full k spine, a name a farmer could growl
(was Nakroth the Destroyer; the epithet was the cheese, and the first draft Orun sounded like
Uvalu's brother). In The Rust, a bell-creature called **Roha**. In The Glow, **muhl** (the sighing
puffballs), **sivi** (the wisps), and **Orovan**, the tall slow tender of mushrooms. In The White,
the source-keeper **Uvalu** — and the pilgrims' own word for the place, _the First Water_, the one
phrase of theirs anyone bothers to translate.

Orovan and Uvalu still sound like kin — deliberately, now: they are neighbors at the soft end of
the river, and the gradient rule says upstream names should be cousins of each other and strangers
to Haruk. Say them aloud before trusting them.

## 1. The Green — the edge of the map

The shire end of the universe (`TheGreen` in code). Dappled morning forest, a lively stream,
scrappy mud-flecked wolves — the pup you meet first sets the tone: this world's monsters are animals
having a bad day. The wolves keep their folk-names — Pup, Runt, Snapjaw, Skulker, Howler,
Denmother — and only the boss, Haruk, carries the old tongue: the first crack in the familiar.

- **Biome** — temperate forest edge, morning light, ferns and mossy stones, the stream loud nearby.
- **Creatures** — the wolf pack: pups, skulkers, a denmother who licks her pack's wounds closed.
  Fur, mud, teeth.
- **People** — a ranger's lean-to at the treeline; someone waved you in and won't follow. Oak waits
  where the path first has to cross the water.
- **Stimmung** — first day of an adventure. Sunny, scuffed knees, nothing truly wrong yet.
- **Sounds** — birdsong, running water, snapping twigs, panting, yips.
- **Tempo** — brisk and scrappy. Short fights, quick recoveries, the tutorial heartbeat.
- **The walk** — five successive views of one stream, from the ranger's camp still near enough to
  smell, through shoulder-high fern cover and a trampled pack hollow, to Haruk's fallen-log glade.
  Morning begins gold and open, then the canopy deepens toward the guardian without ever losing the
  blue-white thread of moving water.

## 2. The Rust — the land dries out

The trail out of the woods (`TheRust` in code). Open, dusty country under a huge afternoon sky,
everything oxidizing toward red-brown — and just slightly _off_. The riverbed you follow is dry. A
herder's bell rings with no herd in sight. The horizon has one silhouette too many — a rider, too
far to hail, gone when you look again. Moebius creeps in at the edges while the foreground stays
homey.

- **Biome** — dry golden grassland and scrub, a cracked riverbed as the road, lone twisted trees,
  rust-red rock starting to show through the soil.
- **Creatures** — the dry country keeps its own, and none of them are wolves. The **bellwether**,
  lead beast of a herd nobody came back for in time, still wearing its bell. A **wether** further
  along the bed, not the lead, just a leftover with enough metal to swing. **Kites** circling,
  dropping on whoever is worst off. **Chafers**, husk-shelled beetles in numbers. And Roha, whose
  bell you heard an hour ago — the point of the bellwether and the wether is that you meet a real
  animal wearing a real bell first, so that a bell with no animal inside it lands the way it should.
- **People** — a waystation with a creaking sign and a keeper who talks too much; herders who moved
  on early because "the water went" — and Wren, the one who came back, falling in at the waystation
  to see for themselves where the water went.
- **Stimmung** — high noon loneliness. Spacious, a little melancholy, the first wrongness.
- **Sounds** — dry wind, creaking wood, a distant bell, boots on cracked clay. Long silences.
- **Tempo** — loping. Fewer, spikier fights with room to breathe between them.
- **The walk** — the dry bed keeps the trample/shield lesson: a wind-up you can see coming, and
  beetles behind it drifting onto whoever is doing the healing. The long grass trades weight for
  numbers, so nobody can be left sitting low. The hung bell is the rehearsal — a **Bell swing** with
  the same wind-up and cut-cast as Roha's Toll, soft enough to survive the first surprise, so
  Steep's reason for existing is felt before the closer asks you to live on it (#84). Toll stays
  Roha's word, and she closes the dungeon alone (#72): the bell you have heard since the waystation,
  tolling on a slow telegraph that cuts whatever you are casting. Sound is the Rust's signature, so
  its closer is a fight you listen to.
- **What it asks of you** — harder than anything in The Green, and what it punishes is waste.
  Spamming the fast heal loses the dungeon outright where it used to carry the Green; the wind-up
  teaches you to shield before it lands rather than heal after; the rehearsed toll teaches you to
  stop casting before the sound and start again after — a rhythm, not a number.

## 3. The Glow — the water comes back wrong

Past the trail the land turns lush again — too lush. A fungal forest in permanent luminous dusk,
spores hanging in shafts of light like snow that forgot to fall. The river reappears here, glowing
faintly, feeding growth that has no business being this large. It is beautiful and wrong and very
quiet. This is the Isono register, wall to wall.

- **Biome** — giant fungal growths among drowned trees, bioluminescent undergrowth, glowing
  slow-moving water, air thick with drifting motes.
- **Creatures** — muhl (puffballs that sigh spore clouds), grubs asleep in translucent sap shells,
  sivi (wisps that drift toward whoever glows brightest — that would be the healer), and Orovan,
  something tall and slow that tends the mushrooms and does not like being interrupted.
- **People** — masked pilgrims passing the other way, unbothered, on business they don't explain.
  They are coming down from the First Water; the way you are going is a road to them. And Clover,
  who followed their bees upstream when the downstream hives emptied, the way Wren came back for the
  herd.
- **Stimmung** — cathedral dusk. Held breath, reverence, the feeling of being watched by plants.
- **Sounds** — deep hush, spore-fall soft as rain, a subsonic fungal thrum, water moving slowly.
- **Tempo** — slow and ticking. Long fights of accumulating pressure rather than bursts; the
  dungeon breathes at the speed of its heals-over-time.
- **The walk** — drowned trees, then the bright water where the river's wrongness is finally in
  front of you, then the sap shells, then Orovan tending. Being seen is the lesson all the way
  through.

## 4. The White — where the river begins

Above the Glow the vegetation stops like a held breath and the world opens into pale stone
flatland — Arzach country. White terraces, crystal growths humming in the wind, a sky so big it
hums too. At the center, the spring the whole river falls from, and the thing that is sitting in
it. The weirdest place in the game and the calmest: the wound and the ward in one.

- **Biome** — vast white-stone steppe and terraced spring pools, thin air, crystal formations,
  small perfect clouds very far away.
- **Creatures** — silent gliders that cast no shadow, crystal-shelled things that ring when struck,
  and Uvalu, the source-keeper: a guardian inflamed past recognition. Mending it is the finale.
- **People** — none, until the end. The rider from The Rust's horizon keeps their distance all the
  way to the First Water, then stops and turns: Gale, who went ahead to see the source, falling in
  for the last room. Five pairs of mud-boots under white stone, walking into the source together.
- **Stimmung** — the sublime. Awe. Monumental stillness. The end of the map.
- **Sounds** — wind over stone, crystal resonance, water beginning. Almost nothing, and it's loud.
- **Tempo** — monumental. Few encounters, each one an event; the boss fight is the dungeon.
- **The walk** — four rooms, each an event. The gliders, and the first taste of mana that doesn't
  come back. The ringing shelf, a fight scored by its own chimes. The first water, where the rider
  finally stops. The source: Uvalu alone, one long fight out of a closing purse.

## How the game describes itself

There is no tagline. The name holds both halves already — _balance_ is the numbers and the lab,
_mender_ is the healer and the land — so a slogan can only restate it in more words. The splash
carries the title, the art and the dungeon buttons, and nothing else.

Where a sentence is needed (meta description, the manifest, the repo), it is plain:

> A tactical healing game for the web. Heal the people with you, and rebuild any ability, enemy or
> number you like.

No counts in it — the party grows a body per dungeon, the dungeon list is only the authored half,
and the kit keeps growing. A number in a description is a number that goes stale.

The README follows it with the one line of this doc that faces outward:

> One world, walked upstream through four colours — the Green, the Rust, the Glow, the White.
> Nothing you fight is evil; every creature is inflamed by a wound in the land, and a room won is
> Mended.

## What the paintings settled

Every prompt lives in `assets/image-assets.json`; [asset-pipeline.md](./asset-pipeline.md) is how
they get generated, sized and composed. Explorations are in
`public/assets/generated/explorations/`. What looking at them decided:

- **green-guardian-glade** painted the subdual before we asked for it — Haruk at rest under a fallen
  log, the animal breathing evenly, not a corpse. It is the reference for what settling looks like.
- **rust-roha** — a bell on stilt legs wearing its own head, standing off the road from a dead tree.
  The Rust's wrongness in one frame; it earned her a room.
- **glow-fungal-tender** — the first portrait of an old-tongue person. Orovan is tall, thin-limbed,
  mushroom-capped, mid-tending. Keep this silhouette.
- **white-first-water** put the rider _in the painting_, one tiny silhouette on the horizon, before
  the thread was written down. The thread landed.
