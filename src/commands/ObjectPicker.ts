import { CompositeDisposable, Disposable } from 'event-kit';
import * as THREE from "three";
import { Viewport } from '../components/viewport/Viewport';
import { EditorSignals } from '../editor/EditorSignals';
import { GeometryDatabase } from '../editor/GeometryDatabase';
import MaterialDatabase from '../editor/MaterialDatabase';
import * as visual from '../editor/VisualModel';
import { SelectionInteractionManager, SelectionMode } from '../selection/SelectionInteraction';
import { HasSelection, SelectionManager } from '../selection/SelectionManager';
import { AbstractViewportSelector } from '../selection/ViewportSelector';
import { Cancel, CancellablePromise } from '../util/Cancellable';

interface EditorLike {
    db: GeometryDatabase;
    viewports: Viewport[];
    signals: EditorSignals;
    materials: MaterialDatabase;
    selectionInteraction: SelectionInteractionManager;
}

class MyViewportSelector extends AbstractViewportSelector {
    private interaction = new SelectionInteractionManager(this.selection, this.editor.materials, this.signals);

    constructor(
        camera: THREE.Camera,
        domElement: HTMLElement,
        private readonly editor: EditorLike,
        private readonly selection: SelectionManager,
        private readonly onEmptyIntersection = () => {}
    ) {
        super(camera, domElement, editor.db, editor.signals);
        this.selection.mode.add(SelectionMode.Curve);
    }

    protected processClick(intersections: THREE.Intersection[]) {
        this.interaction.onClick(intersections);
        if (intersections.length === 0) this.onEmptyIntersection();
    }

    protected processHover(intersects: THREE.Intersection[]) {
        this.editor.selectionInteraction.onHover(intersects);
    }
}

export class ObjectPicker {
    constructor(private readonly editor: EditorLike) { }

    execute(cb?: (o: visual.Item | visual.TopologyItem | visual.ControlPoint) => void): CancellablePromise<HasSelection> {
        return new CancellablePromise((resolve, reject) => {
            const editor = this.editor;

            const disposables = new CompositeDisposable();
            const cancel = () => {
                disposables.dispose();
                reject(Cancel);
            }
            const finish = () => {
                disposables.dispose();
                resolve(selection);
            }
            
            const signals = new EditorSignals();
            editor.signals.objectRemoved.add(signals.objectRemoved.dispatch);
            disposables.add(new Disposable(() => editor.signals.objectRemoved.remove(signals.objectRemoved.dispatch)));

            const selection = new SelectionManager(editor.db, editor.materials, signals, new Set());
            
            if (cb !== undefined) {
                signals.objectSelected.add(cb);
                disposables.add(new Disposable(() => signals.objectSelected.remove(cb)));
            }
            signals.objectSelected.add(finish);
            disposables.add(new Disposable(() => signals.objectSelected.remove(finish)));

            for (const viewport of this.editor.viewports) {
                viewport.disableControlsExcept();
                disposables.add(new Disposable(() => viewport.enableControls()));

                const camera = viewport.camera;
                const renderer = viewport.renderer;
                const domElement = renderer.domElement;
                const selector = new MyViewportSelector(camera, domElement, editor, selection, finish);

                disposables.add(new Disposable(() => selector.dispose()));
            }

            return { cancel, finish };
        });
    }

    allowCurveFragments() {
        
    }
}