Changelog

All notable changes to this project are listed here.

v0.5 — first public release

Added

11 races: Human, Blazeborn, Feline, Merling, Arachnid, Shulk, Undead,
Golem, Turtle, Bee, Slime.

Selection menu with a carousel and arrow navigation.

Automatic menu popup on world entry.

Silent client-host channel through ogset, ogwater, ogrotten. Internal
messages are not displayed in chat.

State reset on world exit — the origin is cleared and the menu appears
again on the next world entry.

Client-side effects:

- Flight for Bee
- Speed and jump boost in water for Merling and Turtle
- Slowness for Turtle on land, Merling on land, Feline in water,
  Undead during the day
- Anti-knockback for Arachnid and Shulk
- Wall climbing for Arachnid
- Night vision via gamma for Feline, Merling and Turtle in water
- Water damage for Blazeborn
- Rotten flesh detection for Undead through hunger effect tracking

Fixed

BigInt arithmetic errors when reading world time and player positions.

Water detection now uses block IDs 8 and 9.

Under-sky detection uses player brightness — more reliable than block
scanning in this build.

Day and night detection uses worldTime with several fallbacks.

Menu flashing when re-entering a world.

Known limitations

Undead — hunger from rotten flesh is compensated with Saturation I for
20 seconds.

Blazeborn — water damage through instant_damage, real fire is not
supported.

Chat — ASCII only.

v0.1 — v0.4 (internal versions)

Early prototypes of the origins system and chat bridge. Not publicly
released.
