# How to use it in Power BI -Calculation Groups/trends


For the calculation group:

put Trend View[Trend View] on a slicer
use your “Latest” measures in visuals
the slicer will switch them to:
Current
Previous
Delta
Delta %
Rolling 3 Avg

For conditional formatting:

in cards, tables, matrices, KPI visuals:
choose Format by: Field value
select measures like:
Lipid AIP Color Hex
Endo HOMA-IR Color Hex
Combined KPI Background Hex
Lipid AIP Trend Color Hex

A couple of notes:

This calculation group works best when the visual uses the Latest measures created by the first script.
If you later add liver or CBC measures, I can extend this script so the same calculation group supports those too.

I can also generate a third script that creates a full measure table layout and moves all measures out of the fact tables into dedicated display tables.