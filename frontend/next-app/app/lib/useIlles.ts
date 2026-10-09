import { useEffect, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import proj4 from 'proj4';
import { fetchIllaAt, pointInGeometry } from './geoBcn';
import { EPSG_25831, WGS84 } from './geoUtils';

export interface IllaPoint {
    /** Identifies the address in `assignments`. */
    key: string;
    longitude: number;
    latitude: number;
}

interface IllaResult {
    points: IllaPoint[];
    illes: FeatureCollection<Geometry>;
    assignments: ReadonlyMap<string, string>;
    done: boolean;
}

const CONCURRENCY = 6;
const FLUSH_INTERVAL_MS = 250;

const toUtm = proj4(WGS84, EPSG_25831);

/**
 * Resolves the illa of every point. The GeoBCN list endpoint is capped at 50 blocks, so each point is
 * looked up individually, skipping points already inside a block found earlier. Illes (EPSG:25831)
 * and the point-key → illa-code map stream in as lookups complete.
 */
export function useIlles(points: IllaPoint[] | null) {
    const [result, setResult] = useState<IllaResult | null>(null);

    useEffect(() => {
        if (!points || points.length === 0) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const found = new Map<string, Feature<Geometry>>();
        const assignments = new Map<string, string>();

        const flush = (done: boolean) => {
            timer = null;
            setResult({
                points,
                illes: { type: 'FeatureCollection', features: Array.from(found.values()) },
                assignments: new Map(assignments),
                done,
            });
        };

        const queue = [...points];
        const worker = async () => {
            for (let point = queue.shift(); point && !cancelled; point = queue.shift()) {
                const [x, y] = toUtm.forward([point.longitude, point.latitude]);
                let match = Array.from(found.values()).find((illa) => pointInGeometry(x, y, illa.geometry));

                if (!match) {
                    try {
                        match = (await fetchIllaAt(x, y)) ?? undefined;
                    } catch {
                        match = undefined;
                    }
                    if (cancelled) return;
                    if (match) found.set(String(match.properties?.ILLA), match);
                }

                if (match) {
                    assignments.set(point.key, String(match.properties?.ILLA));
                    timer ??= setTimeout(() => flush(false), FLUSH_INTERVAL_MS);
                }
            }
        };

        Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
            if (cancelled) return;
            if (timer) clearTimeout(timer);
            flush(true);
        });

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [points]);

    // Results from a previous barri are ignored instead of being cleared inside the effect.
    const current = points && result?.points === points ? result : null;

    return {
        illes: current?.illes ?? null,
        assignments: current?.assignments ?? null,
        loading: Boolean(points?.length) && !current?.done,
    };
}
