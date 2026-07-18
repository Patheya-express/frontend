# Shared GitHub Actions Building Blocks

Empty on purpose. `ci.yml`, `docker-build.yml`, and `security-scan.yml`
(see [`.github/workflows/`](../../../.github/workflows)) don't yet share
enough setup logic to justify extracting a
[composite action](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action) —
each one's pnpm/Node setup is four lines. If a fourth workflow repeats that
same block, or the setup grows more involved, extract it here as
`infrastructure/ci/github-actions/setup-workspace/action.yml` and reference
it with `uses: ./infrastructure/ci/github-actions/setup-workspace`.
