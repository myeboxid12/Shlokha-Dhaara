# Shlokha Dhaara · Shloka Gurukul for Children

*Sacred learning, timeless traditions.*

A website where children aged 4 to 15 learn, practise and memorise Sanskrit shlokas, with a daily plan and tools for parents and teachers.

## What's inside

- **Shloka library:** 60+ shlokas on 13 shelves: Morning, Everyday, Bedtime, Ganesha, Saraswati, Vishnu (with Rama and Krishna), Shiva, Hanuman, Devi, Guru, Bhagavad Gita, Peace mantras and Wisdom verses. There is also a Festival shelf. Every shloka has:
  - Devanagari text
  - transliteration (IAST)
  - word-by-word meanings
  - a simple English meaning
  - its source
- **Listen and repeat:** the guru voice uses the device's Hindi voice, at normal or slow speed. Words are highlighted karaoke-style as they're recited, and *Repeat after Guru* pauses after each line.
- **Record yourself:** recite the shloka, play it back, and compare it with the guru.
- **Daily plan:** each child gets a plan sized to their age and daily minutes:
  - a warm-up
  - one step of the 7-day memorisation path
  - spaced revision of shlokas already learned
  - a game

  A week-ahead view shows what's coming next.
- **Game zone:** Fill the Missing Word, Match the Meanings, Memory Cards, Word Arrange and the Shloka Puzzle.
- **Progress:** points, a streak, 12 badges, a weekly practice chart, the 21-day challenge and a downloadable certificate.
- **Parents and teachers:**
  - more than one child on a device, each with their own report
  - screen time and recent achievements
  - daily reminders as a calendar file or browser notification
  - backup and restore
  - printable worksheets
- **Festival calendar:** the shlokas that go with each major festival.
- **Works offline** and can be installed to the home screen. It has light and dark modes.

Everything runs in the browser. There are no accounts, and progress stays on the device.

## Structure

```
index.html            page shell, header, navigation and icons
assets/styles.css     design (saffron, gold, white, sky blue)
assets/app.js         views, daily planner, audio, games and progress
data/shlokas.js       categories, festivals and every shloka
sw.js                 offline cache
```

### Adding a shloka

Add an entry to `SHLOKAS` in `data/shlokas.js`. The comment at the top of that file lists the fields. Give it a new `id` and never change the `id` once the entry is published, because saved progress refers to it.

## Planned

These need accounts and a server:
- a teacher dashboard
- family accounts that sync across devices
- community uploads and competitions
- AI pronunciation scoring
- meanings in Hindi, Telugu, Tamil and Kannada
- recorded audio and video by teachers
