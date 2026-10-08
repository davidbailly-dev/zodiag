import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Diagram } from './components/Diagram.js';
import { Sidebar } from './components/Sidebar.js';
import { collapseNewcomers, initiallyCollapsed, sourceColors } from './flow/appearance.js';
import { buildEntities, findEnumOnlyFiles } from './flow/model.js';
import type { GraphData } from './graph-data.js';
import { fetchGraph, subscribeToChanges } from './graph-data.js';

export function App() {
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    useEffect(() => {
        fetchGraph().then(setGraph, (reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason));
        });
        // When the schema files change the server says so: load the new graph and keep the current
        // one if that fails.
        return subscribeToChanges(() => {
            fetchGraph().then(
                (reloaded) => {
                    setGraph(reloaded);
                    setUpdatedAt(new Date());
                },
                () => undefined,
            );
        });
    }, []);

    if (error !== null) {
        return <p className="status status--error">{error}</p>;
    }
    if (graph === null) {
        return <p className="status">Loading schemas…</p>;
    }
    return <Viewer graph={graph} updatedAt={updatedAt} />;
}

function Viewer({ graph, updatedAt }: { graph: GraphData; updatedAt: Date | null }) {
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
    const enumFiles = useMemo(() => findEnumOnlyFiles(graph, entities), [graph, entities]);
    const sources = useMemo(() => [...new Set(entities.map((entity) => entity.source))].sort(), [entities]);
    const colors = useMemo(() => sourceColors(sources), [sources]);
    const entityNames = useMemo(() => entities.map((entity) => entity.name), [entities]);
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => initiallyCollapsed(entityNames));
    // After a reload, only the cards that were not there before get the default folding.
    const knownNames = useRef(new Set(entityNames));
    useEffect(() => {
        const newcomers = entityNames.filter((name) => !knownNames.current.has(name));
        if (newcomers.length === 0) {
            return;
        }
        for (const name of newcomers) {
            knownNames.current.add(name);
        }
        setCollapsed((current) => collapseNewcomers(current, newcomers, entityNames.length));
    }, [entityNames]);
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
                enumFiles={enumFiles}
                hiddenSources={hiddenSources}
                query={query}
                visibleCount={visibleEntities.length}
                relationCount={relations.length}
                inferredCount={inferredCount}
                showInferred={showInferred}
                onToggleInferred={() => setShowInferred((current) => !current)}
                colors={colors}
                updatedAt={updatedAt}
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
