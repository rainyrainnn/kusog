import { useEffect, useRef, useState } from 'react';
import { getDetections, getEdgeHealth, isEdgeConfigured, type EdgeDetectionResponse, type EdgeHealth } from '@/lib/edgeService';

export type YoloDetectionState = {
  health: EdgeHealth | null;
  result: EdgeDetectionResponse | null;
  error: string | null;
  loading: boolean;
};

export function useYoloDetections(
  enabled: boolean,
  onResult?: (health: EdgeHealth, result: EdgeDetectionResponse) => void,
): YoloDetectionState {
  const [state, setState] = useState<YoloDetectionState>({
    health: null,
    result: null,
    error: null,
    loading: false,
  });
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!enabled) {
      setState({ health: null, result: null, error: null, loading: false });
      return;
    }

    if (!isEdgeConfigured) {
      setState({
        health: null,
        result: null,
        error: 'Set VITE_KUSOG_EDGE_URL in .env to connect the Raspberry Pi edge service.',
        loading: false,
      });
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    setState({ health: null, result: null, error: null, loading: true });

    const poll = async () => {
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 3000);

      try {
        const [health, result] = await Promise.all([
          getEdgeHealth(requestController.signal),
          getDetections(requestController.signal),
        ]);
        if (!cancelled) {
          setState({ health, result, error: null, loading: false });
          onResultRef.current?.(health, result);
        }
      } catch (requestError) {
        if (!cancelled) {
          setState({
            health: null,
            result: null,
            error: requestController.signal.aborted
              ? 'The Raspberry Pi edge API timed out.'
              : requestError instanceof Error ? requestError.message : 'YOLO service unavailable.',
            loading: false,
          });
        }
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) timer = window.setTimeout(() => void poll(), 1000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled]);

  return state;
}
