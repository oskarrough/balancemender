# Playtest feedback

Raw feedback gathered during play. This document records the observed problems and desired outcomes without committing to implementation details.

## Splash and dungeon selection

- [x] Give **Create Custom Game** slightly more inline padding so it matches the buttons above it.
- [x] Add about `0.3rem` more space between **Choose Your Dungeon** and the dungeon cards.
- [x] Add slightly more space below the title, perhaps around `5vh`.
- [x] Locked dungeon cards should have a tooltip explaining the unlock requirement, for example: “Complete [required content] to unlock this dungeon.”
- [x] When a dungeon is selected, have its room background available immediately for the transition. Currently the screen fades to the plain page background and then fades the image in; avoid that intermediate step if possible.

## Dungeon-card progress

- [x] The splash card for a dungeon should show which of its rooms have been mended.
- [x] Give completed room dots a distinct color, consistent with the completed-room treatment in the Journal.
- [x] In particular, after all five rooms in the green dungeon have been mended, all five dots on its card should visibly reflect that.

## In-game panel layout

- [x] The initial number and arrangement of panels feels overwhelming.
- [x] Group the default panel layout more tidily:
  - [x] Keep the Journal at the top right.
  - [x] Stack the other panels against the left edge.
  - [x] Keep the stack above the action bar, approximately `80px` from the bottom-left corner.
- [x] Make collapsed panels less wide.
- [x] Add a **Tidy Panels** menu action that restores all panels to those default positions.

## Dungeon pager and persisted progress

- [x] Opening the green dungeon unexpectedly resumed at **5-5 Harok**. It was unclear whether this meant the fifth room or progress restored from a previous session.
- [x] Keep the progress dots in the dungeon pager. The number alone does not make the player's position clear enough.
- [x] Center **Plan Reset** below the dungeon pager so it visually hangs beneath it.
- [x] Leaving and reopening a dungeon currently resumes at the previous room. Resuming may be reasonable, but the player also needs a clear way to abandon or reset the current run and start over.
- [x] Make the distinction clear between:
  - [x] leaving and later resuming a dungeon;
  - [x] quitting or abandoning its current run;
  - [x] resetting its progress.

## Victory message

- [x] Replace **Dungeon Cleared** with **Mended&hellip;**
- [x] State specifically what was completed beneath the heading.
- [x] Distinguish intelligently between completing one room and completing the entire dungeon. A room result could communicate its position, room name, and dungeon name, for example:

  > **Mended&hellip;**  
  > Room 3 of 5 — _[Room Name]_  
  > in _[Dungeon Name]_

- [x] A final-room result should make it clear that the whole dungeon was completed without implying that every ordinary room victory cleared it.

## Journal presentation and current-room state

- [x] Show mended rooms with a strikethrough instead of repeating **Mended** to the right of each one.
- [x] The **Here** marker can show the wrong room. After reopening the green dungeon at **Stray Pub, room 1 of 5**, the Journal still marked **Rust-Dry Bed** as **Here**.
- [x] Ensure the current-room marker follows the room actually being played after switching, reopening, resuming, or resetting a dungeon.

## Unlock/progression bug

- [x] The Journal showed all rooms in the green dungeon as mended, but the Rust dungeon still could not be selected.
- [x] Check whether unlock progress is failing to update or whether the actual unlock requirement differs from what the Journal communicates.
- [x] This may be related to the stale Journal current-room state.

## Lance audio — future polish

- [x] Casting **Lance** currently sounds like any other heal.
- [x] Reusing the generic cast sound is fine.
- [x] The sound played when Lance's effect or aura is applied should be distinct from the standard healing sound.
