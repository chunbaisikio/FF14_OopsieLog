import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Tracker from './pages/Tracker';
import Teams from './pages/Teams';
import Bosses from './pages/Bosses';
import Setup from './pages/Setup';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import ProgressBoard from './pages/ProgressBoard';
import TelemetryProvider from './utils/TelemetryProvider';

function App() {
  return (
    <TelemetryProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Tracker />} />
            <Route path="teams" element={<Teams />} />
            <Route path="bosses" element={<Bosses />} />
            <Route path="logs" element={<Logs />} />
            <Route path="progress" element={<ProgressBoard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="setup" element={<Setup />} />
          </Route>
        </Routes>
      </HashRouter>
    </TelemetryProvider>
  );
}

export default App;
