import { runtimeApp } from './runtime'
runtimeApp().listen(Number(process.env.API_PORT || 3001), '127.0.0.1', () => console.log('Study API: http://127.0.0.1:3001'))
