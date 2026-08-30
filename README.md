# Untitled Capybara Game — nineteen places, one rodent

A physics sandbox where a mischievous capybara terrorises nineteen places: the Royal Botanic
Gardens and the Opera House forecourt in Sydney; Sydney Harbour from Circular Quay out to
Manly, which you cross by DRIVING A FERRY; the plaza, market and Galeras volcano of Pasto,
Nariño; the torii, temples and matcha terraces of Kyoto and Uji; the river, the painted street
and the salsa floor of Cali; Copacabana, the Selarón steps and a Carnival avenue in Rio de
Janeiro; Reykjavík, a geyser field and a glacier in Iceland, **at night**; and the medina,
the souk and the great dune of Marrakech and the Erg; **the Drift**, which is not a place
at all; Piazza San Marco and the Grand Canal in Venice, **with the tide coming in**; and a
neon street in Mong Kok with a bamboo scaffold up the side of it; a bay in **Palawan** whose
interesting half is **underneath the water**; and a valley of fairy chimneys in **Cappadocia**
at ten past five in the morning, where the only vehicle has no steering; **Manly**, on the ocean side of the peninsula, where the sea has a shape and it is moving; the flooded campo of the **Pantanal**, which is the one place in this game the animal is actually from; and **Sơn Đoòng**, the largest cave passage on earth, where the only light is the one you make; and the **Antarctic Peninsula**, where the land is four rocks eleven hundred metres apart, the sea has broken ice in it, and the only sensible way to get anywhere is a small orange boat with an outboard on the back; **Monte Carlo** at blue hour, where the Casino has an inside, five people are paid to look at the room, and the Grand Prix circuit runs past the front steps; and **Hanoi** at ten in the morning, where the road is a continuous river of two hundred and forty motorbikes and you cross it by not stopping. Built with Three.js + cannon-es, styled after *Untitled Goose Game*: flat-shaded
low-poly, high-key pastel palette, slapstick physics.

In Pasto you can whistle down an Andean condor, grab its talons, and ride thermals off the
volcano. The flight is real aerodynamics — lift proportional to airspeed squared, banking to
turn, thermals as a rising airmass. Nothing is on rails.

And it is not only in Pasto any more. For nineteen chapters the best-simulated thing in the
game could happen in exactly one of them — not because the flight knew where it was, but
because the plumbing did: every terrain sample and every thermal went to Pasto by name. A
chapter hosts a flier now by publishing one thing, its rising air, and **Rio is the second**.
Nine frigatebirds have hung over that bay since the chapter was built, drawn and unreachable;
now you can wheek one down onto the sand at Copacabana and let it take you up the sunward face
of Pão de Açúcar on the sea breeze, which is exactly what a fragata spends its afternoon doing.
It is the same bird in the same air with the same six controls, and it is black with a scarlet
throat instead of an Andean condor's white ruff, because the plumage belongs to the chapter.

On the harbour you take the wheel of a small timber ferry and take her to Manly: throttle on one
stick, rudder on the other, rudder authority that only exists while she has way on, and seventy
seconds of open water with the Bridge, a regatta, a dolphin escort and two headlands in it. The
score changes key for the passage and changes back when you step away from the wheel.

In Cali there is a dance floor, and the game asks you to move on the beat of the salsa the band
is actually playing. The judgement runs off the AudioContext clock the notes themselves are
scheduled on, so it cannot drift out of sync with what you are hearing — it is the one task in
the game you cannot brute-force by standing in the right rectangle.

In Rio the beat comes back, and it is deliberately not the same beat. Salsa lets you dance on
any pulse; samba is in 2/4 and the surdo — the big drum you feel in your chest two streets away
— lands on the **two**. So Rio's floor is not a floor: it is a hundred and fifty drums walking
down an avenue, the scoring zone walks with them, and hitting the one is not a near miss, it is
the wrong beat. Keep station in the column and move on the two.

In Iceland it is dark, and **the ground stops holding you**. A glacier has no friction worth
the name, so a hundred and thirty metres of ice tongue turns the animal into a toboggan that
steers badly and tops out near twenty metres a second — the one genuinely new verb in seven
chapters, and biomes ask for it by publishing `groundSlip(x, z)`. Strokkur will throw you
twenty-five metres straight up if you are standing on it when it goes; there is a second and a
half of warning and it is the water doming up blue. And the last two lines of the chapter are
the quietest things in the game: sit still in a hot spring for seven seconds, and then look up,
because the aurora comes out and the score grows a **choir**.

The Drift is the ninth chapter and the first one with nobody in it. It is an archipelago of
floating islands hung over a sea of cloud, in **a third of a gravity**, and it is built on
three things nothing else here has. The ground is optional: there is far more air than island,
and every gap is a decision rather than a corridor. **The wheek is a wing** — press the voice
key with your feet off the ground and the animal squeaks and bounces, one puff per flight, and
after eight chapters of that noise startling people and buying ferry tickets it is the first
time it has ever moved the capybara itself. And **the wind turns**: a current runs through the
void, you can read it in the seed-fluff and in a weathervane on the spawn island, and it swings
all the way over and back on a thirty-eight second breath. The twenty-five metre crossing at
the top of the world is impossible into it, marginal in dead calm with a puff, and easy with it
behind you — so the chapter's hardest task is one you solve by *waiting*, which is a thing this
game has asked for exactly once before.

Nothing up there can kill you and the design leans on that hard: fall off and you drop for
several seconds through the dark, land in cloud, and the cloud gathers underneath and hands you
back up. A chapter about leaping between rocks with nothing underneath cannot also be a chapter
about being punished for missing — you would stop leaping, and leaping is the chapter. The list
ends with a paper lantern nine metres tall on the highest island, which will not light until
six lampflies are following you, and when it does the whole sky comes up with it.

In Marrakech there is a task you can **lose**. Rob the orange cart on Jemaa el-Fnaa and six
traders come after you through a covered souk they know much better than you do — and they
chase where they last SAW you, not where you are, so a corner is worth something. Out east
past the palmeraie there is a sandstorm that takes the visibility to nothing and leans on you
hard enough to move you, and when it has gone through it is evening, there is a fire, and a
gnawa band is playing round it.


In Venice **the floor is negotiable**. Ten places have quietly agreed on one thing without
ever saying it — that the ground is where it was the last time you looked — and Venice has
never agreed to that in its life. A tide runs under the whole chapter on a three-and-a-half
minute cycle: low, then four rising tones off a siren, then ninety seconds during which
Piazza San Marco stops being a square and becomes a lagoon with a basilica on the end of it.
The city puts out its *passerelle* — raised duckboards a metre wide — and while the water is
up they are the route, which is a real thing that a real city really does. It is one number:
`isOverWater(x, z)` is simply "is the tide over the paving here", so a place is dry at one
o'clock and swimmable at two and nothing else in the codebase has to know that is unusual.
Making it possible meant unpicking a constant nine chapters deep — capybara.js had the sea
hardcoded at −0.5 in three separate places — and the fix is exact: every other chapter is
unchanged to the last decimal.

The rest of the chapter is what you would hope. Two hundred pigeons on the paving that all go
up at once if you run at them, and the game counts how many. A gondola on the Grand Canal you
can ride the prow of. The Rialto, taken at a run without stopping. And when the water is at
the top, the whole square swum end to end, under a basilica, in a city that has gone the
colour of the sky.

Hong Kong is the eleventh chapter and the answer to a question the other ten never asked:
**up**. Every one of them is locomotion on a plane plus a hop; the Drift added air, but air is
not height. So Mong Kok gets the first genuinely new verb since the condor — hold the grab key
against a **bamboo scaffold** and push the stick INTO it, and the animal climbs. Pull away and
it comes down, sideways shuffles, Space kicks off the wall. It needs no new key, because with
the camera behind the animal and the wall in front of it, W is up for exactly the reason W is
forward. Hong Kong is the last place on earth that still builds forty-storey scaffolds out of
a grass, lashed by hand, and there is one going up on some street there every day of the week.

Above the street, eleven metres up, three bundles of laundry poles cross from one side to the
other with somebody's washing on the middle one; drop off them onto the biggest neon sign in
the street and it swings, because you did that. And at eight o'clock the far shore runs the
Symphony of Lights: sixteen towers across a kilometre of black water coming up **one per beat
of the chapter's own music**, off the same audio clock the notes are scheduled against, so it
cannot drift from what you are hearing. The only place you can watch it from is a roof, and
the only way onto a roof is the bamboo — so the chapter's last verb and its best picture are
the same gesture. Miss it and it comes round again in two and a half minutes, because nothing
in this game may be missable for ever.

Palawan is the twelfth chapter and it exists because of a hole in the other eleven. Water in
this game has been a wall (the harbour), a floor (the tide), a road (the Uji run) and a hazard
(a glacier's meltwater), and in every one of them the animal paddled across the top of it like
a duck. A capybara is the finest swimmer of any rodent alive — webbed feet, eyes and ears and
nostrils all on top of its head so it can sit submerged and watch you, five minutes of breath.
So: **hold the grab key in the water and it goes down.** Release and it comes back up on its
own buoyancy; Space is a hard kick for the surface; and the breath is the stamina bar, because
a bar that already means "how much have you got left" means the right thing.

There is a reef to go over, a drop-off with a wrecked outrigger at the bottom of it, a giant
clam that opens if you get down to it, and a turtle on a sixty-year lap that you cannot keep up
with from the surface. And there is a **crack in a limestone cliff whose roof is a metre and a
half under the water** — the one door into the hidden lagoon, and the new verb is its key.
Beyond the lagoon a thirteen-metre tunnel goes through to a chamber with a hole in the roof and
one shaft of light coming down it onto white sand. Twice an evening the plankton comes into the
bay and every stroke you take lights up behind you, which you have to be *under* to see: the
chapter's whole argument, in one picture.

Cappadocia is the thirteenth and it is the opposite chapter on purpose — dry, cold, upward,
and the one place in the game where **you cannot steer**. You get in a balloon and there is no
stick input at all. There is a burner, it takes about four seconds to answer, and the wind goes
a different way at every height. So you steer by choosing a height. That is not an invented
mechanic: it is exactly and only how balloon pilots navigate, everywhere, and it is why they
all fly at dawn — the layers are cleanest before the ground warms up and stirs them together.
The whole wind map is drawn in the sky as thin streaks of cloud moving at their own layer's
speed and bearing, so there is nothing on the HUD to read: look out of the basket.

On the ground there are fairy chimneys to climb — the bamboo's verb, back for a second time,
now solved against the outward radial of a cone instead of a flat face — a cliff drilled with
four hundred hand-cut pigeon holes to let the birds out of, a launch field with five crews at
five different points of the same twenty minutes, and a tether that is not yours. In the air
there is a chase truck that drives to wherever you are, all flight, so the landing can never be
unwinnable; and there is the sun coming over the ridge with a hundred and fifty envelopes
already up, which is the one thing everybody who has ever been there gets out of bed for.

### And when one of them lands

Every chapter has exactly one line on its list that is the reason the chapter exists — the
condor, the Uji, the chiva up to the mirador, the sky over the glacier, the square going under.
For a long time all ninety-one ticks sounded identical: stealing a hat in the Botanic Gardens
and bringing down the northern lights both got one chime and twelve scraps of paper.

They do not any more. A set piece **lifts the score**: three voices open up an octave and a
twelfth above the pad and a figure climbs the chord, and because that chord is whatever is
actually sounding, the celebration is in Kyoto's key in Kyoto and in Mong Kok's in Mong Kok
without a note of it being written per-place. The pad widens under it, the filter opens, the
paper comes out by the handful, and instead of a toast you get the card the game uses when you
arrive somewhere — the place, in large letters, and what you just did underneath it. Then it
takes nine seconds to go away.

It is once a chapter, sixteen times in the game, and that is the whole mechanism: a second one
in a chapter would halve what the first is worth.

### And where it stops

For a long time the score never did. Not once, in nineteen chapters, for the whole hour: chord,
pluck, chord, pluck, at a density set only by how much trouble you were causing. It was
beautifully composed and it was a carpet — and a carpet is the one thing a beautiful piece of
music is not. A phrase is beautiful because it ends, because you notice it ending, and because
something comes back.

So about twice a minute, for eight or nine seconds, it takes a breath. The plucks fall away, the
pad comes down and darkens with it, and the reverb opens, so what you are left with is mostly
the room the last chord is dying in. Then it comes back, over a longer ramp than it left by. It
is never silent — a game that goes quiet reads as a fault and half the players reach for the
volume — it goes *distant*, and that is what buys the return. It will not do it under a band,
or while a set piece is lifting, or while anything is going on: the whole point of a breath is
that nothing is.

The rest of the mix caught up at the same time. The pad, the choir, the shimmer and the lift
used to be mono — a bed one pixel wide in the exact centre of your head — and now sit under a
two-tap ensemble that detunes each side a few cents against the middle and never settles. The
weather was one and a fifth seconds of mono noise on a loop, which is short enough to hear;
it is six seconds of stereo now, and every voice takes a different slice of it. The reverb grew
a pre-delay and eight early reflections, which is the difference between a wash and a room —
and the score now gets **its own room per chapter**, out of the same table the footsteps have
used since the sound came from somewhere. Manly's beach is the driest place in the game to play
music in and Son Doong is by a long way the wettest, and you can hear which one you are in with
your eyes shut.

And the bands stopped being perfect. Every struck note used to land on the grid to the sample,
which is the one thing that most reliably tells you a machine is playing. Now the bass and the
surdo lean late, the montuno and the cavaquinho push early, no two strokes are quite the same
weight — and the clave, the campana and the ride barely move at all, because they are what
everyone else is late *against*. Two things stayed rigid on purpose: a harpsichord, which
cannot be played louder and never could be, and Mong Kok's drum machine, because the chapter is
a joke about a city that runs like a machine.

## The middle rung

Every chapter has one moment it is for — the condor over Galeras, the Adriatic arriving in San
Marco, the far shore of Victoria Harbour lighting a tower per beat — and the game says so, once,
with a banner and a lift in the score that resolves in that place's own key.

Underneath it there was nothing at all. A hundred and fifteen other lines all got the same tick,
the same twelve scraps of paper and the same rounded toast, whether they took four seconds or
half a minute. So there is a **middle rung** now: one set piece per chapter that is worth
crossing the map for and is emphatically not the postcard. Half the lift, a card instead of a
toast, and **seventeen of them in a hundred and thirty-three lines** — one everywhere, and a
second one in the four chapters the pacing audit measured shortest.

They are also what the places are made of between the tasks. Eight of the thirteen are the first
thing in their biome that MOVES on its own:

| | |
|---|---|
| Sydney | a Mr Whippy van doing the promenade, chiming, that you ride the roof of |
| Pasto | a Carnaval de Negros y Blancos float, four metres of papier-mâché, up the plaza |
| the Harbour | the Freshwater, thirty-four metres of her, who answers your horn and then washes you over |
| Kyoto | the bonshō — pull the rope, and you have four seconds to be *inside the bell* |
| Cali | a fruit barrow chocked on the mirador. Kick the stone out and get in with the mangoes |
| Rio | the set at Arpoador, built out of `flow()`, so you surf it rather than being shoved by it |
| Iceland | a humpback in the bay: a fin, a blow, four seconds of nothing, and then thirty tonnes |
| Marrakech | the acrobats of Amizmiz, who throw you ten metres over Jemaa el-Fnaa |
| the Drift | seed-heads on the wind. Catch one and you stop falling |
| Venice | the traghetto — and you stand up for it, because everybody who lives there does |
| Hong Kong | an open-top down the street, so the neon goes past at head height on both sides |
| Palawan | eight hundred sardines holding one shape, which opens around you and closes behind |
| Cappadocia | eleven horses on the valley floor before dawn, because *katpatuka* means the land of beautiful ones |

Two of them fix a pacing hole rather than merely filling one. Cali's barrow runs **down the
chiva's own road**, so the ninety-second climb to the mirador finally has a way back that is not
a hundred and sixty metres of walking; and the Freshwater put something on four hundred metres of
open water that had eleven buoys and six yachts on it and nothing else.

### And a second one where the chapter was short

`qa/pacing.mjs` measures every chapter against a twenty-to-thirty-five minute target and prints
which are under it. Four were furthest under, and each of them now has a second middle rung —
chosen so that no chapter has two of the same KIND of moment in it:

| | |
|---|---|
| Rio | **o bonde.** The Arcos da Lapa had a deck across it with the comment *"where the tram runs"* and nothing on it, no floor to stand on and no way up. Now there is a viaduct off Rua Lapa, a yellow open tram, and a second one that comes the other way and passes a metre from your feet, out in the middle of the arches |
| Venice | **il Volo dell'Angelo.** The one chapter whose whole argument is about a metre of water, and the only one that never showed you itself from above. A wire from the belfry of the Campanile to a gilded stage at the far end of the Piazza; the eleven seconds going UP are the set piece, not the flight |
| Hong Kong | **the lion.** Nine plum-blossom poles in the road, a drum, a gong, and a head of lettuce on a bamboo rig four metres over the last pole. The lion rests on the tarmac with its head down — which is a ramp — and then goes up the poles in eight leaps with you on its back |
| Palawan | **the manta.** Everything else that has ever carried this animal was on rails. This one is going where it likes: out over the drop-off, a full barrel roll at ten metres, and then it leaves the water with you still on it |

## Things that are simply there

A chapter needs objects that are not switches. Seven places got something that moves on its own,
is not on any list, and cannot be ridden, robbed or completed:

- **Sydney** — a floatplane on the harbour. It idles at its mooring, taxis, makes its run, does
  one wide circuit at sixty metres and puts down again. Ninety-four seconds, and it is never the
  thing you are watching: it is the thing that turns out to have been happening.
- **Kyoto** — a grey heron in the shallows of the mirror pond. It stands still for a very long
  time, and if you get within nine metres it goes, with a croak much uglier than the garden it
  lives in.
- **Marrakech** — five white storks on the Koutoubia. Four wheeling it on the thermal off eight
  hundred years of warm stone, and one on the parapet clattering its bill, which is the only
  noise a stork can make.
- **Pasto** — twenty-eight vencejos round the bell tower, screaming, at the hour of the evening
  when they do it. Ring the bell and they all leave at once and take fifteen seconds to forgive
  you, which is the only interaction there is and it is not a task either.
- **Cali** — five cometas over San Antonio on forty metres of string, because August is the month
  of the wind and every hill in that country has kites on it. They hang, they sulk, they take a
  gust and dive, and somebody you never see hauls them back up.
- **Iceland** — an arctic fox on the moraine. It is the right animal for this chapter for one
  specific reason: it does not run away. It stops at about eight metres, looks at you for as long
  as you can stand it, and goes back to what it was doing.
- **the Drift** — a skein of long birds crossing the void every couple of minutes, a long way off
  and a long way down. They exist to give the emptiness a size: there was nothing in the middle
  distance to measure a twenty-five metre gap against.

Cappadocia has none and does not need one — balloons in the sky, eleven horses on the valley
floor, a chase truck, a hundred and sixty pigeons on the cliff and five crews on the launch
field. It is the busiest chapter in the game already.

## The dive stopped belonging to Palawan

A capybara is the finest swimmer of any rodent alive, and for seventeen chapters it
could prove it in three of them. The verb was taught in Palawan and then taken away
again — which is the shape every new verb in this game had, and the single reason hour
five was never mechanically richer than hour one.

It is not a chapter's property any more. It is the water's. If the place you are
standing in has more than a metre and three quarters of its own water under you, you
can go down into it, and the rule sorts the seventeen out by itself: a chapter that
**modelled a seabed** gets the verb, and a chapter whose water is a flat plate over
nothing does not answer the question at all and is left exactly as it was.

Sydney's harbour is still a wall. The Drift's cloud is still cloud. But the Uji and
the golden pond, the Río Cali, the canals and the lagoon of Venice, Victoria Harbour,
the flooded campo of the Pantanal, the Atlantic off Copacabana, the black bay in
Iceland and thirty metres of water under the Antarctic ice are all somewhere you can
now go. **Three chapters could dive. Eleven can.**

Making it work meant admitting how much of a verb is the *picture* of it. Every
chapter needed to know what its own water looks like from underneath — one row each,
two colours and how fast the world goes away, which is the number that does most of
the work; Venice's canals close down at twenty-six metres and Rio's Atlantic at
seventy. And the camera had to be taught that the rule it obeys everywhere else is
exactly wrong down here: an animal three metres under a lagoon has the bank four
metres behind the lens, and the terrain clearance dutifully lifted the eye out over
the paving, so the dive was watched from the pavement through the top of the water.
The boom comes **in** now rather than up, and stops at the first length where the eye
is not inside anything.

## The things nobody tells you about

Every one of the hundred and ninety-nine tasks arrives the same way: it appears on the
paper, an arrow points at it, a beacon stands on the spot and a distance counts down.
That is a very good net, and it was the only way anything in this game had ever been
handed over — so in seventeen dense, hand-built worlds, nothing had ever been *found*.

There are twenty things now that are never on the paper. No arrow, no beacon, no clue,
no distance; nothing needs them and nothing is gated on them. They tick quietly into
the journal and then stand on the ledger next to the place they happened, and the whole
of the design is that the game turns out to have been watching something you did not
know it could see.

Some are the moveset turning up where it was never taught — *went under somewhere
nobody asked you to*, *climbed something in a place that never mentioned climbing*,
*swam in water nobody sensible swims in*. Some are what you did with the time — a full
minute of doing nothing at all, a whole shower stood out in from the first drop to the
last, eight bars moved on the beat somewhere the game is not counting. Some are where
you went: the highest ground there is, the far edge of the world, the one part of a
busy place with nobody in it, the bottom of the deepest water.

And four of them are about being seen, which is the other thing that changed.

## ...and thirty-four of them are about one place each

The twenty above all work in all seventeen worlds, which is the good half of them and
also the tell: every one is a question about the moveset or about the clock. Nothing in
them is about *anywhere*. Notice something in Venice and the game showed you the same
sentence it had shown you in Iceland.

There are thirty-four more now, two per chapter, and every one is about a thing that
world had already drawn and had never once asked after. None of them is a thing to go
and do. Nine are literally *you were there and you did nothing* — sixteen seconds
standing still in the bamboo grove the game otherwise wants you to tear through, twenty
seconds in the middle of the rookery being comprehensively ignored, a long sit on
Selarón's steps letting Rio go past. Several are the deliberate opposite of the
chapter's own task on the same spot: the walk up to the mirador instead of the chiva
ride, standing underneath the Arcos da Lapa instead of running along the top of them,
swimming under the Harbour Bridge, which is not what it is for.

And two of them are the worst seats in Kowloon for a light show whose task is the best
one — being out in the harbour, in the water, when the towers come on; and being inside
the wet market when it happens and missing the entire thing.

Three things in the world had to become true first, because they were not:

- **The sprinkler in the Botanic Gardens did not make you wet.** It has been there since
  the first version and its whole job is to soak a *tourist*. You could stand in the arc
  of it as long as you liked and come out with a dry coat — which is the exact thing the
  rain code's own comment calls the tell that weather is a decal.
- **Not one of Sơn Đoòng's twenty-six drips could land on you.** They fall forty metres,
  they ring the floor, they tick, and they went straight through a capybara.
- **The heron, the arctic fox and the Harbour Bridge could not be asked where they
  were.** The fox has answered a wheek and come two thirds of the way toward you since
  the day it was built, and nothing in the game was able to notice that it had.

## People remember you now, for about half a minute

For eighteen versions a person's alarm faded to nothing in under a second. You could
rob the same stallholder, be chased across a square and shouted at, and four seconds
later you were an unremarkable rodent again — which quietly removed the half of the
mischief loop this kind of game is actually made of: approach, get spotted, back off,
come at it from somewhere else.

So people remember. Do something to somebody and they are **wary** of you for
twenty-six seconds: they turn and watch you from further away and go on watching, they
notice you again sooner, and they have something to say about it — *you again*, *I know
your game*, *don't even think about it*.

**It takes nothing away.** Not one task is harder, no grab fails, nothing is lost and
nothing can be failed; the only thing wariness buys is attention. The stakes went into
the finds instead, which is content written knowing it exists: take something with four
people in sight and not one of them looking; get five people watching you at once; rob
somebody who is already staring straight at you. And the best of them is the one you
complete by *not* moving — stand where you can be seen, next to somebody who has had
enough of you, and wait until they stop minding.

## Six of them are not a list

Seventeen chapters had exactly one structure between them. You turn up, you work
through eight to nineteen switches in whatever order you like, the marquee lands
somewhere in the middle, you wheek three times and you leave. The places could not
be more different and the *shape* of them never varied once in eight hours — and
shape is the thing you feel at hour four rather than at hour one.

So a task may now belong to a **movement** of its chapter, and six of them have one.
The paper offers the lowest act with anything still open in it, and the card's own
header stops saying "To do" and starts saying where you are in the place: REYKJAVÍK,
then OUT OF TOWN, then AND THEN SIT STILL. A movement opening gets the arrival card
and a soft chime and *nothing else* — no lift, no confetti, no tick, because the
marquee keeps all four of those and has to go on being worth what it is worth.

| | |
|---|---|
| Circular Quay | THE QUAY · OPEN WATER · MANLY. The chapter is a voyage and it finally reads as one: two lines at the wharf, five in seven hundred metres of open water, and one when you have tied her up |
| Iceland | REYKJAVÍK · OUT OF TOWN · AND THEN SIT STILL. Five, then three, then two — a narrowing, into the only chapter that ends in stillness |
| Marrakech | JEMAA EL-FNAA · EAST, THEN · AFTER THE STORM. The world has always gated the fire behind the sandstorm; the paper had simply never said so |
| Venice | LOW WATER · ACQUA ALTA. The one chapter whose whole argument is a turn, and it used to list *swim the length of the flooded square* next to *look down the well* at one o'clock in the afternoon |
| Sơn Đoòng | no movements, but the paper only ever shows **two** lines. In the dark, two things at a time |
| Antarctica | THE STATION · THE ICE · THE PACK |

**Nothing is gated, and that is load-bearing.** Do an act-three thing in the first
minute and it ticks, exactly as it always did — an act stages the telling, not the
world. And F still reaches every open line in the chapter whatever movement it is in,
so the paper is a default rather than a wall and a place can never be soft-locked by
one. The other eleven chapters are flat lists and are untouched, which is the point:
a game where every chapter has a twist has no twists in it.

## And you take something with you

Seventeen places and nothing had ever crossed a boundary between two of them. The
departures board made travel cheap, and in doing so it made the chapters *more*
sealed rather than less — a menu of seventeen dioramas, each one leaving no mark on
the next.

Finish a place now and you **keep** something out of it: a tourist's hat, a condor's
flight feather, a tile off Selarón's steps, a piece of the glacier that is not going
to survive the flight, a length of scaffold bamboo, the station's enamel mug. It
arrives as the second beat of the chapter's own ceremony — after the card that says
you are done here, before the line that tells you where the door is — and it is
drawn, like the sixteen postcards, out of a dozen flat polygons in that place's own
colours.

There are seventeen slots at the top of the journal and there are always seventeen.
The ones you have not earned are drawn grey and nearly out, so you can see that there
is a shape in the box and not what it is. A finished postcard on the title card wears
its souvenir in the corner. And you hold one exactly when the chapter is finished,
which means the game does not store a single new thing to know it — it is the tick
list, read a different way.

## The end is not a receipt

The ending was a full-screen rectangle reading MISCHIEF COMPLETE, a number, and then
it reloaded the page. A hundred and ninety-nine tasks, forty-two records, seventeen
places and the better part of a working day, resolved to one string and then thrown
away — and almost nobody had ever seen it, because it only existed at 199 out of 199.

It is a **ledger** now, and it is made of what the journey actually left behind: one
leaf per place you have stood in, each with its postcard, what you took out of it,
every number it got out of you and how long you were there, arriving one at a time.
Then the total, on the road.

Two things about it matter more than what it looks like. It is **openable from the
journal at any point** — the departures board answers *where can I go* and this
answers *where have I been* — so it is a surface you can visit at three chapters
rather than a trophy for finishing. And **Escape closes it and the world is still
there.** Reloading was the only thing you could ever do with the end of this game,
and a sandbox whose ending throws the sandbox away has it the wrong way round.

## Play

**Single file, no build, no server:**

```bash
start dist/untitled-capybara-game.html
```

Everything is inlined into that one HTML file; Three.js and cannon-es load from CDN via an
import map. If your browser blocks module scripts on `file://`, serve it instead:

```bash
node server.mjs
```

Then open <http://localhost:5173> (modular source) or
<http://localhost:5173/dist/untitled-capybara-game.html> (the bundle). Set `PORT` to use
another port.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move (camera-relative) · steer the condor · **throttle + rudder at the helm** |
| `Shift` | Run — until the wind goes. Ten seconds flat out empties the bar; blown, it is a walk and no hops until it comes back. |
| `Space` | **Hop.** Tap it for a kerb; hold it for a ledge — 1.4 m, which is the Opera House podium. Costs stamina. |
| `E` / `Numpad0` / left click | Grab · press again to throw. Hold while still on soil to **dig**. Grab the condor's talons. Take the ship's wheel. |
| `Q` | **WHEEK.** One mouth, one button. It startles everyone nearby, it is the ferry's horn, it flaps the condor's wings, it calls a condor down if one is up there — and three of them at a departure point is the ticket to the next place. |
| `Z` / `X`, right-drag | Orbit camera |
| `C` | Snap the camera behind you |
| Mouse wheel | Zoom |
| `M` | Mute · `` ` `` Perf overlay · `\` debug biome swap |
| `Tab` | **The journal.** The shelf of souvenirs, everywhere you have been, everything you have done, every record you hold — and, from the way out of a chapter, everywhere you can go next. It is also the way into **the ledger**: the whole journey, laid out. |
| `1`..`0`, then `–  =  [  ]  ;  '` | On the title card: pick a place. Ten digits and seventeen chapters, so the last seven are the keys after them — and every row on the card wears its own key, so none of it has to be guessed. The table runs to twenty. In the journal: travel there. |
| `Enter` | On the title card, if there is a saved journey: carry on from where you stopped |

Walk into the harbour and the capybara swims, riding the waterline with its back above the
surface. It dries off over about eight seconds. Push the stick at the shore and it **hauls
itself out** — up the sea wall, up the Opera House footing, onto the deck of a boat. It also
**climbs kerbs and stair treads automatically**: walk into anything under about 0.4 m and the
legs simply find it.

## The list

198 tasks across seventeen chapters — one per place, because a chapter is somewhere you have to
travel to.

- **Chapter 1 — Sydney (18).** *Royal Botanic Gardens and the Opera House:* wheek, steal a
  tourist's hat, make someone spill their flat white, dig up the gardener's prize rose, steal
  the picnic sandwich, get your photo taken, put the beach ball in the harbour, take the stage
  at the Opera House, knock over a bin, get chased by the gardener, have a dignified swim, drop
  the stolen hat in the harbour. *Up the promenade at Circular Quay:* rob the busker mid-song,
  introduce the seagulls to the chips, stand on a café table, let the dog off its lead, soak a
  tourist with the sprinkler, stow away on the ferry.
- **Chapter 2 — Pasto, Nariño (10).** Emigrate (somehow), call down a condor, hitch a ride on
  its talons, ride a thermal to the crater rim, steal an empanada, bring down a market stall,
  post something into the crater, make off with a ruana, scatter the coffee harvest, ring the
  church bell badly.
- **Chapter 3 — Sydney Harbour (7).** Cast off from Circular Quay, take the helm, sound off
  under the Bridge, cut through the yacht race, earn a dolphin escort, bring her alongside at
  Manly, raid the chip shop on the Corso.
- **Chapter 4 — Kyoto & Uji (8).** Turn up in Kyoto, run the whole torii tunnel, topple a stone
  lantern, redesign the rock garden, swim in the golden pond, tear through the bamboo grove, get
  into the matcha at Uji, whisk the largest bowl of tea in Japan.
- **Chapter 5 — Cali (7).** Land in Cali, sit on the Cat of Tejada, make off with a lulada, get on
  the chiva, disappear into the sugarcane, **dance salsa properly**, climb up to Cristo Rey.
- **Chapter 6 — Rio de Janeiro (8).** Turn up in Rio, rob the biscoito Globo man, head the ball
  into the Atlantic, take Selarón's steps at speed, get in among the bateria, **samba down the
  avenue on the two**, stow away on the Sugarloaf cable car, take the applause at Arpoador.

The paper only ever shows **four open tasks**, plus the one you have just ticked while it is
being struck through — never the whole checklist, and never a task from the hemisphere you are
not standing in. The window follows the biome, so crossing the Pacific swaps the list wholesale.

The top row carries a **bearing arrow and a distance** to wherever that task actually is, a line
naming the verb underneath it, and a soft beacon standing on the spot itself. Every target is
resolved live — "the nearest tourist still wearing a hat" moves, and gets robbed — so the arrow
is never pointing at a stale answer. A task with no place (wheek, whistle) shows the clue and no
arrow rather than inventing one.

Order is pacing, not filing. Chapter 1 opens on something you can do in ten seconds without
walking anywhere; chapter 2 puts the condor fourth, so two bits of market mischief teach grab
and barge and then the bird arrives while it is still the best thing on offer.

The title card lets you start in any of the sixteen, and it is a grid rather than a row of
tickets now — thirteen torn stubs wrapped into ragged rows and pushed the last chapters
below the fold on a 720p laptop. Every row carries its own tally once there is one, because
"Cali, 3 of 8" is the single most useful thing a returning player can be told about a place.

**How you actually travel.** Every place that is not Sydney has exactly one way out of it,
standing somewhere obvious, using a verb you already have — three wheeks. What has changed is
where it LEADS: the third wheek opens the **departures board** (the same card Tab opens
read-only) and you pick. Getting abroad used to cost a ferry, a boat, seven hundred metres of
open water and a walk up the Corso, and with seventeen chapters that toll would have been paid
twelve times.

```
   three wheeks at:                 opens the board, and the board goes to:

   the crater on Galeras            Sydney, always
   the Uji bridge                   anywhere you have already stood
   the bridge over the Río Cali     ...plus the lowest chapter you have not finished
   the rock at Arpoador
   the end of the pier, Reykjavík   (counting from two: Sydney is eighteen tasks and is
   the fire at the desert camp       almost never finished early, so "lowest incomplete"
   the lantern's plinth              would have been Sydney for the first two hours)
   the two columns on the Molo
   the end of the Star Ferry pier
   the end of the bamboo jetty
   the landing plain, Cappadocia
```

Five of those are gated by the world rather than by a rule, which is the same trick played
five times: the desert fire only exists after the storm has passed, the Drift's plinth only
works once the lantern is lit, Venice's Molo only offers a boat once you have seen the square
go under, Palawan's jetty only once you have been under the water while it was alight, and
Cappadocia's landing plain only once you have actually flown — which makes it the one exit in
the game you have to arrive at by NOT steering. In each case the chapter's last line happens
where the way out is, by construction.

Task completions are **causation-gated** — a prop that rolls into the water on its own is
scenery, not mischief, and won't tick anything.

## The voyage to Manly

Chapter 3's verb is not "walk", it is "steer", and the whole chapter is one seventy-second
passage up the harbour.

The ferry is a **kinematic body driven by velocity**, which is the same trick Sydney's own
ferry uses — capybara.js already solves in the frame of whatever it is standing on, so the deck
carries its passenger exactly rather than approximately. Three things make her feel like a boat
rather than a car:

1. the throttle sets a target SPEED that the engine chases, so it has weight;
2. **turn rate is proportional to speed** — stopped, the rudder does nothing, which is the
   entire reason coming alongside feels like coming alongside;
3. she heels into the turn and squats by the stern under power.

The passage is sized against the map, not against a feeling: 566 m at 10.4 m/s is 64 seconds
flat out on a dead straight course with nothing to look at. Measured end to end with the Bridge,
the fleet and the turn alongside, an ordinary passage runs **about 71 seconds**.

The score changes with it. Palette 3 (E lydian, every chord major with a ninth on top, filter
wide open, root walking I–V–vi–IV) is alive *only while somebody is actually driving* — take
your hands off the wheel and the quay's own key comes back, so the euphoria is attached to the
passage rather than to the postcode.

## Eleven biomes, one set of coordinates

All four are authored in the *same* world coordinates. Only one is ever attached, so they cannot
overlap and none needs an offset. Ownership is captured by intercepting `scene.add` and
`world.addBody`, so anything a module spawns at runtime — a prop, an NPC — automatically belongs
to the live biome without any module opting in.

Detaching a biome sets `visible = false` on its scene roots (zero draw calls, geometry stays
resident so re-entry is instant) and removes every body from the CANNON world (zero broadphase
and solver cost). Only Sydney is built at boot; the other three are built the first time you
travel to them.

Anything that asks "is there water under me" or "how high is the ground here" asks the LIVE
biome, never `game.env`. Sydney's `isOverWater` says yes to everything north of z = -10, which
is a volcano in Pasto and a shrine hill in Kyoto — see `capyWater()` and `capyGroundY()` in
capybara.js and `sysGroundY()` in systems.js.

## Layout

```
CONTRACT.md    locked inter-module contract: palette law, world layout in metres,
               event names, published API shapes, perf budget, file ownership
index.html     import map + boot card + error surface
build.mjs      bundler -> dist/, gated on contract violations and name collisions
server.mjs     zero-dependency static server (also a QA screenshot sink)
src/shared.js       PALETTE, cached flat-shaded mat(), TASKS, maths helpers
src/main.js         bootstrap, frame loop, biome streaming
src/environment.js  Sydney: terrain, harbour, Opera House, Gardens, promenade, ferry
src/pasto.js        Pasto: Galeras, Andean terrain, plaza, church, market, coffee farm
src/quay.js         Sydney Harbour: Circular Quay, the Bridge, the fairway, the
                    drivable ferry, the regatta, the dolphins, Manly
src/kyoto.js        Kyoto & Uji: the torii tunnel, Kinkaku-ji and its pond, the dry
                    garden, Gion, the bamboo grove, the Uji river, the matcha terraces
src/cali.js         Cali: the Rio Cali, El Gato de Tejada, La Ermita, San Antonio,
                    the chiva, the sugarcane, Cristo Rey — and the dance floor
src/rio.js          Rio: Copacabana and its wave pavement, Arpoador, Sugarloaf and a
                    working cable car, the Lapa arches, the Selaron steps, Santa
                    Teresa — and the avenue the bateria comes down
src/props.js        cannon world + 30 prop types, grab/throw, buoyancy, stall collapse
src/capybara.js     mesh, rig, movement, grab/dig/wheek/swim
src/condor.js       condor mesh, summon, talon mount, aerodynamics, thermals
src/npc.js          Sydney tourists/gardeners/ibis and Pasto vendors/abuelas/llamas — FSMs
src/systems.js      lighting, cameras, input, HUD, WebAudio synth, biome transitions
qa/                 screenshots captured during live browser QA
```

Modules only talk through the `game` object and the event bus defined in `CONTRACT.md`. The
bundler enforces the contract: it fails the build on illegal imports, `export default`,
`fetch`, dynamic `import()`, or any top-level name declared in two modules.

## The salsa engine

Chapter 5 is the only music in the game the player is asked to move in time with, so it had to be
right rather than evocative. 100 bpm, because salsa caleña is fast — the local footwork runs
ahead of Cuban or New York timing.

Four things make it salsa rather than latin-flavoured, and all four are in  in
systems.js:

1. **The clave is the bar line.** Son clave 2-3, five strokes across TWO bars, written out as
   absolute eighths over the whole cycle so the two halves can never be swapped — the one mistake
   that sounds wrong to everybody in Cali and to nobody else.
2. **The bass does not play on one.** The tumbao plays the bombo (the and of two) and beat
   four, and the four ANTICIPATES the next chord.
3. **The piano plays a guajeo, not chords** — an ostinato of syncopated octaves whose accents
   fall on the off-eighths, so it interlocks with the bass instead of doubling it.
4. **The harmony is a vamp**: i – iv – V7 – i in A minor, two bars a chord, round and round.
   Salsa is not a progression you follow, it is a groove you stand inside.

Six synthesised voices: clave (two hardwood partials, 80 ms), congas (heel / slap / open tone,
each a struck membrane that drops in pitch), campana, tumbao bass, montuno piano, and a brass
stab that only shows up once a cycle.

The dance floor reads the same clock the notes are scheduled on.  publishes
,  (signed distance to the nearest beat, in beats) and ; cali.js
scores a step when the capybara turns, hops or wheeks within 0.19 of a beat, one step per beat,
eight in a row to pass. Measured: 24 key presses over eleven seconds produced exactly 8 scored
steps, because the presses inside an already-scored beat are correctly ignored.

## The salsa engine

Chapter 5 is the only music in the game the player is asked to move in time with, so it had to
be right rather than evocative. 100 bpm, because salsa caleña is fast — the local footwork runs
ahead of Cuban or New York timing.

Four things make it salsa rather than "latin-flavoured", and all four live in the `sysMUS_*`
tables in systems.js:

1. **The clave is the bar line.** Son clave 2-3, five strokes across TWO bars, written out as
   absolute eighths over the whole cycle so the two halves can never be swapped — the one
   mistake that sounds wrong to everybody in Cali and to nobody else.
2. **The bass does not play on one.** The tumbao plays the bombo (the "and" of two) and beat
   four, and the four ANTICIPATES the next chord.
3. **The piano plays a guajeo, not chords** — an ostinato of syncopated octaves whose accents
   fall on the off-eighths, so it interlocks with the bass instead of doubling it.
4. **The harmony is a vamp**: i – iv – V7 – i in A minor, two bars a chord, round and round.
   Salsa is not a progression you follow, it is a groove you stand inside.

Six synthesised voices: clave (two hardwood partials, gone in 80 ms), congas (heel / slap / open
tone, each a struck membrane that drops in pitch as the head relaxes), campana, tumbao bass,
montuno piano, and a brass stab that only turns up once a cycle.

**The dance floor reads the same clock the notes are scheduled on.** `game.music` publishes
`beats()`, `off()` — signed distance to the nearest beat, in beats — and `beatInBar()`; cali.js
scores a step when the capybara turns, hops or wheeks within 0.19 of a beat, one step per beat,
eight in a row to pass. Measured: 24 key presses over eleven seconds produced exactly 8 scored
steps, because presses inside an already-scored beat are correctly ignored.

## The journey

Eight chapters is a different shape of game from two, and four things had to change with it.

**It saves.** Seventy-four tasks is well over two hours and a session is twenty minutes; those
two numbers cannot both be true unless the game can be put down. One `localStorage` key holds
your ticks, your records, where you were and how long you have been at it. The title card grows
a **Carry on** row. Starting somewhere fresh from the picker clears it — deliberately, and only
once you have actually chosen.

**There is no commute.** Getting abroad used to mean: find the ferry in Sydney, stow away,
arrive at the Quay, find the wheel, sail seven hundred metres to Manly, walk up the Corso,
three wheeks. That is a chapter the first time and a toll booth the seventh. Every place still
has exactly **one** way out of it, standing somewhere obvious, using a verb you already have —
but the third wheek now opens a **departures board** instead of picking your destination for
you. Anywhere you have stood is two minutes away rather than twenty.

**Finishing a place is a moment.** The last tick in a chapter used to look exactly like the
third, and then the paper quietly changed country. Now the place card comes back up with the
tally, the time that chapter took, and how many of the seventeen you have closed — and then,
a beat later, the thing you are taking with you. See **And you take something with you**, above.

**Some things are worth doing well.** Every task is a switch — you have done it or you have
not — which is right for *steal a hat* and quietly wasted the best twenty seconds in the game.
Eight tasks now keep a number: the top speed off the glacier and off the great dune, how fast
you shook the souk, Selarón's steps against the clock, the longest run on the beat in Cali and
on the two in Rio, how far Strokkur threw you, and how long you sat in the hot spring. Nothing
is ever gated on one. A record that blocked progress would put an exam inside a game about
being a nuisance.

## The water, the hills and the air

Three things the physics had never actually modelled, all of them found by asking what a
shared module knew about the twelve chapters written after it.

**Water existed in eight chapters and Archimedes existed in one.** `physCheckWater` was
gated on Sydney being live, with a comment explaining that every water path was Sydney's —
which was true when the harbour was the only water in the game and had been wrong since
Kyoto. A prop thrown into Venice's flooded square, Palawan's bay, the Río Cali, the Uji or
the harbour at the Quay fell through the surface and slept on the bottom. Every query
inside it now asks the LIVE biome, the same rule capybara.js has always used, and the
seabed comes from the biome's own terrain rather than a fixed 2.3 m of harbour. Measured
after: a ball dropped six metres into a Venice canal settles at `waterLevel - 0.03`, which
is the waterline its type table asked for.

Four more of the same shape were in the same file: an invisible Galeras crater shoving and
eating props in eleven worlds, `physOverWater` falling back to Sydney's `z < -10` rule so
half of every world counted as harbour, `physSurfaceY` answering 0 for eleven biomes, and a
fall-rescue that teleported home anything legitimately afloat.

**A hill cost nothing to walk up.** Eleven biomes publish `slopeAt(x, z)` and nothing in the
codebase had ever read it, so the great dune, the flank of Galeras, the switchbacks up
Cristo Rey and the moraine all walked at exactly the speed of flat paving. The grade is now
sampled from the terrain along the direction of travel — signed, which `slopeAt` cannot be —
and run through **Tobler's hiking function**, the standard empirical curve for walking speed
on a gradient. It is not symmetric, and that is the interesting part: it peaks slightly
DOWNHILL, which is why a gentle descent is free and a steep one is not. Floored at 0.42 of
the flat speed, because a slope you cannot climb is a wall rather than a run, and switched
off wherever the ground is already sliding so it cannot fight the slip model. Measured: flat
ground is still 4.2 m/s to the decimal, and a 46° pitch is 1.76.

**The air is a fluid.** Props carry quadratic drag, ½·ρ·Cd·A·|v|v, with the area and drag
coefficient baked per shape at spawn — so a hat and a bin no longer fall identically, and
the Drift's wind and Marrakech's storm carry light things exactly as far as they should.

### Three ways to move a capybara, and only one of them is a velocity write

    platVX / platVZ   a FRAME you are standing or flying in    deck, wind aloft, current
    capy.launch()     being THROWN, feet off the ground        geyser, cable, wave
    capy.shove()      being LEANED ON, still on your feet      sandstorm, bow wave, crowd

The third one is new, and it exists because **Marrakech's sandstorm moved the animal a
measured nothing**. Every biome updates before capybara.js, whose movement solve re-derives
the horizontal velocity, damps it at λ = 60 — 63% of anything injected, gone in one frame —
and then snaps whatever is left under 0.9 m/s to exactly zero. The storm was pushing 0.103
m/s per frame into that. `capy.shove()` is added after the damper and after the snap and
widens the speed cap by its own size, so it is the one channel a sustained lean survives.
Iceland's geyser had the milder form of the same disease: the vertical throw survived
because nothing damps vertical, but the outward scatter was inside the damper, so everybody
came off Strokkur going perfectly straight up.

And a kinematic carrier must difference its velocity against its **previous target**, never
against its own position: cannon integrates kinematic bodies inside `world.step`, which runs
before every module update, so `(target - body.position)` is the distance the last velocity
already travelled and the sign flips every frame. Measured on a parked machine: +7, −7, +7
m/s for ever, which is the number a passenger's reference frame is solved against.

## Iceland gets a way back up

The world-size audit measured scenery density along every chapter's walking route and found
one failure. More than half of Iceland is empty ground, and the dead stretch is the hundred
and sixty metres between the town and the top of the glacier — the approach to the best
twenty seconds in the game. Because `glacier-run` keeps a record, that walk is paid again on
every attempt: the emptiest ground in the game was the toll charged, repeatedly, on the best
thing in it.

The fix is deliberately not more scenery — the austerity is the chapter. It is a **piste
machine that patrols the moraine**, the same trick as the caravan across the hamada and the
Star Ferry across Victoria Harbour, which is exactly why those two long chapters measure
fine and this one did not. Slide down, step on at the snout, ride back to the cairn, go
again. It holds at the bottom while you are walking towards it, capped, because a fixed
timetable just moves the waiting thirty metres down the hill.

Its deck is 0.9 m off the ground, which is a deliberate hop and nothing more. The first cut
put it at 2.7 m, which is a machine you can admire and cannot board.

## Every chapter has a number in it now

Twenty-eight records across sixteen places, and not one of them in the first three chapters —
so the three places a player meets first were the only three with nothing to come back for.
Three were added, each hanging off the task that is already the best thing in its chapter:
**the passage up the harbour against the clock**, **how high the condor carried you** (above
the ground under you, and only while you are actually hanging off the talons), and **how
many gulls you got onto the chips at once**.

And a finished chapter is no longer a blank card. The paper used to jump to the lowest
incomplete chapter the moment you ticked the last thing, which put tasks on it that cannot
be attempted from where you are standing — the one rule the todo window has always had is
that it never shows a task from the hemisphere you are not in. It now stays on the place you
are in and turns into that place's **record board**: every number you hold here, and the way
on, in words, because a player who has just finished somewhere is exactly the player who has
stopped looking at the map.

### ...and there is something to beat before there is a best

Fifty-three of them now, and for thirty-five versions a record only ever compared you to
yourself — so on a first attempt it compared you to nothing at all. The line under the clock
said *no best yet*, which is true and tells you nothing about whether the run you just made
was any good. It says what a good one is instead: an authored figure on forty of the
fifty-three, every one of them derived from something the game already knew — the task's own
gate improved on, the height of the roof the scaffold serves, the fact that there are eight
gulls and a hundred and eighty pigeons. Pass it and the number goes green while you are still
running. Meet it for the first time and the game says one sentence, once, ever.

Thirteen rows have no par and are left exactly as they were, because a par nobody can defend
is worse than no par.

And **twenty-one of the fifty-three had no readout at all** — the block that draws that line
calls it "the whole of the game's replay surface", and for two fifths of them it was dark.
The height of a bamboo climb was banked in silence all the way up and posted after you let
go. The best question in the game — not how fast you crossed Hanoi, *how many of them had to
go round you* — was answered on the far kerb, a metre after it could have changed what you
did. They are all on the paper now, and the ones that are a COUNT rather than a clock are a
flash instead of a line: two hundred pigeons going up over San Marco is a number climbing
past forty for a second and a half, and then the card is a to-do list again.

## And now you are racing yourself

A number you beat is arithmetic. So the run comes back: go at a record you already hold and
your own best go at it is out there beside you, translucent, at the same point in its own
clock — and the question stops being *am I under forty-two point one* and becomes *am I in
front*, which is a different and much older kind of question.

It says nothing. There is no gap, no split, no arrow; it is a capybara, doing what you did,
and either you are ahead of it or you are not. There is no ghost on your first attempt, and
that is not a rule anybody has to remember — a run is only kept when it BEATS something, so
the earliest one can appear is your second go. And **a run that did not go anywhere is not a
run**: the trace is kept only if the animal actually covered ground, which sorts the
fifty-three out without a single one of them being listed. The glacier, the river at Uji, the
souk with six traders behind you and seventy seconds of open water up to Manly all qualify.
Sitting in a hot spring for four minutes, winning at roulette and putting two hundred pigeons
up off the paving do not.

## Somebody is keeping count

Everything needed for this has been running for versions. Every prop remembers whether the
capybara was the one that moved it. People recruit each other by line of sight, remember you
for twenty-six seconds, and a square keeps a heat field so one corner of it can have had
enough of you while the rest has not. There has been a mayhem number since version two.
Between them they had two readers — how loud the music is and how still the world feels — and
in nineteen chapters nothing ever said out loud that you had just done three things in front
of the same people.

Three things somebody saw, in one place, inside twelve seconds, and the score lifts, the card
comes up, and the people say the one thing they only say when it has been three in a row:
*right, that is not an accident* · *somebody is keeping count* · *I have been watching this
the whole time*. Five is **a scene**, and they have all turned round.

It is on nobody's list, nothing points at it, no task and no chapter needs it, and it will
happen again — which is the one place it parts company with the finds. A find is something
you noticed once. This is a thing you are doing.

There has to be an audience: do the same three things in the far corner of the gardens with
nobody in sight and nothing happens at all, which is the whole game saying the quiet part.
And one bin bouncing off a wall four times is one thing happening, not four.

## Three thousand seven hundred people, and now they are there

`qa/CROWDS.md` walked every instanced crowd in the game and put a chest-height ray through
each one. Venice: nought per cent solid. Hanoi eight, Monte Carlo six, the Quay three, Manly
five. Forty-eight people standing in the most photographed square in Europe and the animal
went through every one of them.

Six chapters closed. It is one helper now instead of the same twenty lines written three
times — a standing crowd pools every shape into one body, a walking one gets a box each and
is carried along by the same loop that draws it. **Except on the passerelle**, where it stays
a picture on purpose: the boards are a metre wide, the chapter asks you to run the whole
chain against a clock, and a solid queue up there would not make that harder, it would make
it impossible. Cali's ten dancers keep their ghosthood for the same reason and its eighteen
at the ringside do not. Manly's bathers were left alone because they already do the thing a
collider would be for — they get out of your way.

## Sit still, and more of the world notices

The calm has been in this game since v23: stop moving, the score goes close, the camera opens
out, the animal sits down, and an animal that would have fled lets you sixty per cent closer.
That last part reached six chapters out of nineteen.

Three more, and two of them use the half of it nobody had used. Nothing on the Antarctic
Peninsula runs away from you — a Weddell seal on a pan and a colony of gentoos are the least
frightened animals in the game — so what stillness buys down there is not that they let you
closer, it is that they notice you from **further**: twenty-four metres to thirty-six for the
seal, twenty to thirty for the colony. The lampflies in the Drift answer a wheek from half
again as far away if you have been sitting on the moss. And in the Pantanal, which is the one
chapter the animal is actually from and which had registered nothing at all, the jabiru
flushes at nine metres or at one and a half, and the jacarés take under a fifth off theirs
however quiet you are, because a jacaré is not impressed by anybody being quiet.

## The first hour finds out what you have been doing

Seventeen chapters have had lines that turn on and off with what you have ticked since v20 —
the reason written down at the time is that "a chapter is a sequence of things happening and
the people in it were outside time". It reached sixteen of the nineteen. Sydney and Pasto
predate the whole system: their casts are the two oldest in the game and they read a flat
table of sentences that no gate had ever touched. So the two chapters with the most tasks in
the game — nineteen and eleven, and the longest single list in it is Sydney's — were the two
where nobody ever noticed anything, in the first hour, which is exactly when a player is
deciding whether the world is paying attention.

Thirty-nine lines. The gardener having a day of it. A hat somebody lost this morning. The
bins all over the path. A busker whose hat is empty now, thanks. A couple comparing four
blurry photographs of the thing that got on the steps. And in the plaza, a stallholder on his
third stall this week, a farmer who watched a year of coffee walk away, and the woman with
the broom, who does not change her philosophy for anybody: *you went up with the bird. You
still came back down here.*

## The ledger is made of your own photographs

The end of this game is described up there as being made of what the journey actually left
behind — and the one thing in it you made yourself was not in it. The camera is the only
thing that leaves this game, the album keeps thirty-six pictures past a reload, and the
question "what is the newest picture taken in this place" had exactly one reader: the title
card. So the ledger, which exists to answer *where have I been*, drew seventeen hand-authored
polygons instead.

It asks now, and so does the departures board. The mark is still underneath — it is the
ground the photograph sits on and the colour behind it — and a place you never photographed
looks exactly as it always did. Not the card a finished chapter gets, because that is a
ceremony and a ceremony is the game's own voice; not the shelf, because the shelf holds the
thing you took, which is a different question from what the place looked like.

## The title card is sixteen postcards

It was thirteen identical beige rectangles with words in them, which told a returning player
nothing about anywhere. Every chapter now carries a small flat-shaded scene of its own
place, drawn out of **that biome's own palette** — the Opera House shells leaning and
stepping down in size, a torii on a matcha hill, Galeras under a plume with a condor off to
one side, the void under the Drift's islands, neon over Mong Kok, karst standing in water
with the reef visible under the line of it, balloons over Cappadocia at dawn.

Hand-authored geometry rather than art assets, because the contract forbids external files
of any kind and because it is exactly what the game itself is: a handful of flat polygons in
the same colours at the same grain. Every mark is under a dozen shapes.

The grid used to be a bento with an exact cell count — chapter one spanning two columns and
two rows, four columns, therefore exactly twelve other chapters. That is arithmetic, not
layout, and it broke on the fourteenth. The hero is out of the grid now and the column count
is computed; see **The picker had to stop being arithmetic**, above. A finished place still
shows what you are going back to beat, which is the single most useful thing the picker can
say to somebody deciding between sixteen doors.

## Manly, and the sea gets a shape

Three of these chapters are in Sydney and two of them are played on the harbour, which is a
flat pale sheet that exists to be fallen into. That is what harbour water IS. Seven hundred
metres north-east of the last one, over a low sandstone spine and down the Corso, is the other
kind — and the whole argument for a fourteenth chapter is that they are not the same thing and
the game had never once said so.

**The waterline is a function of position now.** For thirteen chapters `waterLevel` was a
number, one height for the whole sea, which is why Venice could have a tide (the number moves)
and nowhere could have a wave (the number is not a function of where you are). A biome may now
declare `localWater: true` and the controller asks `waterHeightAt(x, z)` instead. That is the
entire change to capybara.js; the other fifteen chapters cost one property miss. Everything
falls out of it: the animal rides up and down on the swell because the buoyancy spring it has
always had is now chasing a surface that moves, the swash picks you up off the sand because
"is there water here" is a question about both the water and the ground, and a wave arriving
is a thing that happens TO you rather than a thing drawn near you.

The swell is real shallow-water physics and it had to be, because the fake version does not
read. A wave travels at `sqrt(g*d)`, so as it comes up the beach it slows down and — its
period being fixed — it gets **shorter**: sixty-six metres out the back, thirty-two over the
bank, nineteen in the shorebreak. Waves bunch up as they arrive, which is what a beach actually
looks like from a beach and which hands the player three or four separate lines of white to
read instead of one long gradient. It is integrated once into a table of phase against distance
from the sandbar, and because the crest lines are contours of the bathymetry the swell refracts
round the bar without a line of code about refraction.

Nine crests in the set, eight and a half seconds apart — five of the nine break on the bank and
exactly one is *the* wave, and it comes round every seventy-six seconds whether anybody is
watching. Get in front of it and the water takes you: measured, forty-four to forty-six metres
from the bank to dry sand at five and a half metres a second. The bank is bent, so the break
peels along the beach and there is a peak to stand on. There is a **rip** at the west end — a
gutter through the bar where nothing breaks and everything drains, at 4.2 m/s against a swim
speed of 2.6, so it cannot be beaten by swimming at it, only crossed. That is not a difficulty
setting, it is the actual advice, and it is also the fast way out the back, which is exactly
what the locals use it for. And you can **duck-dive**: hold E and the bore, which is the top
metre of the column and nothing else, goes over you.

Also on the beach: a surf boat that launches on its own clock whether or not you are in it and
rows straight at the thing everybody else is swimming away from; an ocean pool cut into the
rock at Fairy Bower with flat water in it ten metres from water that is anything but; a blue
groper round the point at Shelly who will come and have a look at you; and the red and yellow
flags, which you can **pick up and plant somewhere else**, at which point the entire beach gets
up and follows.

## The Pantanal, where the capybara is not a novelty

Fifteen places and the animal had never once been anywhere it is from. That is the joke the
whole game is built on — a capybara in an opera house, a capybara in a souk, a capybara in a
hot air balloon — and it only works because there is somewhere it would not be a joke.

Nothing here is startled by you. Nothing chases you. Nobody takes your photograph. You are
about the fourth strangest thing in the frame, behind a bird the size of a person, a lizard the
length of a car and something with a tail like a chimney brush.

**The herd is the mechanic.** Wheek near another capybara and it comes; wheek again and the
next one comes. They string out behind you in a real line — each follower walks to where you
actually WERE, off a trail sampled every thirty-five centimetres, so the line bends round the
termite mound because *you* bent round it. There is no flocking and no steering behaviour,
which is why it cannot pile up, orbit, oscillate or walk through the thing you just went round.
The marquee is not a stunt: it is being at the front of five of your own kind going into a
river at sundown, and the sundown is not on a clock — it starts when you go in.

The rest of it is a road. The Transpantaneira is a hundred and forty-seven kilometres of dirt
on an embankment with a hundred and twenty-two wooden bridges, and the real one is missing
planks, so this one is too. Off it: a bay you cross on floating meadow that holds a capybara
for about a second and a half a mat, jacarés asleep on a sandbar (you can sit on one; they
genuinely do not mind), giant otters who will tell you exactly what they think of you, a jabiru
nest the size of a car up a dead tree with termite mounds for stairs, hyacinth macaws shouting
in an acuri palm, a cowbird that rides on your back because that is its whole job description,
and a giant anteater walking its lap of the campo on its knuckles, which will carry you the
length of it without breaking stride or ever noticing.

## Sơn Đoòng, and your voice is the torch

Sixteen chapters and the game had never turned the lights off. It has been night four times and
every one of those is a night with a sky in it — which is to say a night you can see perfectly
well.

Press **Q** in the dark and the cave answers. A pulse of light goes out from the animal, lights
whatever it reaches, and dies. So the wheek — which for fifteen chapters has been a noise you
make because it is funny — is the torch. That is not a new control and it is not a new button:
a capybara has one mouth and the context decides what the noise means. It has meant hello, a
condor, a ferry's horn, a burst of lift in the Drift and a ticket out of a chapter. Here it
means *where am I*.

Three things make light in here and they are the whole palette. Your echo, on a one-second
clock, reaching forty metres. The glow-worms, faint and permanent, which are the map — they
hang over the river and nowhere else, because that is where the insects are, so a player who
has understood nothing else can follow the blue-green dots and get where they are going, and
the reason that works is entomology rather than level design. And the **doline**: two hundred
and fifty metres up, the roof has fallen in, and there is a jungle growing on the floor
underneath the hole. None of that is invented.

The passage is ninety metres across and sixty to the roof. There is a river down one side with
something in it that has no eyes, a stalagmite twenty-six metres tall with a spiral of
flowstone ledges up it, a roost of swiftlets — who steer on sound as well, which is the joke
and is also true — and, at the far end, seventy metres of calcite across the whole passage
that you have to climb. Everything green in here leans the same way, because everything green
in here is growing toward the light.

## The picker had to stop being arithmetic

The title card's chapter grid was a bento: four columns, chapter one spanning two by two, and
therefore *exactly* twelve other chapters or a ragged half-row at the bottom. That is a layout
problem disguised as a maths problem and it held for precisely as long as there were thirteen
places.

- **The hero is out of the grid entirely.** Chapter one is a full-width row of its own above
  the shelf. It gets more space than it ever had, and the number of chapters no longer has to
  divide by anything.
- **The column count is computed.** `sysPickCols(n)` tries four, five and six and takes the one
  that leaves the fullest last row. Fifteen gives five and three full rows; seventeen gives
  six; nineteen gives five. Nine lines, and it will still have an answer at forty.
- **The shelf scrolls; the card does not grow.** Fifteen tiles is three rows and thirty would
  be six, and a card that grows without limit pushes the control legend — the only statement of
  the control scheme this game has — off the bottom of a 720p laptop. Measured: the card was
  803 px in a 720 px window before this and 717 after, which is the whole of it visible
  including the key list.
- **Every tile is the same object.** The subtitles run from three words to nine; clamped to two
  lines with a floor under the body, the shelf is a grid the eye can run down rather than a
  ragged wall of boxes.
- **The keyboard runs to twenty places** (`1`-`9`, `0`, then `–  =  [  ]  ;  '  ,  .  /  \`),
  and a row past the end of the table simply gets no badge and stays clickable.
- **The departures board carries the same pictures.** It is the other half of the same
  decision — which of these places do I want to be in — and it was answering it in a completely
  different language. Sixteen lines of text is a timetable; one small mark per row makes the
  board scannable by colour, which at sixteen rows is the only way anybody scans anything.

## A light that behaves like a light

There has been a composite pass between the scene and the screen for a while — bloom, an
S-curve, a per-chapter tint and a vignette. Looking hard at nineteen arrival frames turned up
the same two sentences over and over, though: **a light in this game was a sticker, and a frame
in this game had one tint on it.** The lamp on the Monte Carlo quay was a white disc with a
hard edge. Reykjavík's windows were yellow rectangles painted on a flat grey street. Sydney's
lawn, the sand of the Jemaa el-Fnaa and the Piazzetta were each one value from corner to corner.

Five things, and none of them is a texture, a mesh or a colour — the aesthetic law is exactly
where it was.

**A light now has air around it.** One scale of blur is the glow *on* a lamp; the halo is an
octave down and much wider, and it is what makes a bulb read as a source rather than a shape.
It is blurred out of the finished tight bloom rather than from a second reading of the scene,
so the two can never disagree. How much of it a chapter takes is per-chapter, because in Mong
Kok the bright pixels are neon and in Sydney they are a hundred square metres of sunlit sail —
turn it up in Sydney and you have fog.

**Small lights stopped flickering.** The bright pass ran at a quarter resolution and read one
of the sixteen pixels each of its texels covers, so a glow-worm, a window across the street or a
speck of sun on water blinked in and out of the bloom depending on where the sample happened to
land. It reads all sixteen now, for four texture fetches.

**The highlights roll off.** Everything over white used to meet a hard clamp, so a sunlit wall,
a bulb and a sheet of foam all arrived at the same flat white with a visible seam where they
got there.

**And the sun is warm while the shade is not.** The old tint was one multiply over the whole
frame, which is the one thing a grade cannot use it to say. Blue hour in Monte Carlo *is* warm
lamps against a blue sky, and now it looks like it. It is a couple of per cent, applied to the
top and bottom of the range with the middle left alone — turn it up and Sydney's lawn goes
olive, which is how we found out.

**The corner of the frame goes cool as well as dark**, because that is what a corner of a lens
does, and it is the half that makes the middle look lit instead of the edge look painted.

All five together cost **+0.009 to +0.021 ms**. Along the way it turned out the bloom's blur
was measured in pixels rather than in fractions of the frame, so **the halo shrank as the
window grew** and nineteen grades hand-tuned at 720p only existed at 720p. It is anchored now,
and measured: the glow around the lamp holds within 2% from 720p to 1440p, where it used to
lose a fifth.

## The frame found out how far away things are

The composite pass had colour in it and nothing else. The scene has always been rendered into a
buffer that carries depth as well, and that depth has always been thrown away the moment the
frame was drawn — so the whole chain between the world and the screen was working from a flat
picture. Nineteen arrival frames again, and again the same two sentences: **every frame in this
game is uniformly sharp from two metres to the fog, and every surface in it meets every other
surface on a clean seam.**

Venice is the clearest case. Sixty people between eight metres and forty-five, all of them
equally crisp, standing on a pavement that is one value corner to corner, under an arcade whose
arches read as flat panels rather than as holes. There was nowhere for the eye to land.

Keeping the depth costs the copy and nothing else, and three things come out of it.

**There is a focus now.** The animal is sharp, the far side of the square goes soft, and so does
the very bottom edge of the frame. It is what makes a photograph of a small thing look like a
photograph of a small thing, and it is the one cue no amount of grading can fake. Where the
focus falls is a multiple of how far the camera is from the capybara rather than a distance in
metres — which is what lets it stay right on a lawn, at a ship's wheel, and under a balloon
seventy metres up, without any of those places having to say so.

**There is air between here and there.** The fog in this game is linear and does not begin until
about eighty metres, and the camera is six metres up with the whole of the game happening
between three and forty — so aerial perspective, which is the cheapest depth cue there has ever
been, was switched off exactly where the game is. Now a wall thirty metres away carries a few
per cent of the horizon's colour, and the Transpantaneira finally goes somewhere instead of
running two hundred metres to a horizon at exactly the value it started at. It takes its colour
from the fog's own, so every event that already moves the weather moves the haze with it and the
two can never drift apart.

**And a corner is a corner.** There has never been any ambient occlusion in this game — not one
term, anywhere, in twenty-eight modules. The contact patches added a while back are a pool of
soft shadows under objects and cannot darken a box against a box, a wall against its own
pavement, or the inside of an arch. Now the food truck has a seam under its awning, the steps up
to the Opera House forecourt read as steps instead of stripes, the crates at the Antarctic
station separate from each other, and Venice's arcade is a recess.

The trick in that last one is telling a corner from a floor. The obvious version of it darkens
every lawn, every pavement and every dune in the game, because the biggest surface seen at a
grazing angle in any of these frames is the ground and it is half the picture — measured, it
took Sydney's grass down almost three levels of 255 everywhere. Sampling in opposed pairs and
taking the smaller of each fixes it exactly: on a flat surface, whatever its angle, one side is
nearer by as much as the other is further, so the pair cancels; in a real corner both sides come
toward you. The same measurement now reads **one thousandth** of a level on that grass.

**The ground stopped being one colour.** The noise field that breaks up the big surfaces varies
brightness and has never varied hue, and it runs from a metre and a half down to a few
centimetres — so there was nothing in it at the size of a patch. Grass yellows where it is dry
and goes blue-green in the damp; sand is pink loose and grey packed. There is an octave above
the others now, about sixteen metres across, and it moves colour as well as level: the bright
half of it goes warm and the dark half goes cool, which is not a shortcut but the actual case,
because a dip in a lawn is darker for seeing less sun and cooler for seeing more sky.

Frame time is **16.3–17.1 ms** in all nineteen chapters, which is the locked sixty it has always
been, and the composite pass itself grew by **0.01 to 0.46 ms** — though the instrument that
measures that has a noise floor of about a tenth of a millisecond, so only the total is worth
quoting.

Two things measured wrong first and both were the same mistake, which is guessing where the
picture is. The near blur was aimed at two to seven metres, and nothing on screen is nearer than
nine — so it did precisely nothing, byte for byte, in the two thirds of the frame it was written
for. And the haze was authored at twice what it is worth: at the first setting Sydney's harbour
came back grey-green, and the instrument could not see it happen, because mixing toward a pale
haze *raises* average brightness. Saturation is the thing to watch, and every chapter's is now
measured rather than judged.

## Performance

Measured live at 1280×760:

| | draw calls | triangles | bodies |
|---|---|---|---|
| Sydney | 130 | 61.5k | 129 |
| Pasto | 77 | 68.8k | 61 |
| Sydney Harbour | 50 | 12.2k | 10 |
| Kyoto & Uji | 50 | 44.5k | 128 |
| Cali | 53 | 59.0k | 62 |
| Rio de Janeiro | 47 | 48.6k | 44 |

Budget is <220 calls, <130k triangles, <130 bodies **per live biome**, 60 fps. Repeated flora
and crowd filler use `InstancedMesh` — the whole Andean landscape is one draw call, 700 plants
are six, and 260 bamboo stems are one. Static architecture bakes to one vertex-coloured merged
geometry per set-piece: the entire Circular Quay terminal is a single draw call and so is every
headland in the harbour. No allocations in any per-frame update.

Kyoto's forty-four torii are eighty-eight box colliders on **forty-four bodies**, not
eighty-eight: both legs of a gate ride one body (`kyoStaticPair`). That one change is the
difference between 172 bodies and 128.

## How it was built

A capped swarm: 1 coordinator, 5 developer agents (one per module), 4 harsh critic agents,
across a 30-round campaign. The coordinator locked `CONTRACT.md` first so the developers could
work in parallel without conflicting, then ran develop → build → critique → fix each round,
doing integration and live browser verification itself.

The pattern that mattered most was **independent verification**. Developer agents reported
confidently on work that did not survive measurement, three times. An adversarial verifier
agent — told to reproduce from a fresh page load and assume nothing — caught two hidden
gravity-cancellation cheats in the flight model that would otherwise have shipped, including a
launch assist worth +10.1 m of free altitude, farmable on every re-grab.

Bugs that only live playtesting caught, all fixed:

**The fourth pass — a verification sweep over all five chapters,** driving `game.tick()` from a
headless harness and reading the RENDERED frame back. Two faults survived the third pass, both
of them invisible to any test that only asks whether a task can be ticked:

- **The capybara was off screen for the whole of the torii run.** The tunnel is forty-four
  gates, 4 m tall and 5 m wide in the clear, spread over about 61 m of S-curving path — so they
  stand roughly 1.4 m apart. The camera boom is a straight line back from the animal at a fixed
  pitch, and the hill climbs at very nearly that same pitch, so all the way up the run the eye
  rode about 2.2 m over the ground it was passing. That is leg height. Measured on the live rig:
  boom 9.77 m, three meshes across the sight line at 5.1, 5.3 and 6.4 m, and no capybara in
  frame — for the longest task in the chapter. Raising the eye over the gates does not fix it
  either: at 1.4 m spacing under a kasagi 0.8 m deep the tunnel has a ROOF, and from above you
  get a red floor and still no animal. What works is the shot the place is actually famous for.
  The eye goes INSIDE the corridor, on the centreline, back along the **path** rather than along
  the boom, looking up the tunnel through the gate openings. Three things had to be true
  together and each was found by getting it wrong first: the eye is referenced to the ground
  under the **animal**, not the ground under itself (the rail point is downhill, and referencing
  it locally put the eye level with the animal's feet); the sight line is **solved** rather than
  guessed, by sampling the ground along it and lifting until it clears (eight samples, exact for
  the straight line it is testing); and the rail **stops walking back** once the path has fallen
  more than 1.5 m below the animal, because staying under the gate over the eye and staying above
  the animal only coexist near its own level — which also shortens the boom on the steep pitches,
  leaving fewer stair noses in the way.

  Honest about where this landed: the tunnel now reads as the tunnel and the animal is framed in
  it for most of the climb, against a baseline where it was visible nowhere on the run. On the
  steepest two or three pitches a stone tread can still cut across the animal when it comes to
  rest in exactly the wrong spot; it clears as soon as it moves. Three separate automated
  visibility metrics were tried and all three proved invalid — a raycast that counted the
  capybara's own body as an occluder, a colour histogram that missed it under shaded light, and
  a hide-and-diff that hid the wrong node — so the framing above was judged from rendered frames
  by eye, and the residual is stated rather than measured.
- **The second passage to Manly was dead scenery.** `onEnter` put the ferry back alongside at
  Circular Quay — "a fresh arrival is always a fresh departure" — but left the voyage flags
  where the last trip had ended them. The travel chain loops back through Sydney, so you can
  stow away and return to the Quay; on that second visit `arrived()` already answered true
  before you had cast off, so the arrival never re-armed, the horn under the Bridge had no joke
  in it, the regatta mask was spent at -1, and the dolphins had been earned once and would never
  come back. The checklist stays ticked — that is systems.js's business — but the staging now
  resets with the boat.

Verified after both: a 120-second random-walk soak in Sydney with the hop bound in (zero
exceptions, camera 8.3–13.1 m, longest stall one frame); a complete chapter-3 passage in 63.6 s
ticking cast-off, the dolphins, the Bridge, the regatta and the arrival, and a second passage
after a round trip that stages all of it again; all seven of Kyoto’s playable tasks; *Post
something into the crater* and *Scatter the coffee harvest* end to end off a 60 ms tap on the
grab key; and all five biomes inside the perf budget with no exceptions.

**The third pass — smoothness, juice, and a bug hunt.** Measured with a headless harness that
drives `game.tick()` at chosen frame times and reads the RENDERED transform back:

- **The landing had never fired.** `const wasAir = !grounded`, evaluated on the very frame the
  contact appears — on which `grounded` is already true. So the branch required
  `grounded && !grounded`, and the landing thud, the camera bump for a long fall and the
  squash had never been seen or heard by anybody. Now keyed off the previous frame's air time,
  with the impact speed remembered from the fall (the solver has already resolved the contact by
  the time capybara.js runs, so `velocity.y` on the landing frame is about zero).
- **The rendered transform sawtoothed under variable frame time.** cannon's interpolation alpha
  is `accumulator / step` measured AFTER the substeps, so when frame times wobble some frames
  take two steps and some take none and the alpha is not monotonic. Both the capybara and the
  condor now PREDICT with the velocity the solver just produced and correct toward the
  interpolated transform, which is exact at constant velocity — measured, rendered speed holds
  to 0.1% under ±30% of jitter on dt — and eats the sawtooth the rest of the time.
- **The camera's eye and its look target were damped at different rates** (7 and 5). The camera's
  ANGLE is the difference between two independently smoothed points, so unequal rates wobble the
  angle even when both points are perfectly smooth. Harmless at 9.5 m on the ground; a visible
  shimmy of the whole horizon at 24 m behind a condor. Matched in flight.
- **The harbour rippled at the display rate**, not in seconds: `quayRippleT += 1/60` inside a
  `dt`-driven update, so the swell ran 2.4× too fast on a 144 Hz panel.
- **The capybara moved in total silence.** Everything else in the mix is an EVENT; a footfall is
  the texture underneath them. Footsteps now fire off the gait phase itself (two per cycle — a
  capybara is a diagonal-couplet walker), with three surface voices chosen by a handful of
  rectangle tests: soft ground, stone, and hollow timber for a wharf or a deck.
- **The ambient bed put Sydney seagulls over a Kyoto temple garden.** It was written as "a gull,
  unless you are in the Andes", which was right for two biomes and wrong for five.

**The second pass — reported as "the Sydney map seems very buggy: after a few moments the capy
drifts off the screen and it can't move any more and the game kind of stops."** That is two
separate faults, both reproduced in a headless harness that drives `game.tick()` with synthetic
key events:

- **The harbour was a one-way trip.** The sea wall is a solid box whose top stands at y = 0.45
  and the capybara floats at y = -0.42, so a swimmer pressing the stick at the shore pushed
  into the wall for ever: position pinned at z = -10.68 with a standing 0.92 m/s of intent, and
  no way back onto land anywhere within 25 m of the Opera House. Fixed by giving the animal a
  clamber — latched, not per-frame, because the swim state switches off 0.25 m into the climb
  and a per-frame version oscillates at 2 Hz and never gets out.
- **The camera's Opera House keep-out was four times the size of the Opera House.** One fat AABB
  (x ±14.5, z -13.5..5.5, y < 17) covering the whole podium footprint from the ground up. Walk
  north across the forecourt, or swim anywhere off the seaward face, and the boom was inside it
  on every frame; the pull-in bottomed out and the last-resort fallback parked the eye at y = 20
  and left it there. From twenty metres up at a 41° pitch the capybara is four pixels of brown.
  Replaced with one leaning ellipse per vault and a rise capped at 6.5 m above the anchor.
- **A quick click never picked anything up.** The 0.10 s grab wind-up was cancelled the instant
  the key came back up — and 0.10 s is shorter than a mouse click. Measured against a 60 ms tap
  the grab never fired at all. This is also why *Scatter the coffee harvest* and *Post something
  into the crater* both read as broken: they are grab tasks.
- **Boarding the condor threw away whatever you were carrying.** capybara.js runs before
  condor.js, so one press of E released the prop *and* mounted the bird. The crater is only
  reachable by air, so 'Post something into the crater' had no route at all. Now the capybara
  defers when the talons are in reach, and while flying the action key is a bomb release rather
  than a dismount.
- **One exception killed a module for the rest of the session.** main.js spliced any updater out
  of the loop on its first throw, silently. A single bad frame in capybara.js therefore ended
  the game — the animal stopped answering the keys and drifted wherever the solver left it,
  which is the other half of the reported symptom. Modules now get three strikes and a visible
  report.
- **The bamboo dash could never complete.** `if (kyoBambooEnter < 0)` as a not-yet-entered
  sentinel, in a grove centred at z = -44: every honest entry z is negative, so the mark was
  re-armed every frame and the distance travelled was always zero.

- **The condor could not carry the capybara.** Airspeed collapsed from 19.3 to 0.7 m/s on
  mounting; ceiling 8.8 m against a 45.6 m crater rim, so Pasto was unfinishable. Three
  real causes: the roll stick was sign-inverted (commanded east, the bird rolled west and
  locked onto the exact reciprocal heading, so it could never be flown into a thermal at all);
  lift was applied along the body up-axis instead of perpendicular to the relative wind, so
  letting the nose fall off the flight path stopped the wing being a wing; and the wingbeat
  added 15% of body weight as free vertical lift.
- **Half of all pickups flew the passenger into the church.** The autopilot's obstacle table
  entered built structures 3 m lower than they stand, and the capybara hangs 2.43 m below the
  talons — so the bird flew a "1.29 m clearance" and put its passenger 1.71 m inside an 8.9 m
  roof. Every failed drop clustered at the church's leading edge.
- **A phugoid pumped by the ground-avoidance wingbeat.** Clearance extrapolated the momentary
  sink rate over a full 1.4 s, so a bird 10 m above the flat plaza read 0.2 m of clearance and
  lit the avoidance beat at the bottom of every cycle — a 20 m porpoise every 3 seconds.
- **The bird crossed the lift instead of circling it.** The trim schedule made it fly *faster*
  as it banked, giving a 28 m circle across a 26 m thermal.
- **Grab was impossible.** `input.action` was recomputed in systems.js, which runs *last*, so on
  the press frame the capybara saw `actionPressed === true` while `action` was still `false`.
- **`capy:grab` and `capy:drop` were never emitted by anyone.** props.js deferred to
  capybara.js, capybara.js deferred to props.js, and npc.js + systems.js listened forever.
- **The ground was an infinite `CANNON.Plane`**, which also floored the harbour, making `swim`,
  `ball-harbour` and `hat-harbour` unreachable.
- **The ferry did not exist** — only its state variables and route table did.
- **Six synthesised audio voices were missing from the dispatch table**, so every cross-module
  call to them was silently dropped.
- **The smoke plume and thermal motes rendered as dark floating rocks.** Both passed
  `vertexColors: true` on geometry with no colour attribute; WebGL supplies (0,0,0), so every
  puff was multiplied to black.


## Monte Carlo, where somebody minds

Chapter eighteen is the first place in this game that is ever CLOSED to you.

Seventeen chapters are a sandbox with a list on it: everything in them can be done in any
order, from anywhere, with anybody watching. That is the right rule for a public garden and
it is the wrong rule for the one building on earth whose entire business model is a man on a
door deciding whether you come in. So the Casino de Monte-Carlo has an inside — the only
building in this game that does — and five croupiers who sweep it, and their cones of
attention are real translucent wedges on the marble that go red as they fill. At full you are
picked up under the forelegs and put back on the steps.

**The whole penalty is ten seconds and whatever was in your mouth.** Nothing becomes
impossible, nothing is lost, and you may walk straight back in — the chapter is about dignity,
not about failure. And it is built entirely out of verbs you already have: sitting down halves
the range at which a cone finds you, running raises it by half again, and carrying something
raises it a little. There is no meter, because this game has never had one.

There is also an economy, which is a first: a mother-of-pearl plaque is a real prop you can
carry in your mouth, the roulette wheel is a real turning disc you can also stand on, and
dropping a plaque into a moving wheel pays what the pocket says. Red two, black one, and green
pays eight and the whole salon stops talking. Nothing is ever lost — the two seconds of
watching is the pleasure, not the arithmetic.

And the Grand Prix runs on the streets, so the streets are the circuit. Three cars lap
Sainte-Dévote, the climb to the Casino, Mirabeau and the Fairmont hairpin on their own clock
whether anybody is watching or not. The hairpin is the only place on the lap they are doing
under six metres a second, which is the only place a capybara can get into the cockpit of one —
and a hundred and eleven metres later the world closes over for four and a half seconds of
tunnel and then hands you the entire lit harbour at once. That is the marquee, and like the
condor and the herd it is a thing you do by not doing anything: you are not being clever, you
are being carried by something very much larger than you at ninety-five kilometres an hour.

The score is the fifth band in this game and the first that is a piece of fiction. Nothing is
actually playing in Monaco. What is playing in Monaco is what you have in your head the moment
you see a casino, a dinner jacket and a silver car — a minor triad with a major seventh sitting
on it, a tremolo-picked guitar through a very hard spring, a walking upright, brushes and a
ride, and a brass section that plays four notes about once every eight bars and is the loudest
thing in the principality when it does.

For three versions the loud half of that band had never played a note. The arrangement is
written against how much is going on in the world — the eye, the stack, the circuit — and the
number it reads was declared, read in four places and set by nobody, so the section sat
permanently at rest: no doubled brushes, no harder picking, and horns every eighth bar instead
of every fourth. The riff, meanwhile, was playing each bar twice in unison with itself, and the
chord the whole joke rests on was written without the one interval that makes it that chord.
It is wired now, and it does the thing.

**And the jacket goes on.** There is a dinner jacket over the back of a lounger on the sun deck
of a boat nobody invited you onto, nine metres above the harbour. Taking it used to tick a line
and leave a dinner jacket in a capybara's mouth. Now the animal puts it on — midnight cloth over
the shoulders, a satin shawl collar, a black bow under the chin and a pair of sunglasses with a
brass rim — and wears it for the rest of the evening. It was the first costume in the game, and
it turned out there should be ten.

Getting up there is also, now, possible. Both companionways on that boat were drawn and collided
*inside* the deckhouse they were meant to climb, so the whole vessel above the main deck was one
solid block: the jacket sat in plain sight on a deck with no route to it, and going off the top
deck into the harbour could not be done either. Two of the chapter's seventeen lines were
uncompletable and neither of them said so. The flights are in open air now — up the back, along
the side, up the front — and the walk from the passerelle to the lounger has been done, one leg
at a time, with a stopwatch on it.

## Nine things the other places teach you

Ten chapters give you something to wear. The other nine give you something to
**do** — and the difference is the point. A costume is that chapter's joke and it
stays there. A skill is a thing the animal learned, so it comes with you.

Walk the crater rim right round at two and a half thousand metres, which nobody
asks you to do, and you have done altitude training whether you meant to or not:
you run for fourteen seconds instead of ten and get your breath back in half the
time, everywhere, for the rest of the journey. Stand still in the Kyoto bamboo
until the bamboo is the loudest thing there and you come out with soft feet —
people still jump when a capybara runs into them, they just stop holding it
against you. Dance salsa properly in Cali and you can hear the pulse in the other
eighteen places; land a hop on the beat anywhere and the step carries.

Take the glacier down in one go and you learn what an edge is: you still cannot
stop on ice, but you can decide where you come out, and the same is true of
Antarctic blue ice and wet stone. Let the Marrakech acrobats throw you and you
work out what a wall is for — hop again while you are on one, once per jump.
Hang off a driftseed for twenty seconds and you learn what a seed is *for*: hold
the hop key on the way down and you come down like one, slowly, drifting, which
turns a fall into a decision. Go up the bamboo scaffolding in Kowloon and you get
the last half metre — a jump that arrives at a lip with its chin over it now
finishes instead of sliding back down the face.

The Pantanal is the one place in the game where you are not a novelty, and it is
the only chapter that teaches two things. Take the whole herd across the river
and the water stops being somewhere you are on your way through: you can just sit
in it. Any water, anywhere. And get five of your own kind to follow you and you
find out that it works on **anything** — see below. And cross a Hanoi road
without stopping and you have learned the only thing that city teaches — hold
your line and the line opens. People step out of a committed animal's way in the
other eighteen chapters too, and the moment you waver, they stop.

## Wheek at it, and keep wheeking

The herd is the one skill that is a whole system rather than a number, and it has
two rules that stop it being a switch you flip once.

**It is on a timer.** One wheek buys you twenty-one seconds of company. Nobody
joins a collection; they fall in behind you for a while and then they wander off,
so keeping nine animals in a line across San Marco is a performance you are
actively giving rather than a score you have banked. Stop asking and you are on
your own inside half a minute.

**And some of them take more asking than others.** A pigeon in St Mark's Square
will follow anything that looks like it might have a plan — one wheek, and ninety
of them turn round. So will an Icelandic sheep, a Pantanal cow, a gentoo penguin
standing about between the nests, and the very first animal you ever meet: a
Sydney ibis, which will take a chip out of a stranger's hand and has no opinion
at all about dignity. A Göreme rooftop cat wants asking twice, and the first wheek
gets you a long look and absolutely nothing else — which is both the truest thing
about a cat and the clearest possible statement of the rule. So does a Manly
silver gull, which will mug you for a chip unasked and will not walk anywhere for
anybody without being asked properly.

And at the top of the scale there is exactly one animal: the grey heron in the
Kyoto garden. It takes three, and it flushes if you come within nine metres — so
the only way to get it is to stand back further than that and ask, and ask, and
ask. One bird, and it is worth more than the hundred and eighty pigeons.

Three animals were offered the job and had it taken back off them, and the
reasons are the rule for what can be offered at all. The Antarctic leopard seal
was going to be the second three — a wading bird and the apex predator of the
Southern Ocean, both eventually walking behind a rodent — but she notices
anything within twenty-four metres and goes into the water, and a wheek only
carries fifteen, so there is no distance at which she is both on the ice and
within earshot. The Pantanal's caimans are floors you stand on, with colliders
baked where they were built, so moving one takes the animal through it. And the
Pantanal's own capybaras already have a herd of their own, and two systems
arguing over the same nine animals is worse than one.

Nothing ever ignores you. That is the rule that makes the rest of it legible: a
three-wheek heron still turns its head on the first wheek, exactly like everything
else within earshot. You can see that you were heard and you can see that it has
not moved, and those two facts together are the whole tutorial — there is no
meter, and there was never going to be one.

They walk down the path you walked, so a line of them cannot pile up, cannot
orbit you and cannot walk through the thing you just went round. And they do not
come with you when you leave: a string of Venetian pigeons following a capybara
through a Vietnamese mountain is a different game.

Three of the nine let you reach places you could not reach before, which is what
they are for. None of them changes how high you jump. Eighteen chapters of
geometry are built against a 1.37 metre arc and moving it is the one thing that
could quietly make something in this game impossible — so the wall-kick is a new
jump rather than a bigger one, the glide can only ever slow a fall, and the beat
bonus goes forwards and never up.

## Ten things you can only be wearing because of what you did

Ten of the nineteen chapters ask you to do something that implies a piece of kit, and the rule
for earning one is always the same: **the task has to be the reason you have the thing.** Not a
badge for finishing a place — the object the task was about. So five of the ten are not their
chapter's marquee at all.

You steal a tourist's hat in the gardens on the first afternoon of the game, so you spend the
rest of that afternoon wearing a tourist's hat, askew, because a hat a rodent has taken off a
person is not a hat that fits. You bring the ferry alongside at Manly and you get the master's
cap — not for taking the helm, which anybody can do in open water, but for the landing. You
samba down the avenue on the two and the avenue puts seven feathers and a gold collar on you.
Stand on the prow of a gondola all the way down the canal and you have effectively applied for
the job: straw boater, red band, neckerchief. Go under for the first time in Palawan and you
come up in a mask and snorkel, which is the only one of the ten that is equipment rather than
uniform. Be up over Göreme when the sun clears the rim and you have the pilot's leather cap with
the goggles pushed up where a pilot keeps them. Take the biggest of the set all the way to the
sand at Manly and the club gives you the red and yellow cap. Get deep enough into Son Doong that
the light becomes a thing that happens to you, and you have a caver's helmet with a lamp on it
that is genuinely lit — the only glowing thing in the wardrobe, because Son Doong is the only
place dark enough for it to matter. Run with the pod at the bottom of the world and Antarctica
lends you a coat with a fur ruff round the hood, which frames the animal's face instead of
covering any of it and is the best thing in the set.

None of them travels. The jacket is Monte Carlo's joke and the mask is Palawan's verb, and a
capybara wearing either of them inside a Vietnamese mountain is in fancy dress rather than
wearing the thing it just earnt.

They are cheap — thirty-one meshes bare, four to eighteen more with something on — and they are
built once when the animal is, sitting invisible until the moment they are yours. The two rules
that cost the most to find are both about the shape of a capybara: the ears reach higher than
the top of the skull, so any brim worth having sits *under* them and lets them through; and there
is no neck at all, so a shirt front on the chest is a shirt front nobody will ever see. The only
part of this animal that reads as a throat is four centimetres under the front of its jaw.

## Hanoi, where the road is not going to stop

Chapter nineteen has a third thing in it that eighteen chapters do not: a floor you walk on, an
obstacle you go round, and **two hundred and forty motorbikes**.

You cross a road in Hanoi by walking into it at a steady pace. Not by waiting for a gap — there
is no gap, there has never been a gap, and anybody who waits for one is still on that kerb at
the end of the chapter. You step off, you hold your line, and two hundred people you will never
meet go round you. Every rider on the map can see the animal and swings out and lifts off for
it; what decides whether that works is your own speed and heading, because a rider commits to a
line about a second and a half ahead and that is only where you are going to be if you keep
going. The record for the crossing is not a time. It is **how many of them had to go round you**.

Stop dead in the middle of it and nobody hits you. They JAM — everybody brakes, nobody says
anything, and half a minute later there are forty of them stopped in a fan around one
capybara, which is what really happens and is much funnier than a shove. It is also how you get
on one, because a stopped scooter is a thing you can hop into. And while you are in the AIR
nobody is looking up: any rider inside seven metres stops avoiding and lines up under you
instead. Hop into the traffic. That is the verb.

Then there is Train Street. A metre-gauge railway runs down an alley with a hundred people
living in it, and twice in the chapter a horn sounds up the line and **the entire street folds
itself away** — awnings in, stools in, tables in, everybody flat against their own front door —
and eleven seconds later a train comes through at eleven metres a second with forty-five
centimetres to spare. Being in it is the marquee, and it is deliberately a thing you do by NOT
MOVING, which is the exact opposite of the chapter's other two.

And in the middle of all of it there is Hoàn Kiếm: eighty metres of still green water with a
tower on an island in it and a red bridge over one corner. Everything quiet in this chapter is
inside the ring road and everything loud is outside it, which is a whole city's worth of design
done by a lake.

## Antarctica, and you are not walking anywhere

The seventeenth place, and the first one where WALKING is the exception. Everywhere else in
this game the animal's feet are the chapter and a vehicle is a set piece; here it is the other
way round. The verb is STEER — the same verb chapter 3 taught on a warm harbour — and this is
what it looks like when the water is trying to stop you.

**The pack is a field, not scenery.** `antIceAt(x, z)` returns how much broken ice is on the
water, and everything reads it: the tender's top speed, her acceleration, the sound she makes,
and the colour of the sea. Threaded down the middle is a **lead** — a wandering trough of open
water — and finding it is the difference between a two-minute run to the gate and a
seven-minute one. Nothing marks it and nothing needs to: open water is dark and pack is white,
from a hundred metres.

**Six frictions, and they are places.** Station rock holds you completely. Snow nearly.
Iced timber not quite. A pan of sea ice less than that. The packed track four thousand gentoos
have worn down the hill, less again. And the polished blue tongue of the glacier not at all.
Every slippery place has a grippy way back to the top of it, because a slope you cannot climb
is a wall and not a run.

**And the pod.** Six orcas patrolling the deep, on their own clock, whether or not anybody is
watching. Wheek at them from the tiller and they come; they form up on the bows and quarters
and stay there; and a hull sitting in that much moving water goes faster than it has any right
to. Holding station with them at speed, in the pack, is the marquee — and it is deliberately
not a cutscene, because it is made of the two mechanics the chapter has already taught you.
Stop the boat instead and one of them will come up and look at you.

Thirteen lines on the list, one marquee and two set pieces. The way out is the head of the
station jetty, once the pod has come at least once.
