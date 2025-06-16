import React, {JSX} from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./home/HomePage.css";
import "./root/layout/index.css";
import "./root/layout/dark-theme.css";

import { Layout } from "./root/layout/Layout";
import HomePage from "./home/HomePage";
import { Meters } from "./infrastructure/meters/MeterListPage";
import MapPage from "./map/MapPage";
import { ChartsPage } from "./charts/ChartsPage";
import { ElectricityGeneratorPage } from "./infrastructure/electricityGenerator/ElectricityGeneratorPage";
import { PmaxPage } from "./infrastructure/pmax/PmaxPage";
import { MeterReadingsPage } from "./readings/MeterReadingsPage"
import { LoginPage } from "./pages/LoginPage"
import { AuthProvider, useAuth } from "./auth"
import { AccountSettingsPage } from "./pages/AccountSettingsPage"

function RequireAuth({ children }: { children: JSX.Element }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <AuthProvider>
            <BrowserRouter basename="/Your-Meter">
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
            </BrowserRouter>
        </AuthProvider>
    </React.StrictMode>
);