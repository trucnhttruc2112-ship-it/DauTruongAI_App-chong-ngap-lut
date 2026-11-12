import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CitizenLayout } from './CitizenLayout.jsx'
import { MapPage } from '../features/map/MapPage.jsx'
import { ListSkeleton } from '../components/ui/Feedback.jsx'

// Chỉ tải các trang quản lý, camera và mô-đun nặng khi cần (mục 13.6)
const ReportFlow = lazy(() => import('../features/report/ReportFlow.jsx'))
const MyReportsPage = lazy(() => import('../features/report/MyReportsPage.jsx'))
const ReportDetailPage = lazy(() => import('../features/report/ReportDetailPage.jsx'))
const AlertsPage = lazy(() => import('../features/alerts/AlertsPage.jsx'))
const AffectedRoadsPage = lazy(() => import('../features/roads/AffectedRoadsPage.jsx'))
const RoutingPage = lazy(() => import('../features/roads/RoutingPage.jsx'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.jsx'))
const LoginPage = lazy(() => import('../features/auth/LoginPage.jsx'))
const AdminLayout = lazy(() => import('../features/admin/AdminLayout.jsx'))
const AdminReportsPage = lazy(() => import('../features/admin/AdminReportsPage.jsx'))
const AdminReportDetail = lazy(() => import('../features/admin/AdminReportDetail.jsx'))
const AdminMapPage = lazy(() => import('../features/admin/AdminMapPage.jsx'))
const DataSourcesPage = lazy(() => import('../features/admin/DataSourcesPage.jsx'))

function PageFallback() {
  return <div className="page"><ListSkeleton rows={3} /></div>
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<CitizenLayout />}>
          <Route index element={<MapPage />} />
          <Route path="diem-ngap/:id" element={<MapPage />} />
          <Route path="canh-bao" element={<AlertsPage />} />
          <Route path="duong-bi-anh-huong" element={<AffectedRoadsPage />} />
          <Route path="tim-duong" element={<RoutingPage />} />
          <Route path="bao-cao-cua-toi" element={<MyReportsPage />} />
          <Route path="bao-cao/:id" element={<ReportDetailPage />} />
          <Route path="tuy-chon" element={<SettingsPage />} />
        </Route>

        {/* Luồng báo ngập và đăng nhập dùng trang riêng, không nhồi vào bảng nhỏ */}
        <Route path="bao-ngap" element={<ReportFlow />} />
        <Route path="dang-nhap" element={<LoginPage />} />

        {/* Khu vực quản lý có điều hướng riêng */}
        <Route path="quan-ly" element={<AdminLayout />}>
          <Route index element={<AdminReportsPage />} />
          <Route path="bao-cao/:id" element={<AdminReportDetail />} />
          <Route path="ban-do" element={<AdminMapPage />} />
          <Route path="nguon-du-lieu" element={<DataSourcesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
