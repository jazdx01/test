import c3d from '../../../build/Release/c3d.node';
import { isSamePlacement } from '../../util/Conversion';
import { GeometryDatabase } from '../GeometryDatabase';
import { PlanarCurveDatabase } from './PlanarCurveDatabase';
import * as visual from "../../visual_model/VisualModel";

export class RegionManager {
    constructor(
        private readonly db: GeometryDatabase,
        private readonly curves: PlanarCurveDatabase
    ) { }

    updatePlacement(placement: c3d.Placement3D): Promise<void> {
        return this.db.queue.enqueue(async () => {
            this.removeOnPlacement(placement);

            const coplanarCurves = this.curves.findWithSamePlacement(placement);

            const { contours } = c3d.ContourGraph.OuterContoursBuilder(coplanarCurves);

            const regions = c3d.ActionRegion.GetCorrectRegions(contours, false);
            for (const region of regions) {
                this.db.addItem(new c3d.PlaneInstance(region, placement), 'automatic');
            }
        });
    }

    private removeOnPlacement(placement: c3d.Placement3D) {
        const oldRegions = this.db.find(visual.PlaneInstance, true);
        for (const { model, view } of oldRegions) {
            const p = model.GetPlacement();
            if (isSamePlacement(p, placement)) {
                this.db.removeItem(view, 'automatic');
            }
        }
    }
}
