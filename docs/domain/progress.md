# Progress page

`/progress` shows how things are going over the last **4, 12 or 26 weeks**,
each compared with the same stretch before it. Code:
`apps/web/src/components/progress/`, `lib/progress.ts`;
API `habit-review/progress` (`habits/progress.util.ts`) and `tasks/progress`
(`tasksByWeek` in `todos/todo.util.ts`); mood comes from the journal's
feelings, scored in the browser (`lib/mood.ts`).

| Part | What it shows | Form |
| ---- | ------------- | ---- |
| Headline numbers | Habits done (%), check-ins, tasks finished (with the share of deadlines met), average mood; each with its change against the period before, shown only when that period had data | Stat tiles |
| Habits done, week by week | Share of due habits done each week; the previous period's rate as a dashed line | Line (one series, no legend) |
| Check-ins by habit | Each week's check-ins stacked by habit: the 7 busiest by name, the rest as "Other" | Stacked columns |
| How each habit is going | Each habit's share of due days done over the period, best first | Ranked bars with values |
| Tasks finished | Each week's finished tasks: on time, no due date, late; and open tasks overdue now | Stacked columns |
| Mood, week by week | Each week's average mood, up (teal) for pleasant and down (orange) for unpleasant | Columns around zero |
| Your mood and your habits | Average mood on days 80%+ of due habits were done against days under half (3+ days each) | Two bars around zero, and a sentence |

**Counting.** Due days follow the habit rules elsewhere
([habit-data-model.md](habit-data-model.md)): frozen and paused days aren't
due, an avoid habit counts its clean days, and today counts only once it's
done. A "times a week" habit is due its weekly count, prorated for a week
only partly tracked or still going. The current week is drawn lighter (or as
a hollow point) because it isn't over.

**Charts.** Built with HTML and CSS like the cash-flow chart, on the
validated categorical palette (`--viz-series-1…8` in `index.css`, checked in
both themes with the dataviz skill's validator). Three light-mode slots are
under 3:1 contrast, so every multi-series chart has a legend, a 2px gap
between stacked segments, and a table view (the Table button, remembered
per chart). Every column and point is focusable and has a tooltip.
