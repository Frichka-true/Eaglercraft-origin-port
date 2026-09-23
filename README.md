<img width="1919" height="1033" alt="image" src="https://github.com/user-attachments/assets/69aa96f4-f9a9-4d9e-a025-774aba489021" />Origins - Eaglercraft 1.8.8

A small origins mod for Eaglercraft 1.8.8. When you enter a world, you pick
a race that gives you unique abilities and drawbacks. Works in singleplayer
and LAN multiplayer.
*It is port is not official and does not pursue commercial goals*

Screenshots

Origin selection menu:

<img width="1919" height="1025" alt="image" src="https://github.com/user-attachments/assets/c06f7fb8-826b-4cac-9f4b-ad8c4e57c73e" />


Playing as Bee (flight):

<img width="1919" height="1033" alt="image" src="https://github.com/user-attachments/assets/c5f841dd-9976-4b42-8bac-d1f815553363" />


Blazeborn taking damage in water:

<img width="1918" height="1031" alt="image" src="https://github.com/user-attachments/assets/16d31958-98c2-4364-86e4-684d866fb34e" />

Arachnid climbs the wall:
<img width="1919" height="1033" alt="image" src="https://github.com/user-attachments/assets/e2b043c0-60db-4fd9-b6b0-bc207cdd8c9c" />


**What it does**

When you first enter a world, a menu pops up with a carousel of races. The
left and right arrows cycle through options, the Select button confirms your
choice. After picking, the menu closes and your chosen race starts working.

When you leave the world, the origin is reset. Next time you enter, the menu
appears again.

In multiplayer, clients do not need operator rights. All effects are applied
by the host, and clients only report their own state through a silent
internal channel.

**Installation**

1. Download Eaglercraft 1.8.8 (You need a decompiled version.(Current link:https://github.com/3kh0/eaglercraft-builds))
2. Download EaglerForge (https://eaglerforge.github.io/EaglerForgeInjector/)
3. Inject EaglerForge client and server eaglercraft
4. Download origin.js
5. Inject Origin.js for your mods list on server and client
6. The mod requires cheats to be enabled in the world by the host (server-side).

For multiplayer, install the file on the host and on every client.

**Origins**

11 races in total. Here is the full list with abilities and drawbacks.

*Human*-
  Abilities: none
  Drawbacks: none

*Blazeborn*-
  Abilities: fire immunity
  Drawbacks: damage in water

*Feline*-
  Abilities: permanent night vision
  Drawbacks: Slowness II in water

*Merling*-
  Abilities: water breathing, night vision in water, Speed I and Jump
  Boost II in water
  Drawbacks: Slowness I on land, permanent Weakness I

*Arachnid*-
  Abilities: wall climbing, Jump Boost I
  Drawbacks: Weakness I on the surface

*Shulk*-
  Abilities: Resistance II, anti-knockback
  Drawbacks: Slowness I

*Undead*-
  Abilities: Strength I, rotten flesh gives Regeneration, Speed,
  Resistance and Saturation for 20 seconds
  Drawbacks: Slowness III on the surface during the day

*Golem*-
  Abilities: Resistance II, Strength II
  Drawbacks: Slowness I

*Turtle*-
  Abilities: Resistance I, water breathing, night vision in water,
  Speed I and Jump Boost II in water
  Drawbacks: Slowness II on land

*Bee*-
  Abilities: flight, Speed I
  Drawbacks: Weakness III

*Slime*-
  Abilities: Jump Boost II, Speed I
  Drawbacks: Weakness II

**Requirements**

Eaglercraft 1.8.8 - server.html and client.html.

Cheats must be enabled on the host. Clients do not need OP.

I was unable to implement them exactly as intended, 
so I adapted certain races to my own liking 
(Note: I couldn't implement some races exactly as in the original, so I adapted them. Their abilities and drawbacks may differ from the original Origins.).

**Configuration**

The mod auto-detects host vs client from the URL (server.html is the host).
No manual setup is needed for a standard LAN world.

**License**

MIT. Full text in the LICENSE file.

**Feedback**

Issues and pull requests are welcome. Before submitting, test your changes
in both server.html and client.html - the logic differs between them.
