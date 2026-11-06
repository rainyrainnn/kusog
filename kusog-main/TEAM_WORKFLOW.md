# KUSOG Team Workflow

This document defines sensor ownership, collaboration boundaries, and the
pull-request process for the KUSOG Smart Typhoon Simulation Chamber project.
It documents the current project organization; it does not authorize changes
to sensor behavior, Supabase contracts, or Raspberry Pi configuration.

## Ownership and allowed files

| Owner | Primary files they may modify |
|---|---|
| Member 1 — Rain Sensor | `backend/sensors/rain/` and `src/sensors/rain/`, including their tests, README, and existing configuration example |
| Member 2 — Wind Sensor | `backend/sensors/wind/` and `src/sensors/wind/`, including their tests, README, and existing configuration example |
| Member 3 — Load Cell and BMP280 | `backend/sensors/load_cell/`, `src/sensors/load_cell/`, `backend/sensors/bmp280/`, and `src/sensors/bmp280/`, including their tests, READMEs, and existing configuration examples |
| Main integrator | Dashboard integration; shared test-record logic; shared Supabase client; migrations and Edge Functions; cross-sensor integration; YOLO/camera integration; Raspberry Pi deployment; pull-request review |

Members should keep implementation changes, tests, and documentation within
their assigned sensor folders. Do not modify another member's sensor folder
without that member's approval. Coordinate any change that touches multiple
owners' folders before starting it.

The following are shared or deployment surfaces reserved for the main
integrator: `src/components/`, shared files in `src/hooks/` and `src/lib/`
(including `src/lib/supabase.ts` and `src/lib/testRecords.ts`), `supabase/`,
`backend/camera/`, `src/sensors/camera/`, root/build configuration, backend
compatibility entry points and systemd units, and Raspberry Pi deployment
settings. Sensor owners must get approval from the main integrator before
changing these.

**Database boundary:** Any change to shared database logic, table or field
names, RPCs, Supabase client or connection methods, migrations, policies, or
Edge Functions requires explicit main-integrator approval before
implementation. Do not make database changes as part of routine sensor work.
Keep existing reading formats, fields, upload methods, error handling, and
dashboard behavior compatible.

## Branch, commit, and pull-request process

1. Start from the repository's current default branch and create a focused
   branch. Use a descriptive name, for example:

   ```text
   git switch <default-branch>
   git pull --ff-only
   git switch -c feature/member1-rain-timeout
   ```

   Examples: `feature/member2-wind-validation` or
   `fix/member3-bmp280-reconnect`.
2. Before editing, check `git status` and keep unrelated work out of your
   branch. Make only changes within your ownership boundary and any explicitly
   approved shared files.
3. Run the focused sensor tests from the project root. Add or update tests for
   behavior changes. For changes affecting shared integration, also run the
   relevant frontend checks described in the root README.
4. Review the diff and confirm no populated environment files, credentials,
   tokens, or unrelated files are included. Commit with a concise, descriptive
   message, for example:

   ```text
   git add backend/sensors/rain src/sensors/rain
   git commit -m "fix(rain): handle API timeout"
   ```
5. Push the branch and open a pull request targeting the repository's default
   branch:

   ```text
   git push -u origin feature/member1-rain-timeout
   ```
6. In the pull request, summarize the change, list the sensor and files
   affected, record the exact tests run and their results, and call out any
   requested shared-surface approval. Link related work and include deployment
   notes only when relevant. Do not deploy to the Raspberry Pi or change its
   configuration as part of an ordinary sensor pull request.
7. Wait for main-integrator review and approval before merging. Changes to
   another owner's sensor folder also require that owner's approval.

## Sensor test commands

Run these commands from the project root using the project's existing Python
environment:

```text
python -m unittest backend.sensors.rain.tests.test_rain_sensor_uploader -v
python -m unittest backend.sensors.wind.tests.test_wind_sensor_uploader -v
python -m unittest backend.sensors.load_cell.tests.test_hx711_uploader -v
python -m unittest backend.sensors.bmp280.tests.test_bmp280_uploader -v
```

The Python unit tests mock network requests and/or hardware where applicable;
they do not prove physical-device or live Supabase connectivity. See each
sensor README for its run command, settings, and upload contract. Only perform
live hardware or deployment checks when coordinated with the main integrator.

## Security and compatibility

- Never add secret values to source, documentation, commits, or pull requests.
  Configuration examples contain variable names/placeholders only; real
  settings remain in the already-approved secret store or deployment
  environment.
- Do not move files, alter Raspberry Pi configuration, or change systemd
  service paths as part of this workflow. Coordinate deployment work with the
  main integrator.
- Do not change Supabase tables, columns, policies, migrations, Edge Functions,
  database connection methods, or dashboard behavior without the approvals
  described above.
- Preserve existing interfaces so independent sensor work does not break
  another sensor, the dashboard, saved test records, or deployment.
