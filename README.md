# GradeLens: Canvas Grade Calculator

Shows your real grade in every Canvas class, even when the teacher hides totals.

- **Grades page panel**: calculated % and letter, category breakdown, drop rules applied
- **What-if**: type any score (`18`, `90%`, `18/20`) or add a hypothetical assignment
- **What do I need?**: pick a letter and see the average you need on the remaining work, including empty weighted categories like a final exam
- **Custom weights**: set category weights from the syllabus when Canvas doesn't have them
- **Custom drops**: set how many low scores each category drops
- **Missing = 0**: count missing work as zeros
- **Export CSV**: download icon in the panel (one course) and popup (all courses)
- **Your grading scale**: letters and GPA from the Grade Scale app (percent rounds up, A+ = 4.33)
- **Dark Canvas**: moon icon in the popup turns every Canvas page dark (hue-preserving, so photos and colors stay true)
- **Accent color**: palette icon in the popup recolors Canvas links, buttons and nav: red (Canvas), blue, green, yellow, purple, orange
- **Popup + dashboard badges**: every course at a glance, with average and GPA

Math matches Canvas's own calculator (checked against 3 real courses, including weighted and drop-lowest ones): `node test/core.test.js`.

## Install
Works in Chrome and other Chromium browsers, such as Edge, Brave and Helium.

1. Download the zip from the [latest release](https://github.com/PeterPari/gradelens/releases/latest)
2. Unzip it and keep the folder somewhere permanent (deleting it removes the extension)
3. Open `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked** and choose the unzipped folder
6. Open any Canvas course → **Grades**

To update, download the new zip, replace the folder, and click the reload icon on the GradeLens card in `chrome://extensions`.

## Limits
- Only works on Canvas sites at `*.instructure.com`, not custom school domains
- Letters and GPA use one fixed scale (A = 93, A+ = 4.33), so they may not match your school. Percentages are not affected
- School-managed Chromebooks often block Developer mode
