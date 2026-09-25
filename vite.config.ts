import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages는 https://<user>.github.io/Roy/ 서브패스에서 서빙되므로 빌드 시에만
  // base를 저장소 이름으로 맞춘다 — 로컬 dev 서버는 계속 루트 경로에서 돈다.
  base: command === 'build' ? '/Roy/' : '/',
}))
