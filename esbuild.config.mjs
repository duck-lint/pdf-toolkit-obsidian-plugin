import esbuild from "esbuild";
import builtinModules from "builtin-modules";

const isProd = process.argv.includes("production");

const context = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  external: [
    "obsidian",
    "electron",
    ...builtinModules
  ],
  sourcemap: !isProd,
  minify: isProd,
  logLevel: "info",
};

if (process.argv.includes("dev")) {
  const ctx = await esbuild.context(context);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(context);
}
