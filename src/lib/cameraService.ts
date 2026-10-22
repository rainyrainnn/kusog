/*
 * KUSOG Camera Service
 *
 * Uses the browser's MediaDevices API for a directly connected
 * USB webcam instead of an MJPEG/IP camera stream URL.
 */

export type CameraStatus =
  | 'disconnected'
  | 'connecting'
  | 'live'
  | 'error';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export async function getCameraDevices(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error('Camera access is not supported by this browser.');
  }

  const devices = await navigator.mediaDevices.enumerateDevices();

  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label || 'Camera',
    }));
}

export async function getCameraStream(
  deviceId?: string
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported by this browser.');
  }

  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
    ...(deviceId
      ? { deviceId: { exact: deviceId } }
      : {}),
  };

  return navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: false,
  });
}

export function stopCameraStream(stream: MediaStream | null) {
  if (!stream) return;

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}