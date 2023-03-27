import ts from "rollup-plugin-ts";
// import babel from "@rollup/plugin-babel";
import { lezer } from "@lezer/generator/rollup";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
  },
  plugins: [
    ts(),
    lezer(),
    // babel({
    //     babelHelpers: "bundled"
    // })
  ],
  external: [
    "@lezer/lr",
    "@lezer/highlight",
    "@codemirror/view",
    "@codemirror/lint",
    "@codemirror/state",
    "@codemirror/tooltip",
    "@codemirror/language",
    "@codemirror/autocomplete",
    "@rainprotocol/rainlang",
  ],
};

// .babelrc file
// {
// 	"presets": [
// 		"@babel/env"
// 	]
// }
