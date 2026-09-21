# Release checks

Run `pnpm build`, `pnpm verify`, and `pnpm release:check` with a supported Node runtime. The last command builds the actual package and plugin, then exercises installed commands in a fresh repository without workspace dependency resolution. Output and packages remain in `.temp/projector-release-check`.

The [reconstruction rehearsal](../.assimilate/rehearsal/README.md) preserves partial integration findings. It does not establish a comparative advantage over OpenSpec.

The old release certificates and version-by-version migration chain were retired. Generic exact approval, interrupted-write recovery, bounded process cleanup and package ownership checks remain tested in their owning packages. Pre-cutover canonical data and unfinished runtime evidence are in `.temp/projector3-before-format`; retired release files are preserved in `.temp/projector3-retired-release`.
