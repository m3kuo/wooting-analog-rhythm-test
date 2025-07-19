import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './websocket';



createRoot(document.getElementById("root")!).render(<App />);
