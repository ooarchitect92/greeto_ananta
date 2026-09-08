import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e/frontend', fullyParallel:true, timeout:30000,
  use:{baseURL:'http://127.0.0.1:5274',trace:'retain-on-failure'},
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5274 --strictPort',url:'http://127.0.0.1:5274/frontend-preview',reuseExistingServer:!process.env.CI},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
});
