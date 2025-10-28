# Your Meter - React Client

This is the frontend client for 'Your Meter', a comprehensive application for monitoring and analyzing electricity meter data. Built with React, TypeScript, and Vite, it provides a rich user interface for visualizing energy consumption, production, and system status.

## Features

-   **Dashboard**: View system-wide statistics, active meters, weekly consumption trends, and usage breakdowns at a glance.
-   **Meter Management**: A detailed, filterable, and sortable list of all meters. Includes functionality to add new meters with validation and location pinning on a map.
-   **Meter Readings**: Access raw meter data with pagination. Create and switch between custom tabular views to display only the desired data columns.
-   **Interactive Map**: Visualize the geographic location of all meters on an interactive Leaflet map, complete with status indicators and quick-access popups.
-   **Advanced Analytics**: Generate detailed charts for energy consumption, generation, power analysis, and more, with filtering options for meters and date ranges.
-   **Power Generation Monitoring**: A dedicated module for tracking energy production from sources like PV farms, detailing generation, grid export, and autokonsumption.
-   **Peak Power (Pmax) Analysis**: Monitor peak power usage against contracted limits, view alerts for overages, and analyze associated costs.
-   **User Authentication**: Secure login, registration, and password recovery workflows implemented with Formik and Yup for robust validation.
-   **Account Management**: Users can manage their profile information (username, email) and change their password.
-   **Theming**: Switch between light and dark modes for a comfortable user experience.

## Tech Stack

-   **Framework**: [React 19](https://react.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **UI Library**: [React-Bootstrap](https://react-bootstrap.netlify.app/)
-   **Routing**: [React Router](https://reactrouter.com/)
-   **Form Management**: [Formik](https://formik.org/) for forms and [Yup](https://github.com/jquense/yup) for validation
-   **Charting**: [Chart.js](https://www.chartjs.org/) & [react-chartjs-2](https://react-chartjs-2.js.org/)
-   **Mapping**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)

## Getting Started

### Prerequisites

-   Node.js (v18.0.0 or later)
-   npm (v8.0.0 or later)

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/JJFilipek/your-meter.git
    ```
2.  Navigate to the client application directory:
    ```sh
    cd your-meter/reactapp.client
    ```
3.  Install the required dependencies:
    ```sh
    npm install
    ```
4.  Start the development server:
    ```sh
    npm run dev
    ```
    The application will be available at `https://localhost:49323`.

## Available Scripts

In the `reactapp.client` directory, you can run the following scripts:

-   `npm run dev`: Runs the app in development mode with hot-reloading.
-   `npm run build`: Compiles TypeScript and builds the app for production into the `dist` folder.
-   `npm run lint`: Lints the source code using ESLint to check for code quality and style issues.
-   `npm run preview`: Starts a local server to preview the production build from the `dist` folder.
-   `npm run deploy`: Builds the project and deploys it to GitHub Pages.

## License

This project is distributed under the terms of the [MIT License](LICENSE).
