import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import css from 'rollup-plugin-css-only'

const production = !process.env.ROLLUP_WATCH

export default {
  input: 'src/main.js',
  output: {
    file: 'public/bundle.js',
    format: 'iife',
    name: 'app'
  },
  plugins: [
    svelte({ compilerOptions: { dev: !production }}),
    css({ output: 'bundle.css' }),
    resolve({ browser: true, dedupe: ['svelte']}),
    commonjs()
  ]
}
