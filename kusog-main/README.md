# KUSOG Smart Typhoon Simulation Chamber

KUSOG combines a web dashboard with Raspberry Pi sensor and camera services.
The sensor modules are grouped by hardware so team members can develop and
test their assigned sensor independently.

## Project structure

```text
backend/
  sensors/
    rain/       Rain uploader, tests, config example, documentation
    wind/       Wind uploader, tests, config example, documentation
    load_cell/  HX711 uploader, tests, config example, documentation
    bmp280/     BMP280 uploader, tests, config example, documentation
  camera/       YOLO camera server and documentation
src/
  sensors/
    rain/       Rain dashboard adapter and parsing
    wind/       Wind dashboard adapter and readings
    load_cell/  Load-cell dashboard adapter
    bmp280/     BMP280 dashboard adapter
    camera/     YOLO/edge and camera adapters
  components/   Shared dashboard components and views
  hooks/        Shared application and test-session hooks
  lib/          Shared services, including the Supabase client and test records
supabase/       Existing Supabase functions, configuration, and migrations
```

## Sensor documentation

- [Rain Sensor — Member 1](backend/sensors/rain/README.md)
- [Wind Sensor — Member 2](backend/sensors/wind/README.md)
- [Load Cell (HX711) — Member 3](backend/sensors/load_cell/README.md)
- [BMP280 — Member 3](backend/sensors/bmp280/README.md)
- [YOLO Camera System](backend/camera/README.md)
- [Team ownership and pull-request workflow](TEAM_WORKFLOW.md)

Each sensor README lists its run and focused test commands, configuration
variable names, and existing Supabase upload/table contract. Do not put
populated credentials or environment files in the repository.

The root [`.env.example`](.env.example) lists shared frontend configuration
names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KUSOG_PI_HOST`,
`VITE_KUSOG_RAIN_URL`, and `VITE_KUSOG_EDGE_URL`; `VITE_KUSOG_CAMERA_URL` is
also documented there as an optional setting. Use the existing deployment
configuration for actual values.

## Development checks

Run focused Python tests from the project root with the project's existing
Python environment:

```text
python -m unittest backend.sensors.rain.tests.test_rain_sensor_uploader -v
python -m unittest backend.sensors.wind.tests.test_wind_sensor_uploader -v
python -m unittest backend.sensors.load_cell.tests.test_hx711_uploader -v
python -m unittest backend.sensors.bmp280.tests.test_bmp280_uploader -v
```

Frontend checks use the existing npm scripts:

```text
npm run lint
npm run typecheck
npm run build
```

Existing Node tests can be run with:

```text
node --test src/sensors/rain/rainSensorParsing.test.mjs src/sensors/rain/rainLogPresentation.test.mjs
node --test src/lib/testClassification.test.mjs
```

The Python unit tests mock hardware and network interactions. Coordinate
physical-device, live Supabase, and Raspberry Pi deployment checks with the
main integrator. Follow [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) for ownership,
approval, branch, and pull-request rules.
