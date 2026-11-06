# YOLO Camera System

`yolo_server.py` serves the existing camera, health, and detection endpoints.
It does not upload sensor readings to Supabase.

Optional `KUSOG_CAMERA_URL` and `KUSOG_MODEL_PATH` settings are documented in
`.env.example`; this folder's example intentionally contains variable names
only. The default model lookup remains at the former `backend/` location so
existing deployments can keep their model file in place. The frontend reads
`VITE_KUSOG_EDGE_URL` and optionally `VITE_KUSOG_CAMERA_URL`.

Run the server from the project root with the existing Python environment and
launch arguments:

```text
python -m backend.camera.yolo_server --help
python -m backend.camera.yolo_server
```

The legacy `backend/yolo_server.py` path remains available for existing launch
commands. No YOLO-specific systemd unit or automated test was found in the
project; coordinate runtime and camera checks with the main integrator.
