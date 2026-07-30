import React, { JSX, lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom"; // HashRouter zamiast BrowserRouter
import "bootstrap/dist/css/bootstrap.min.css";
import "./home/HomePage.css";
import "./root/layout/index.css";
import "./root/layout/dark-theme.css";

import { Layout } from "./root/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { AuthProvider, useAuth } from "./auth";

const HomePage = lazy(() => import("./home/HomePage"));
const MapPage = lazy(() => import("./map/MapPage"));
const Meters = lazy(() => import("./infrastructure/meters/MeterListPage").then((module) => ({ default: module.Meters })));
const ChartsPage = lazy(() => import("./charts/ChartsPage").then((module) => ({ default: module.ChartsPage })));
const ElectricityGeneratorPage = lazy(() => import("./infrastructure/electricityGenerator/ElectricityGeneratorPage").then((module) => ({ default: module.ElectricityGeneratorPage })));
const PmaxPage = lazy(() => import("./infrastructure/pmax/PmaxPage").then((module) => ({ default: module.PmaxPage })));
const MeterReadingsPage = lazy(() => import("./readings/MeterReadingsPage").then((module) => ({ default: module.MeterReadingsPage })));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage").then((module) => ({ default: module.AccountSettingsPage })));

function RequireAuth({ children }: { children: JSX.Element }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

const PageLoader = () => (
    <div className="d-flex justify-content-center align-items-center py-5" role="status" aria-live="polite">
        <div className="spinner-border text-primary" aria-hidden="true" />
        <span className="visually-hidden">Ładowanie strony</span>
    </div>
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <AuthProvider>
            <HashRouter>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/home" replace />} />

                        <Route path="/home" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<HomePage />} />
                        </Route>

                        <Route path="/login" element={<LoginPage />} />

                        <Route path="/infrastructure/meter/list" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<Meters />} />
                        </Route>

                        <Route path="/map" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<MapPage />} />
                        </Route>

                        <Route path="/infrastructure/electricityGenerator" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<ElectricityGeneratorPage />} />
                        </Route>

                        <Route path="/charts" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<ChartsPage />} />
                        </Route>

                        <Route path="/infrastructure/pmax" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<PmaxPage />} />
                        </Route>

                        <Route path="/readings/meterReadingsPage" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<MeterReadingsPage />} />
                        </Route>

                        <Route path="/account" element={<RequireAuth><Layout /></RequireAuth>}>
                            <Route index element={<AccountSettingsPage />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/home" replace />} />
                    </Routes>
                </Suspense>
            </HashRouter>
        </AuthProvider>
    </React.StrictMode>
);
