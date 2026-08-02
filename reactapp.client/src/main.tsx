import React, { JSX } from "react";
import ReactDOM from "react-dom/client";
import { Redirect, Route, Switch } from "wouter";
import "bootstrap/dist/css/bootstrap.min.css";
import "./home/HomePage.css";
import "./root/layout/index.css";
import "./root/layout/dark-theme.css";

import { Layout } from "./root/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { HelpPage } from "./pages/HelpPage";
import { AuthProvider, useAuth } from "./auth";
import { AppStateProvider } from "./root/app-context";
import HomePage from "./home/HomePage";
import MapPage from "./map/MapPage";
import { Meters } from "./infrastructure/meters/MeterListPage";
import { ChartsPage } from "./charts/ChartsPage";
import { ElectricityGeneratorPage } from "./infrastructure/electricityGenerator/ElectricityGeneratorPage";
import { PmaxPage } from "./infrastructure/pmax/PmaxPage";
import { MeterReadingsPage } from "./readings/MeterReadingsPage";
import { AccountSettingsPage } from "./pages/AccountSettingsPage";
import MeterLabPage from "./simulators/MeterLabPage";

function migrateLegacyHashRoute() {
    const hashRoute = window.location.hash.slice(1);
    if (!hashRoute.startsWith("/")) return;

    const legacyUrl = new URL(hashRoute, window.location.origin);
    const searchParams = new URLSearchParams(window.location.search);
    legacyUrl.searchParams.forEach((value, key) => searchParams.set(key, value));
    const search = searchParams.toString();

    window.history.replaceState(
        null,
        "",
        `${legacyUrl.pathname}${search ? `?${search}` : ""}${legacyUrl.hash}`,
    );
}

migrateLegacyHashRoute();

function RequireAuth({ children }: { children: JSX.Element }) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return <PageLoader />;
    return isAuthenticated ? children : <Redirect to="/login" replace />;
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
            <AppStateProvider>
            <Switch>
                <Route path="/login"><LoginPage /></Route>
                <Route path="/home"><RequireAuth><Layout><HomePage /></Layout></RequireAuth></Route>
                <Route path="/help"><RequireAuth><Layout><HelpPage /></Layout></RequireAuth></Route>
                <Route path="/infrastructure/meter/list"><RequireAuth><Layout><Meters /></Layout></RequireAuth></Route>
                <Route path="/map"><RequireAuth><Layout><MapPage /></Layout></RequireAuth></Route>
                <Route path="/simulators"><RequireAuth><Layout><MeterLabPage /></Layout></RequireAuth></Route>
                <Route path="/infrastructure/electricityGenerator"><RequireAuth><Layout><ElectricityGeneratorPage /></Layout></RequireAuth></Route>
                <Route path="/charts"><RequireAuth><Layout><ChartsPage /></Layout></RequireAuth></Route>
                <Route path="/infrastructure/pmax"><RequireAuth><Layout><PmaxPage /></Layout></RequireAuth></Route>
                <Route path="/readings/meterReadingsPage"><RequireAuth><Layout><MeterReadingsPage /></Layout></RequireAuth></Route>
                <Route path="/account"><RequireAuth><Layout><AccountSettingsPage /></Layout></RequireAuth></Route>
                <Route><Redirect to="/home" replace /></Route>
            </Switch>
            </AppStateProvider>
        </AuthProvider>
    </React.StrictMode>
);
