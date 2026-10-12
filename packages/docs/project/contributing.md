<!--@include: ../../../CONTRIBUTING.md-->

## Working on the docs

```sh
pnpm install
pnpm build                              # build FreeGrid first; the docs use its dist
pnpm --filter @freegrid/docs dev        # http://localhost:5173/freegrid/
```

Each example is one file in `packages/docs/examples/`. The page renders it live and shows its source,
so the code you read is the code that runs.
