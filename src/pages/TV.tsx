20:41:38.251 Running build in Washington, D.C., USA (East) – iad1
20:41:38.252 Build machine configuration: 2 cores, 8 GB
20:41:38.371 Cloning github.com/ClaudioBrasilia/BoxLink (Branch: 7-de-junho-patrocinio-teste, Commit: c6ef791)
20:41:38.697 Cloning completed: 326.000ms
20:41:39.012 Restored build cache from previous deployment (GTxkCHnFrJoqSnivNkEdPKFtYMrV)
20:41:39.282 Running "vercel build"
20:41:39.304 Vercel CLI 54.9.0
20:41:39.826 Installing dependencies...
20:41:40.924 
20:41:40.925 up to date in 981ms
20:41:40.925 
20:41:40.926 152 packages are looking for funding
20:41:40.926   run `npm fund` for details
20:41:40.957 Running "npm run build"
20:41:41.063 
20:41:41.064 > vite-react-typescript-starter@0.0.0 build
20:41:41.064 > vite build
20:41:41.064 
20:41:41.470 vite v5.4.21 building for production...
20:41:41.528 transforming...
20:41:46.422 ✓ 3575 modules transformed.
20:41:46.427 x Build failed in 4.93s
20:41:46.428 error during build:
20:41:46.428 [vite-plugin-pwa:build] There was an error during the build:
20:41:46.428   src/App.tsx (17:7): "default" is not exported by "src/pages/TV.tsx", imported by "src/App.tsx".
20:41:46.430 Additionally, handling the error in the 'buildEnd' hook caused the following error:
20:41:46.431   src/App.tsx (17:7): "default" is not exported by "src/pages/TV.tsx", imported by "src/App.tsx".
20:41:46.431 file: /vercel/path0/src/App.tsx:17:7
20:41:46.431 
20:41:46.431 15: import Admin from './pages/Admin';
20:41:46.432 16: import Coach from './pages/Coach';
20:41:46.432 17: import TV from './pages/TV';
20:41:46.432            ^
20:41:46.432 18: import Clans from './pages/Clans';
20:41:46.432 19: import Login from './pages/Login';
20:41:46.432 
20:41:46.432     at getRollupError (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:406:41)
20:41:46.432     at file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:23863:39
20:41:46.432     at async catchUnfinishedHookActions (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:23321:16)
20:41:46.433     at async rollupInternal (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:23846:5)
20:41:46.433     at async build (file:///vercel/path0/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:65709:14)
20:41:46.433     at async CAC.<anonymous> (file:///vercel/path0/node_modules/vite/dist/node/cli.js:829:5)
20:41:46.472 Error: Command "npm run build" exited with 1
