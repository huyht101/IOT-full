import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { DashboardRuntimeProvider } from './context/DashboardRuntimeContext';
import ActionHistoryPage from './pages/ActionHistoryPage';
import ApiDocsPage from './pages/ApiDocsPage';
import DashboardPage from './pages/DashboardPage';
import DeviceUsagePage from './pages/DeviceUsagePage';
import ProfilePage from './pages/ProfilePage';
import SensorHistoryPage from './pages/SensorHistoryPage';

function App() {
  return (
    <DashboardRuntimeProvider>
      <Routes>
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/actions" element={<ActionHistoryPage />} />
          <Route path="/device-usage" element={<DeviceUsagePage />} />
          <Route path="/sensors" element={<SensorHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DashboardRuntimeProvider>
  );
}

export default App;
