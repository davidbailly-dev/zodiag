import { useEffect, useMemo, useState } from 'react';
import { Diagram } from './components/Diagram.js';
import { Sidebar } from './components/Sidebar.js';
import { fetchGraph } from './graph-data.js';
import type { GraphData } from './graph-data.js';
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
    const entities = useMemo(() => buildEntities(graph), [graph]);
    const sources = useMemo(() => [...new Set(entities.map((entity) => entity.source))].sort(), [entities]);
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
                relationCount={graph.relations.length}
                onQueryChange={setQuery}
                onToggleSource={toggleSource}
                onShowAll={() => setHiddenSources(new Set())}
                onHideAll={() => setHiddenSources(new Set(sources))}
            />
            <main className="canvas">
                <Diagram
                    // A different set of entities means a different layout: start from a fresh, fitted view.
                    key={visibleEntities.map((entity) => entity.name).join('|')}
                    entities={visibleEntities}
                    relations={graph.relations}
                />
            </main>
        </div>
    );
}
