# Third-party dependencies

This project uses packages distributed through npm. Their resolved versions
and integrity metadata are recorded in `pnpm-lock.yaml`; each package remains
subject to its own license and notices. A local `pnpm licenses list --json`
check on this lockfile found 511 resolved packages across MIT, Apache-2.0,
BSD-2/3-Clause, ISC, MPL-2.0, LGPL-3.0-or-later, CC0-1.0, CC-BY-4.0,
BlueOak-1.0.0, Python-2.0, 0BSD, and combined SPDX expressions. Installing
dependencies does not move their copyrights into the MIT grant for this
repository.

The direct runtime and build dependencies are listed in `package.json`,
including React, Vite, Vinext, Cloudflare's Vite plugin, Tailwind CSS,
shadcn/Base UI, and their transitive packages. Before redistribution, generate
the resolved inventory from the lockfile with:

```sh
pnpm licenses list
```

No third-party dependency notice is replaced or waived by this file. Package
licenses should be reviewed against the exact lockfile revision used for a
release.
