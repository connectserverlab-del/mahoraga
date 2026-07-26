// Copies node icons (svg/png) into dist alongside the compiled JS, which n8n
// expects for `icon: 'file:...'` references. Keeps the build tsc-only, no gulp.
import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const SRC = 'nodes';
const OUT = 'dist/nodes';

function walk(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walk(full);
		} else if (/\.(svg|png)$/i.test(entry)) {
			const dest = join(OUT, relative(SRC, full));
			mkdirSync(dirname(dest), { recursive: true });
			cpSync(full, dest);
			console.log(`copied ${full} -> ${dest}`);
		}
	}
}

walk(SRC);
