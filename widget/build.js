const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

async function build() {
  const opts = {
    entryPoints: ['src/widget.js'],
    outfile: 'dist/widget.js',
    bundle: true,
    minify: true,
    format: 'iife',
  };

  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
    console.log('[build] watching for changes...');
  } else {
    await esbuild.build(opts);
    console.log('[build] dist/widget.js written');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
