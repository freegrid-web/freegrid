# Budget across sheets

The **Summary** sheet adds up the **Income** and **Costs** sheets with formulas such as `=SUM(Income!B2:B4)`.
Change an amount on one of them and come back: the summary follows. Rename a sheet and the formulas follow the
new name; delete one and its references show `#REF!`.

<LiveExample name="budget" />

<<< @/examples/budget.js
