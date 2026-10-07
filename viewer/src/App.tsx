import { useCallback, useEffect, useMemo, useState } from 'react';
import { Diagram } from './components/Diagram.js';
import { Sidebar } from './components/Sidebar.js';
import { fetchGraph } from './graph-data.js';
import type { GraphData } from './graph-data.js';
import { initiallyCollapsed, sourceColors } from './flow/appearance.js';
import { buildEntities } from './flow/model.js';

export function App() {
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchGraph().then(setGraph, (reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason));
        });
    }, []);

    if (error !== null) {
        return <p className="status status--error">{error}</p>;
    }
    if (graph === null) {
        return <p className="status">Loading schemas…</p>;
    }
    return <Viewer graph={graph} />;
}

function Viewer({ graph }: { graph: GraphData }) {
    const [showInferred, setShowInferred] = useState(true);
    const inferredCount = useMemo(
        () => graph.relations.filter((relation) => relation.kind === 'inferred').length,
        [graph],
    );
    const relations = useMemo(
        () => (showInferred ? graph.relations : graph.relations.filter((relation) => relation.kind === 'explicit')),
        [graph, showInferred],
    );
    const entities = useMemo(() => buildEntities({ nodes: graph.nodes, relations }), [graph, relations]);
    const sources = useMemo(() => [...new Set(entities.map((entity) => entity.source))].sort(), [entities]);
    const colors = useMemo(() => sourceColors(sources), [sources]);
    const entityNames = useMemo(() => entities.map((entity) => entity.name), [entities]);
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => initiallyCollapsed(entityNames));
    // Bumped by "collapse all" / "expand all" to fit the view again, since every card changes size.
    const [layoutVersion, setLayoutVersion] = useState(0);
    const toggleCollapse = useCallback((name: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (!next.delete(name)) {
                next.add(name);
            }
            return next;
        });
    }, []);
    const setAllCollapsed = (value: boolean) => {
        setCollapsed(new Set(value ? entityNames : []));
        setLayoutVersion((current) => current + 1);
    };
    const [hiddenSources, setHiddenSources] = useState<ReadonlySet<string>>(new Set());
    const [query, setQuery] = useState('');

    const visibleEntities = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return entities.filter(
            (entity) => !hiddenSources.has(entity.source) && entity.name.toLowerCase().includes(normalizedQuery),
        );
    }, [entities, hiddenSources, query]);

    const toggleSource = (source: string) => {
        setHiddenSources((current) => {
            const next = new Set(current);
            if (!next.delete(source)) {
                next.add(source);
            }
            return next;
        });
    };

    return (
        <div className="app">
            <Sidebar
                entities={entities}
                sources={sources}
                hiddenSources={hiddenSources}
                query={query}
                visibleCount={visibleEntities.length}
                relationCount={relations.length}
                inferredCount={inferredCount}
                showInferred={showInferred}
                onToggleInferred={() => setShowInferred((current) => !current)}
                colors={colors}
                collapsedCount={entityNames.filter((name) => collapsed.has(name)).length}
                onCollapseAll={() => setAllCollapsed(true)}
                onExpandAll={() => setAllCollapsed(false)}
                onQueryChange={setQuery}
                onToggleSource={toggleSource}
                onShowAll={() => setHiddenSources(new Set())}
                onHideAll={() => setHiddenSources(new Set(sources))}
            />
            <main className="canvas">
                <Diagram
                    // A different set of entities means a different layout: start from a fresh, fitted view.
                    key={`${layoutVersion}:${showInferred}:${visibleEntities.map((entity) => entity.name).join('|')}`}
                    entities={visibleEntities}
                    relations={relations}
                    collapsed={collapsed}
                    colors={colors}
                    onToggleCollapse={toggleCollapse}
                />
            </main>
        </div>
    );
}
