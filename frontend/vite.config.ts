import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
// The upstream browser bundle includes Buffer/streams/zlib. Wrap at build time,
// without eval or Node shims in the app, including the separate worker build.
const matroskaBrowser=()=>({name:'matroska-browser',resolveId(id:string){if(id==='virtual:matroska-browser')return '\0matroska-browser'},load(id:string){if(id==='\0matroska-browser')return readFileSync(require.resolve('matroska-subtitles/dist/matroska-subtitles.min.js'),'utf8').replaceAll('window.queueMicrotask','globalThis.queueMicrotask')+'\nexport const {SubtitleParser,SubtitleStream}=MatroskaSubtitles;'}});
// Supported WebView2 has native requestVideoFrameCallback. Do not ship the
// optional GPL-3.0 polyfill imported by JASSUB for obsolete browser engines.
export default defineConfig({plugins:[matroskaBrowser()],resolve:{alias:{'rvfc-polyfill':fileURLToPath(new URL('./src/native-video-frames.ts',import.meta.url))}},worker:{format:'es',plugins:()=>[matroskaBrowser()]}});
